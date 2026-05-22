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
import { runLazyLoadPass } from '../engine/extract/capture/lazy-load-pass';
import {
  CANONICAL_ROOT,
  canonicalTimestamp,
  cloneSubdir,
  defaultTargetFromHost,
} from '../engine/cli/canonical-paths';

const LEGACY_CAPTURE_ROOT = 'docs/research/captures';

type CliArgs = {
  url?: string;
  viewports: readonly Viewport[];
  out?: string;
  tour: boolean;
  mode: CaptureMode;
  headless: boolean;
  legacyOutput: boolean;
  target?: string;
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
  --viewport=<list>  Viewport selection. One of:
                       all                        (default, captures all 4 viewports)
                       desktop | mobile |
                       tablet | wide              (single viewport, ~4x faster)
                       <name>,<name>,...          (comma-separated subset)
                     Ignored in cdp/persistent mode.
  --out=<dir>        Output directory override.
                       Default (canonical): clones/<target>/<iso-timestamp>/captures
                       With --legacy-output: docs/research/captures/<host>/<iso-timestamp>
  --target=<name>    Override the canonical target slug (defaults to host without TLD).
  --legacy-output    Write into docs/research/captures/<host>/<iso-timestamp> instead
                       of the canonical layout. Defaults off.
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
    out: undefined,
    tour: true,
    mode: 'launch',
    headless: true,
    legacyOutput: false,
    target: undefined,
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
      const value = raw.slice('--viewport='.length).trim();
      // Sentinel "all" preserves the default behaviour (all 4 viewports).
      if (value === 'all' || value === '') {
        out.viewports = VIEWPORTS;
        continue;
      }
      const names = value.split(',').map((s) => s.trim()).filter(Boolean);
      const resolved: Viewport[] = [];
      for (const n of names) {
        if (!isViewportName(n)) {
          throw new Error(
            `Unknown viewport: "${n}". Valid: all, ${VIEWPORTS.map((v) => v.name).join(', ')}`,
          );
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
    if (raw === '--legacy-output') {
      out.legacyOutput = true;
      continue;
    }
    if (raw.startsWith('--target=')) {
      out.target = raw.slice('--target='.length).trim() || undefined;
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

/**
 * Resolve the capture output directory.
 *
 * Default (canonical): `clones/<target>/<iso>/captures/`.
 * `--legacy-output`: `docs/research/captures/<host>/<iso>/`.
 * `--out=<dir>`: explicit override, used verbatim (no host/timestamp suffix).
 */
function resolveCaptureRoot(args: CliArgs, host: string, stamp: string): string {
  if (args.out) {
    if (args.legacyOutput) {
      // Legacy semantic: --out is the parent root, host/stamp are appended.
      return join(args.out, host, stamp);
    }
    // Treat explicit --out as the exact directory.
    return args.out;
  }
  if (args.legacyOutput) {
    return join(LEGACY_CAPTURE_ROOT, host, stamp);
  }
  const target = args.target ?? defaultTargetFromHost(host);
  return cloneSubdir(target, stamp, 'captures', CANONICAL_ROOT);
}

function validateUrl(input: string | undefined): URL {
  if (!input) throw new Error('Missing required <url> argument. Run with --help for usage.');
  try {
    return new URL(input);
  } catch {
    throw new Error(`Invalid URL: "${input}"`);
  }
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

    // Fix #6: lazy-load asset re-capture. Scroll-to-bottom pass triggers
    // IntersectionObserver-driven loads. Gated AFTER initial networkidle
    // so we never run it on a page that hasn't finished its first paint.
    const lazy = await runLazyLoadPass(page);
    console.log(
      `  [lazy-load] ${viewport.name}: ${lazy.scrollSteps} steps, ` +
        `${lazy.finalHeightPx}px tall, ${lazy.durationMs}ms`,
    );

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

    // Fix #6: lazy-load asset re-capture. Same pass as launch mode — the
    // shared network-recorder will pick up any new requests automatically.
    const lazy = await runLazyLoadPass(page);
    console.log(
      `  [lazy-load] ${viewportName}: ${lazy.scrollSteps} steps, ` +
        `${lazy.finalHeightPx}px tall, ${lazy.durationMs}ms`,
    );

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

export interface CaptureRunResult {
  /** Root directory where the capture landed. */
  readonly rootDir: string;
  /** Per-viewport result rows. */
  readonly viewports: readonly ViewportResult[];
}

export async function runCapture(argv: string[]): Promise<CaptureRunResult> {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP_TEXT);
    return { rootDir: '', viewports: [] };
  }

  const url = validateUrl(args.url);
  const host = url.hostname || 'unknown-host';
  const stamp = canonicalTimestamp();
  const root = resolveCaptureRoot(args, host, stamp);
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
    throw fatal;
  }
  return { rootDir: root, viewports: results };
}

async function cli(): Promise<void> {
  let result: CaptureRunResult;
  try {
    result = await runCapture(process.argv.slice(2));
  } catch (err) {
    console.error('[capture] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
  if (result.viewports.length > 0 && result.viewports.every((r) => !r.ok)) {
    process.exit(1);
  }
}

// Only run as CLI when invoked directly (not when imported).
const isDirect = process.argv[1] && process.argv[1].endsWith('capture.ts');
if (isDirect) {
  cli().catch((err) => {
    console.error('[capture] fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
