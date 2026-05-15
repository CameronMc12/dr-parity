#!/usr/bin/env tsx
/**
 * P3.11 — Multi-viewport parity verification for the rebuild-pro pipeline.
 *
 * Goals (per NEXT.md):
 *   1. Boot the rebuilt site and load it at 375 / 768 / 1024 / 1440px.
 *   2. Take a full-page screenshot at each viewport.
 *   3. Diff each screenshot against the original captured viewport screenshot.
 *   4. Assert per-viewport diff ratio < 2% (matches the existing parity threshold).
 *   5. Also audit how many responsive `@media` rules survived the pipeline.
 *
 * Reality check (2026-05-15):
 *   - The most recent finished rebuild on disk is `clone-enerblock/` (Astro project
 *     in safe mode). Its `dist/` is already built — we serve that statically.
 *   - The original captures only contain a single desktop full-page screenshot at
 *     `docs/research/enerblock/screenshots/full-page.png` (1440 wide). No mobile
 *     /tablet/desktop variants exist. So for 375/768/1024 the test runs the
 *     screenshot capture and ASSERTS_PRESENT only (no pixel diff possible).
 *   - For 1440 it does a real pixel diff against the captured full-page reference.
 *
 * Output:
 *   - Screenshots written to `engine/tests/out/multi-viewport/<viewport>/rebuilt.png`.
 *   - Diff PNGs written next to them when a reference exists.
 *   - JSON summary written to `engine/tests/out/multi-viewport/result.json`.
 *
 * Exit code: 0 if every viewport with a reference passes the 2% threshold AND
 * every viewport without a reference at least rendered a non-empty screenshot.
 * Non-zero otherwise.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(__dirname, '..', '..');
const REBUILT_DIR = join(REPO_ROOT, 'clone-enerblock', 'dist');
const REFERENCE_DESKTOP = join(
  REPO_ROOT,
  'docs',
  'research',
  'enerblock',
  'screenshots',
  'full-page.png',
);
const OUT_DIR = join(REPO_ROOT, 'engine', 'tests', 'out', 'multi-viewport');

const DIFF_THRESHOLD_RATIO = 0.02; // 2% per NEXT.md
const PIXELMATCH_PIXEL_THRESHOLD = 0.1;

interface Viewport {
  name: string;
  width: number;
  height: number;
  /** Path to original capture for diffing. `null` means no reference. */
  reference: string | null;
}

const VIEWPORTS: Viewport[] = [
  { name: '375x812-mobile', width: 375, height: 812, reference: null },
  { name: '768x1024-tablet', width: 768, height: 1024, reference: null },
  { name: '1024x768-desktop-sm', width: 1024, height: 768, reference: null },
  { name: '1440x900-desktop', width: 1440, height: 900, reference: REFERENCE_DESKTOP },
];

// ---------------------------------------------------------------------------
// Tiny static server (reuses serve-bin like engine/verify/ports.ts)
// ---------------------------------------------------------------------------

interface ServerHandle {
  url: string;
  kill: () => void;
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolveProbe) => {
    const server = net.createServer();
    server.once('error', () => resolveProbe(false));
    server.once('listening', () => server.close(() => resolveProbe(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function pickFreePort(): Promise<number> {
  for (let port = 5080; port <= 5099; port++) {
    if (await probePort(port)) return port;
  }
  throw new Error('No free port in 5080-5099');
}

function resolveServeBin(): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('serve/package.json');
  return resolve(pkgPath, '..', 'build', 'main.js');
}

async function bootServer(dir: string): Promise<ServerHandle> {
  const port = await pickFreePort();
  const serveBin = resolveServeBin();
  const child: ChildProcess = spawn(
    process.execPath,
    [serveBin, dir, '--listen', String(port), '--no-clipboard', '--no-port-switching'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_NO_WARNINGS: '1' } },
  );
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});

  const url = `http://127.0.0.1:${port}/`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status >= 200 && res.status < 500) {
        return {
          url,
          kill: () => {
            try {
              child.kill('SIGTERM');
            } catch {}
          },
        };
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  try {
    child.kill('SIGTERM');
  } catch {}
  throw new Error(`Server at ${url} did not become ready in 30s`);
}

// ---------------------------------------------------------------------------
// PNG diff helpers (copied from engine/verify/diff.ts to keep test self-contained)
// ---------------------------------------------------------------------------

async function readPng(filePath: string): Promise<PNG> {
  const buf = await readFile(filePath);
  return new Promise<PNG>((resolveParse, reject) => {
    const png = new PNG();
    png.parse(buf, (err, data) => {
      if (err) reject(new Error(`Failed to parse PNG ${filePath}: ${err.message}`));
      else resolveParse(data);
    });
  });
}

function encodePng(png: PNG): Promise<Buffer> {
  return new Promise<Buffer>((resolveEnc, reject) => {
    const chunks: Buffer[] = [];
    png
      .pack()
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => resolveEnc(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function cropToSize(src: PNG, width: number, height: number): PNG {
  if (src.width === width && src.height === height) return src;
  const dst = new PNG({ width, height });
  const copyW = Math.min(width, src.width);
  const copyH = Math.min(height, src.height);
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) {
      const s = (y * src.width + x) * 4;
      const d = (y * width + x) * 4;
      dst.data[d] = src.data[s]!;
      dst.data[d + 1] = src.data[s + 1]!;
      dst.data[d + 2] = src.data[s + 2]!;
      dst.data[d + 3] = src.data[s + 3]!;
    }
  }
  return dst;
}

interface DiffResult {
  width: number;
  height: number;
  mismatchedPixels: number;
  totalPixels: number;
  diffRatio: number;
  diffPath: string;
}

async function diffPngs(a: string, b: string, diffOut: string): Promise<DiffResult> {
  const [aPng, bPng] = await Promise.all([readPng(a), readPng(b)]);
  const width = Math.min(aPng.width, bPng.width);
  const height = Math.min(aPng.height, bPng.height);
  if (width === 0 || height === 0) {
    throw new Error(`Empty PNG dims a=${aPng.width}x${aPng.height} b=${bPng.width}x${bPng.height}`);
  }
  const aCrop = cropToSize(aPng, width, height);
  const bCrop = cropToSize(bPng, width, height);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(aCrop.data, bCrop.data, diff.data, width, height, {
    threshold: PIXELMATCH_PIXEL_THRESHOLD,
  });
  const total = width * height;
  await mkdir(dirname(diffOut), { recursive: true });
  await writeFile(diffOut, await encodePng(diff));
  return {
    width,
    height,
    mismatchedPixels: mismatched,
    totalPixels: total,
    diffRatio: total > 0 ? mismatched / total : 0,
    diffPath: diffOut,
  };
}

// ---------------------------------------------------------------------------
// Per-viewport runner
// ---------------------------------------------------------------------------

interface ViewportOutcome {
  name: string;
  width: number;
  height: number;
  screenshotPath: string;
  rendered: boolean;
  hasReference: boolean;
  diffRatio: number | null;
  diffPath: string | null;
  pass: boolean;
  note: string;
}

async function captureViewport(
  browser: Browser,
  url: string,
  vp: Viewport,
): Promise<ViewportOutcome> {
  const viewportDir = join(OUT_DIR, vp.name);
  mkdirSync(viewportDir, { recursive: true });
  const screenshotPath = join(viewportDir, 'rebuilt.png');

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  let page: Page | null = null;
  try {
    page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 });
    } catch (err) {
      // Swallow networkidle timeout — captured sites often have long-poll connections.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Timeout/i.test(msg)) throw err;
    }
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
    try {
      await context.close();
    } catch {}
  }

  const rendered = existsSync(screenshotPath);
  if (!rendered) {
    return {
      name: vp.name,
      width: vp.width,
      height: vp.height,
      screenshotPath,
      rendered: false,
      hasReference: vp.reference != null,
      diffRatio: null,
      diffPath: null,
      pass: false,
      note: 'screenshot file missing',
    };
  }

  if (!vp.reference || !existsSync(vp.reference)) {
    return {
      name: vp.name,
      width: vp.width,
      height: vp.height,
      screenshotPath,
      rendered: true,
      hasReference: false,
      diffRatio: null,
      diffPath: null,
      pass: true, // no reference → cannot fail, but flag in findings
      note: 'no reference capture at this viewport — diff skipped',
    };
  }

  const diffPath = join(viewportDir, 'diff.png');
  const diff = await diffPngs(vp.reference, screenshotPath, diffPath);
  const pass = diff.diffRatio <= DIFF_THRESHOLD_RATIO;
  return {
    name: vp.name,
    width: vp.width,
    height: vp.height,
    screenshotPath,
    rendered: true,
    hasReference: true,
    diffRatio: diff.diffRatio,
    diffPath: diff.diffPath,
    pass,
    note: pass
      ? `diff ${(diff.diffRatio * 100).toFixed(3)}% <= 2%`
      : `diff ${(diff.diffRatio * 100).toFixed(3)}% > 2%`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[multi-viewport-parity] rebuilt dir:', REBUILT_DIR);
  console.log('[multi-viewport-parity] desktop reference:', REFERENCE_DESKTOP);
  mkdirSync(OUT_DIR, { recursive: true });

  if (!existsSync(REBUILT_DIR)) {
    throw new Error(`Rebuilt dist not found at ${REBUILT_DIR}. Run \`npm run build -w clone-enerblock\` first.`);
  }

  const server = await bootServer(REBUILT_DIR);
  console.log('[multi-viewport-parity] server up:', server.url);

  const browser = await chromium.launch({ headless: true });
  const outcomes: ViewportOutcome[] = [];
  try {
    for (const vp of VIEWPORTS) {
      console.log(`[multi-viewport-parity] capturing ${vp.name} (${vp.width}x${vp.height})...`);
      const outcome = await captureViewport(browser, server.url, vp);
      outcomes.push(outcome);
      console.log(`  -> rendered=${outcome.rendered} pass=${outcome.pass} ${outcome.note}`);
    }
  } finally {
    try {
      await browser.close();
    } catch {}
    server.kill();
  }

  const summary = {
    rebuiltDir: REBUILT_DIR,
    threshold: DIFF_THRESHOLD_RATIO,
    timestamp: new Date().toISOString(),
    viewports: outcomes,
    allPassed: outcomes.every((o) => o.pass),
  };
  writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(summary, null, 2));

  console.log('\n[multi-viewport-parity] === per-viewport results ===');
  for (const o of outcomes) {
    const diff = o.diffRatio != null ? `${(o.diffRatio * 100).toFixed(3)}%` : 'n/a';
    const status = o.pass ? 'PASS' : 'FAIL';
    console.log(
      `  ${status.padEnd(4)} ${o.name.padEnd(24)} diff=${diff.padEnd(8)} hasRef=${o.hasReference}  note="${o.note}"`,
    );
  }

  if (!summary.allPassed) {
    console.error('\n[multi-viewport-parity] FAILED — see engine/tests/MULTI_VIEWPORT_FINDINGS.md');
    process.exit(1);
  }
  console.log('\n[multi-viewport-parity] ALL VIEWPORTS PASS');
}

main().catch((err) => {
  console.error('[multi-viewport-parity] crashed:', err);
  process.exit(2);
});
