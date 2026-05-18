#!/usr/bin/env tsx
/**
 * Multi-viewport parity verification for the React target.
 *
 * Mirrors `multi-viewport-parity.spec.ts` (Astro) but boots a Vite dev server
 * against the emitted React project and diffs against the same captured
 * originals. Same 2% threshold so the two targets stay directly comparable.
 *
 * Inputs:
 *   - React project at `clone-enerblock-react/` (produced by
 *     `tsx scripts/build.ts --target=react --clone-dir=./clone-enerblock --out-dir=./clone-enerblock-react`).
 *   - Desktop reference at `docs/research/enerblock/screenshots/full-page.png`.
 *
 * Output:
 *   - Screenshots at `engine/tests/out/multi-viewport-react/<viewport>/rebuilt.png`.
 *   - Diff PNGs next to them when a reference exists.
 *   - JSON summary at `engine/tests/out/multi-viewport-react/result.json`.
 *
 * Exit code: 0 if every viewport with a reference passes the 2% threshold AND
 * every viewport without a reference at least rendered a non-empty screenshot.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(__dirname, '..', '..');
const REACT_PROJECT_DIR = join(REPO_ROOT, 'clone-enerblock-react');
const REFERENCE_DESKTOP = join(
  REPO_ROOT,
  'docs',
  'research',
  'enerblock',
  'screenshots',
  'full-page.png',
);
const OUT_DIR = join(REPO_ROOT, 'engine', 'tests', 'out', 'multi-viewport-react');

const DIFF_THRESHOLD_RATIO = 0.02; // 2% per NEXT.md
const PIXELMATCH_PIXEL_THRESHOLD = 0.1;

const VITE_DEFAULT_PORT = 5173;
const VITE_PORT_FALLBACK_RANGE: [number, number] = [5173, 5199];
const VITE_READY_TIMEOUT_MS = 60_000;

interface Viewport {
  name: string;
  width: number;
  height: number;
  reference: string | null;
}

const VIEWPORTS: Viewport[] = [
  { name: '375x812-mobile', width: 375, height: 812, reference: null },
  { name: '768x1024-tablet', width: 768, height: 1024, reference: null },
  { name: '1024x768-desktop-sm', width: 1024, height: 768, reference: null },
  { name: '1440x900-desktop', width: 1440, height: 900, reference: REFERENCE_DESKTOP },
];

// ---------------------------------------------------------------------------
// Vite dev server boot
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
  const [start, end] = VITE_PORT_FALLBACK_RANGE;
  for (let port = start; port <= end; port++) {
    if (await probePort(port)) return port;
  }
  throw new Error(`No free port in ${start}-${end}`);
}

async function waitForReady(url: string, deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status >= 200 && res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite dev server at ${url} did not become ready in ${deadlineMs}ms`);
}

async function bootViteDevServer(projectDir: string): Promise<ServerHandle> {
  if (!existsSync(projectDir)) {
    throw new Error(
      `React project not found at ${projectDir}. Build it first with:\n  tsx scripts/build.ts --target=react --clone-dir=./clone-enerblock --out-dir=${projectDir}`,
    );
  }
  const pkgJson = join(projectDir, 'package.json');
  if (!existsSync(pkgJson)) {
    throw new Error(`Missing package.json at ${pkgJson}. Did the React build complete?`);
  }

  const port = await pickFreePort();
  const child: ChildProcess = spawn(
    'npx',
    ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    },
  );
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});

  const url = `http://127.0.0.1:${port}/`;
  try {
    await waitForReady(url, VITE_READY_TIMEOUT_MS);
  } catch (err) {
    try {
      child.kill('SIGTERM');
    } catch {}
    throw err;
  }
  // Hint that we used the default port when relevant — not a failure, just noise reduction.
  if (port !== VITE_DEFAULT_PORT) {
    console.log(`[multi-viewport-parity-react] using port ${port} (default ${VITE_DEFAULT_PORT} busy)`);
  }
  return {
    url,
    kill: () => {
      try {
        child.kill('SIGTERM');
      } catch {}
    },
  };
}

// ---------------------------------------------------------------------------
// PNG diff helpers (kept self-contained — mirrors the Astro spec)
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
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Timeout/i.test(msg)) throw err;
    }
    // Vite HMR keeps a long-poll open — small static wait is enough.
    await page.waitForTimeout(2_500);
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
      pass: true,
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
  console.log('[multi-viewport-parity-react] project dir:', REACT_PROJECT_DIR);
  console.log('[multi-viewport-parity-react] desktop reference:', REFERENCE_DESKTOP);
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await bootViteDevServer(REACT_PROJECT_DIR);
  console.log('[multi-viewport-parity-react] vite up:', server.url);

  const browser = await chromium.launch({ headless: true });
  const outcomes: ViewportOutcome[] = [];
  try {
    for (const vp of VIEWPORTS) {
      console.log(
        `[multi-viewport-parity-react] capturing ${vp.name} (${vp.width}x${vp.height})...`,
      );
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
    target: 'react' as const,
    projectDir: REACT_PROJECT_DIR,
    threshold: DIFF_THRESHOLD_RATIO,
    timestamp: new Date().toISOString(),
    viewports: outcomes,
    allPassed: outcomes.every((o) => o.pass),
  };
  writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify(summary, null, 2));

  console.log('\n[multi-viewport-parity-react] === per-viewport results ===');
  for (const o of outcomes) {
    const diff = o.diffRatio != null ? `${(o.diffRatio * 100).toFixed(3)}%` : 'n/a';
    const status = o.pass ? 'PASS' : 'FAIL';
    console.log(
      `  ${status.padEnd(4)} ${o.name.padEnd(24)} diff=${diff.padEnd(8)} hasRef=${o.hasReference}  note="${o.note}"`,
    );
  }

  if (!summary.allPassed) {
    console.error('\n[multi-viewport-parity-react] FAILED');
    process.exit(1);
  }
  console.log('\n[multi-viewport-parity-react] ALL VIEWPORTS PASS');
}

main().catch((err) => {
  console.error('[multi-viewport-parity-react] crashed:', err);
  process.exit(2);
});
