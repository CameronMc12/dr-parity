#!/usr/bin/env tsx
/**
 * Multi-mode capture pipeline.
 *
 * Modes:
 *   --mode=launch (default)  Fresh isolated headless Chromium (cached binary).
 *                            Full HAR + video + trace per viewport.
 *   --mode=cdp               Attach to Image Studio Chrome on :9222.
 *                            Reuses logged-in profile. No video. Manual network.json.
 *   --mode=persistent        Launch a persistent Chrome (channel=chrome) at the
 *                            shared user-data-dir. Single viewport only.
 */

import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { BrowserContext } from 'playwright';
import {
  openBrowser,
  closeBrowser,
  type BrowserHandle,
  type CaptureMode,
} from '../engine/extract/browser/cdp-attach';
import { VIEWPORTS, isViewportName, type Viewport } from '../engine/extract/browser/viewports';
import { buildContextOptions, startTrace, stopTrace } from '../engine/extract/capture/recording';
import { startNetworkRecorder } from '../engine/extract/capture/network-recorder';
import { runTour } from '../engine/extract/capture/tour';

type CliArgs = {
  url?: string;
  viewports: readonly Viewport[];
  out: string;
  tour: boolean;
  mode: CaptureMode;
  headless: boolean;
  help: boolean;
};

const VALID_MODES: readonly CaptureMode[] = ['launch', 'cdp', 'persistent'];

const HELP_TEXT = `
dr-parity capture

Usage:
  tsx scripts/capture.ts <url> [options]

Options:
  --mode=<mode>      Capture mode: launch | cdp | persistent. Default: launch.
                       launch     - fresh headless Chromium (full HAR + video + trace)
                       cdp        - attach to Chrome on :9222 (no video, manual network)
                       persistent - launch shared Chrome profile (single viewport)
  --viewport=<list>  Comma-separated viewport names (mobile,tablet,desktop,wide).
                     Default: all four. Ignored in cdp/persistent mode.
  --out=<dir>        Output root directory. Default: docs/research/captures
  --no-tour          Skip the scroll/hover tour after page load.
  --headed           Run launch mode with a visible browser (default: headless).
  -h, --help         Show this help.
`.trim();

function parseMode(value: string): CaptureMode {
  if ((VALID_MODES as readonly string[]).includes(value)) {
    return value as CaptureMode;
  }
  throw new Error(`Unknown mode: "${value}". Valid: ${VALID_MODES.join(', ')}`);
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    url: undefined,
    viewports: VIEWPORTS,
    out: 'docs/research/captures',
    tour: true,
    mode: 'launch',
    headless: true,
    help: false,
  };

  const positional: string[] = [];
  for (const raw of argv) {
    if (raw === '-h' || raw === '--help') {
      out.help = true;
      continue;
    }
    if (raw === '--no-tour') {
      out.tour = false;
      continue;
    }
    if (raw === '--headed') {
      out.headless = false;
      continue;
    }
    if (raw.startsWith('--mode=')) {
      out.mode = parseMode(raw.slice('--mode='.length).trim());
      continue;
    }
    if (raw.startsWith('--viewport=')) {
      const names = raw.slice('--viewport='.length).split(',').map((s) => s.trim()).filter(Boolean);
      const resolved: Viewport[] = [];
      for (const n of names) {
        if (!isViewportName(n)) {
          throw new Error(`Unknown viewport: "${n}". Valid: ${VIEWPORTS.map((v) => v.name).join(', ')}`);
        }
        const v = VIEWPORTS.find((x) => x.name === n);
        if (v) resolved.push(v);
      }
      out.viewports = resolved;
      continue;
    }
    if (raw.startsWith('--out=')) {
      out.out = raw.slice('--out='.length);
      continue;
    }
    if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    }
    positional.push(raw);
  }

  out.url = positional[0];
  return out;
}

function validateUrl(input: string | undefined): URL {
  if (!input) throw new Error('Missing required <url> argument. Run with --help for usage.');
  try {
    return new URL(input);
  } catch {
    throw new Error(`Invalid URL: "${input}"`);
  }
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

type ViewportResult = {
  name: string;
  dir: string;
  files: string[];
  ok: boolean;
  error?: string;
};

type Manifest = {
  url: string;
  host: string;
  startedAt: string;
  finishedAt: string;
  mode: CaptureMode;
  viewports: ViewportResult[];
};

async function captureLaunchViewport(
  handle: Extract<BrowserHandle, { mode: 'launch' }>,
  viewport: Viewport,
  rootDir: string,
  url: string,
  runTourEnabled: boolean
): Promise<ViewportResult> {
  const dir = join(rootDir, viewport.name);
  mkdirSync(dir, { recursive: true });

  let ctx: BrowserContext | null = null;
  try {
    ctx = await handle.newContext(buildContextOptions({ viewport, outDir: dir }));
    await startTrace(ctx);

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    if (runTourEnabled) {
      await runTour(page);
    }

    await page.screenshot({ path: join(dir, 'screenshot.png'), fullPage: true });

    await stopTrace(ctx, dir);
    await ctx.close();
    ctx = null;

    return {
      name: viewport.name,
      dir,
      files: ['screenshot.png', 'network.har', 'trace.zip', 'video/'],
      ok: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* noop */
      }
    }
    return { name: viewport.name, dir, files: [], ok: false, error: msg };
  }
}

async function captureSharedContext(
  ctx: BrowserContext,
  viewportName: string,
  rootDir: string,
  url: string,
  runTourEnabled: boolean,
  includeNetworkRecorder: boolean
): Promise<ViewportResult> {
  const dir = join(rootDir, viewportName);
  mkdirSync(dir, { recursive: true });

  const recorder = includeNetworkRecorder ? startNetworkRecorder(ctx) : null;

  try {
    await startTrace(ctx);

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    if (runTourEnabled) {
      await runTour(page);
    }

    await page.screenshot({ path: join(dir, 'screenshot.png'), fullPage: true });

    await stopTrace(ctx, dir);
    if (recorder) {
      await recorder.stop(dir);
    }
    await page.close();

    const files = ['screenshot.png', 'trace.zip'];
    if (recorder) files.push('network.json');

    return { name: viewportName, dir, files, ok: true };
  } catch (err) {
    if (recorder) {
      try {
        await recorder.stop(dir);
      } catch {
        /* noop */
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { name: viewportName, dir, files: [], ok: false, error: msg };
  }
}

function printSummary(manifest: Manifest): void {
  console.log('\n--- Capture Summary ---');
  console.log(`URL:     ${manifest.url}`);
  console.log(`Mode:    ${manifest.mode}`);
  console.log(`Started: ${manifest.startedAt}`);
  console.log(`Ended:   ${manifest.finishedAt}\n`);
  for (const v of manifest.viewports) {
    const status = v.ok ? 'OK ' : 'ERR';
    console.log(`  [${status}] ${v.name.padEnd(8)} -> ${v.dir}${v.error ? `  (${v.error})` : ''}`);
  }
  console.log('');
}

async function runLaunch(
  handle: Extract<BrowserHandle, { mode: 'launch' }>,
  args: CliArgs,
  url: URL,
  root: string
): Promise<ViewportResult[]> {
  const results: ViewportResult[] = [];
  for (const viewport of args.viewports) {
    results.push(await captureLaunchViewport(handle, viewport, root, url.toString(), args.tour));
  }
  return results;
}

async function runCdp(
  handle: Extract<BrowserHandle, { mode: 'cdp' }>,
  args: CliArgs,
  url: URL,
  root: string
): Promise<ViewportResult[]> {
  console.log('[capture] cdp mode: video recording disabled; using manual network.json.');
  if (args.viewports.length > 1) {
    console.log('[capture] cdp mode: viewport flag ignored — CDP profile has a fixed viewport.');
  }
  const result = await captureSharedContext(
    handle.existingContext,
    'cdp',
    root,
    url.toString(),
    args.tour,
    true
  );
  return [result];
}

async function runPersistent(
  handle: Extract<BrowserHandle, { mode: 'persistent' }>,
  args: CliArgs,
  url: URL,
  root: string
): Promise<ViewportResult[]> {
  if (args.viewports.length > 1) {
    console.log('[capture] persistent mode: only one context available — running a single iteration.');
  }
  const viewportName = args.viewports[0]?.name ?? 'persistent';
  const result = await captureSharedContext(
    handle.context,
    viewportName,
    root,
    url.toString(),
    args.tour,
    true
  );
  return [result];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const url = validateUrl(args.url);
  const host = url.hostname || 'unknown-host';
  const stamp = isoStamp();
  const root = join(args.out, host, stamp);
  mkdirSync(root, { recursive: true });

  const handle = await openBrowser({ mode: args.mode, headless: args.headless });

  const startedAt = new Date().toISOString();
  let results: ViewportResult[] = [];
  let fatal: Error | null = null;

  try {
    if (handle.mode === 'launch') {
      results = await runLaunch(handle, args, url, root);
    } else if (handle.mode === 'cdp') {
      results = await runCdp(handle, args, url, root);
    } else {
      results = await runPersistent(handle, args, url, root);
    }
  } catch (err) {
    fatal = err instanceof Error ? err : new Error(String(err));
  } finally {
    await closeBrowser(handle);
  }

  const finishedAt = new Date().toISOString();
  const manifest: Manifest = {
    url: url.toString(),
    host,
    startedAt,
    finishedAt,
    mode: args.mode,
    viewports: results,
  };

  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));

  printSummary(manifest);

  if (fatal) {
    console.error('[capture] fatal:', fatal.message);
    process.exit(1);
  }
  if (results.length > 0 && results.every((r) => !r.ok)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[capture] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
