#!/usr/bin/env tsx
import { resolve as resolvePath } from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import type { Browser } from 'playwright';
import {
  VIEWPORTS,
  VIEWPORT_NAMES,
  type Viewport,
  type ParityReport,
  type VerifyConfig,
  type ViewportResult,
  type ServerHandle,
} from '../engine/verify/types';
import { bootServers } from '../engine/verify/ports';
import { launchBrowser, captureAll } from '../engine/verify/screenshots';
import { diffShot } from '../engine/verify/diff';
import {
  writeJsonReport,
  writeMarkdownReport,
  printStdoutTable,
} from '../engine/verify/report';

/**
 * Default per-target pixel-diff thresholds.
 *
 * Astro is a static-render target so the rebuilt output matches the
 * captured clone byte-for-byte. React (hydrated) and webapp (stateful)
 * targets carry real DOM variance even after media-preserve passes;
 * apple.com measurements landed around 18.62 percent diff for react.
 * The 20 percent floor gives breathing room without masking regressions.
 */
const DEFAULT_THRESHOLDS = {
  astro: 0.02,
  react: 0.2,
  webapp: 0.2,
} as const;
const DEFAULT_THRESHOLD = DEFAULT_THRESHOLDS.astro;

type TargetName = keyof typeof DEFAULT_THRESHOLDS;

const USAGE = `Usage: tsx scripts/verify-parity.ts --clone=<dir> --rebuilt=<dir> [options]

Pixel-diff a captured clone against a rebuilt site at multiple viewports.

Required:
  --clone=<dir>            Directory with the original captured clone (must contain index.html)
  --rebuilt=<dir>          Directory with the rebuilt built dist (must contain index.html)

Options:
  --out=<dir>              Output directory for screenshots and report.
                           Default: <rebuilt-dir>/../parity-report/
  --target=<name>          Target framework hint. One of: astro, react, webapp.
                           Selects the default threshold when --threshold is not set.
                           Defaults to astro.
  --threshold=<ratio>      Generic max acceptable diff ratio per viewport (0.0-1.0).
                           Wins over the per-target default. Default: ${DEFAULT_THRESHOLDS.astro} (astro).
  --threshold-astro=<r>    Override the astro default. Default: ${DEFAULT_THRESHOLDS.astro}.
  --threshold-react=<r>    Override the react default. Default: ${DEFAULT_THRESHOLDS.react}.
  --threshold-webapp=<r>   Override the webapp default. Default: ${DEFAULT_THRESHOLDS.webapp}.
  --viewports=<list>       Comma-separated viewport names. Default: mobile,tablet,desktop,wide
                           Available: ${VIEWPORT_NAMES.join(', ')}
  --help, -h               Show this help

Threshold resolution order (highest priority first):
  1. --threshold=<r>             (explicit, target-agnostic)
  2. --threshold-<target>=<r>    (matching the --target flag)
  3. Per-target default from DEFAULT_THRESHOLDS

Exit codes:
  0  overall pass
  1  overall fail or error
`;

interface RawArgs {
  clone?: string;
  rebuilt?: string;
  out?: string;
  threshold?: string;
  thresholdAstro?: string;
  thresholdReact?: string;
  thresholdWebapp?: string;
  target?: string;
  viewports?: string;
  help?: boolean;
}

function parseArgs(argv: string[]): RawArgs {
  const out: RawArgs = {};
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      out.help = true;
      continue;
    }
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq === -1) continue;
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    switch (key) {
      case 'clone':
      case 'rebuilt':
      case 'out':
      case 'threshold':
      case 'target':
      case 'viewports':
        out[key] = value;
        break;
      case 'threshold-astro':
        out.thresholdAstro = value;
        break;
      case 'threshold-react':
        out.thresholdReact = value;
        break;
      case 'threshold-webapp':
        out.thresholdWebapp = value;
        break;
      default:
        // Unknown long flag. Silently ignored to preserve historical behaviour.
        break;
    }
  }
  return out;
}

async function assertDir(label: string, dir: string): Promise<void> {
  const dirStat = await stat(dir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    throw new Error(`--${label} is not a directory: ${dir}`);
  }
  const indexStat = await stat(resolvePath(dir, 'index.html')).catch(() => null);
  if (!indexStat || !indexStat.isFile()) {
    throw new Error(`--${label} missing index.html: ${dir}`);
  }
}

function parseViewports(raw: string | undefined): Viewport[] {
  if (!raw) return [...VIEWPORTS];
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) {
    throw new Error(`--viewports is empty. Available: ${VIEWPORT_NAMES.join(', ')}`);
  }
  const selected: Viewport[] = [];
  for (const name of names) {
    const found = VIEWPORTS.find((v) => v.name === name);
    if (!found) {
      throw new Error(
        `Unknown viewport "${name}". Available: ${VIEWPORT_NAMES.join(', ')}`,
      );
    }
    selected.push(found);
  }
  return selected;
}

function parseRatio(label: string, raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`--${label} must be a number between 0 and 1, got "${raw}"`);
  }
  return n;
}

function parseTarget(raw: string | undefined): TargetName {
  if (raw == null || raw.length === 0) return 'astro';
  if (raw === 'astro' || raw === 'react' || raw === 'webapp') return raw;
  throw new Error(
    `--target must be one of astro, react, webapp. Got "${raw}".`,
  );
}

/**
 * Resolve the effective threshold given parsed args. Precedence:
 *   1. --threshold=<r>             (explicit, target-agnostic)
 *   2. --threshold-<target>=<r>    (matching the --target flag)
 *   3. Per-target default from DEFAULT_THRESHOLDS
 */
function resolveThreshold(raw: RawArgs, target: TargetName): number {
  const explicit = parseRatio('threshold', raw.threshold);
  if (explicit != null) return explicit;

  const perTargetOverride =
    target === 'astro'
      ? parseRatio('threshold-astro', raw.thresholdAstro)
      : target === 'react'
        ? parseRatio('threshold-react', raw.thresholdReact)
        : parseRatio('threshold-webapp', raw.thresholdWebapp);
  if (perTargetOverride != null) return perTargetOverride;

  return DEFAULT_THRESHOLDS[target] ?? DEFAULT_THRESHOLD;
}

async function resolveConfig(raw: RawArgs): Promise<VerifyConfig> {
  if (!raw.clone) throw new Error('--clone is required');
  if (!raw.rebuilt) throw new Error('--rebuilt is required');

  const cloneDir = resolvePath(raw.clone);
  const rebuiltDir = resolvePath(raw.rebuilt);
  await assertDir('clone', cloneDir);
  await assertDir('rebuilt', rebuiltDir);

  const outDir = resolvePath(raw.out ?? resolvePath(rebuiltDir, '..', 'parity-report'));
  await mkdir(outDir, { recursive: true });

  const target = parseTarget(raw.target);
  return {
    cloneDir,
    rebuiltDir,
    outDir,
    thresholdRatio: resolveThreshold(raw, target),
    viewports: parseViewports(raw.viewports),
  };
}

async function runPipeline(config: VerifyConfig): Promise<ParityReport> {
  const start = Date.now();
  let cloneServer: ServerHandle | null = null;
  let rebuiltServer: ServerHandle | null = null;
  let browser: Browser | null = null;

  try {
    process.stdout.write(`[verify] booting servers...\n`);
    const booted = await bootServers(config.cloneDir, config.rebuiltDir);
    cloneServer = booted.cloneServer;
    rebuiltServer = booted.rebuiltServer;
    process.stdout.write(
      `[verify] clone -> ${cloneServer.url} (pid=${cloneServer.pid}) | rebuilt -> ${rebuiltServer.url} (pid=${rebuiltServer.pid})\n`,
    );

    browser = await launchBrowser();
    process.stdout.write(`[verify] capturing ${config.viewports.length} viewports...\n`);

    const shots = await captureAll(
      browser,
      cloneServer.url,
      rebuiltServer.url,
      config.viewports,
      config.outDir,
    );

    const results: ViewportResult[] = [];
    for (const shot of shots) {
      process.stdout.write(`[verify] diffing ${shot.viewport.name}...\n`);
      const result = await diffShot(
        {
          viewport: shot.viewport,
          clonePath: shot.clonePath,
          rebuiltPath: shot.rebuiltPath,
        },
        config.thresholdRatio,
      );
      results.push(result);
    }

    const overallPass = results.every((r) => r.pass);
    return {
      clone: config.cloneDir,
      rebuilt: config.rebuiltDir,
      thresholdRatio: config.thresholdRatio,
      viewports: results,
      overallPass,
      durationMs: Date.now() - start,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (rebuiltServer) rebuiltServer.kill();
    if (cloneServer) cloneServer.kill();
  }
}

async function main(): Promise<void> {
  const raw = parseArgs(process.argv.slice(2));
  if (raw.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  let config: VerifyConfig;
  try {
    config = await resolveConfig(raw);
  } catch (err) {
    process.stderr.write(
      `[verify] ${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`,
    );
    process.exit(1);
  }

  try {
    const report = await runPipeline(config);
    await writeJsonReport(config.outDir, report);
    await writeMarkdownReport(config.outDir, report);
    printStdoutTable(report.viewports, report.overallPass);
    process.stdout.write(`\n[verify] report: ${config.outDir}\n`);
    process.exit(report.overallPass ? 0 : 1);
  } catch (err) {
    process.stderr.write(
      `[verify] pipeline failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

main();
