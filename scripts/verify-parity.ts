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

const USAGE = `Usage: tsx scripts/verify-parity.ts --clone=<dir> --rebuilt=<dir> [options]

Pixel-diff a captured clone against a rebuilt Astro site at multiple viewports.

Required:
  --clone=<dir>        Directory with the original captured clone (must contain index.html)
  --rebuilt=<dir>      Directory with the rebuilt Astro built dist (must contain index.html)

Options:
  --out=<dir>          Output directory for screenshots and report.
                       Default: <rebuilt-dir>/../parity-report/
  --threshold=<ratio>  Max acceptable diff ratio per viewport (0.0-1.0). Default: 0.01
  --viewports=<list>   Comma-separated viewport names. Default: mobile,tablet,desktop,wide
                       Available: ${VIEWPORT_NAMES.join(', ')}
  --help, -h           Show this help

Exit codes:
  0  overall pass
  1  overall fail or error
`;

interface RawArgs {
  clone?: string;
  rebuilt?: string;
  out?: string;
  threshold?: string;
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
    if (key === 'clone' || key === 'rebuilt' || key === 'out' || key === 'threshold' || key === 'viewports') {
      out[key] = value;
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

function parseThreshold(raw: string | undefined): number {
  if (raw == null) return 0.01;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`--threshold must be a number between 0 and 1, got "${raw}"`);
  }
  return n;
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

  return {
    cloneDir,
    rebuiltDir,
    outDir,
    thresholdRatio: parseThreshold(raw.threshold),
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
