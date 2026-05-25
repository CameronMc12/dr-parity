#!/usr/bin/env tsx
/**
 * Crawl completeness + gap report CLI.
 *
 * Reads a crawl directory (graph.json + states/ + network.jsonl + errors.jsonl,
 * all read defensively) and emits:
 *   - a completeness verdict (saturated vs under-crawled)
 *   - crawl-gap-report.md + crawl-gap-report.json (ranked gaps)
 *
 * Usage:
 *   tsx scripts/crawl-report.ts --crawl-dir=<path> [--out=<dir>]
 *   tsx scripts/crawl-report.ts <path>
 *   tsx scripts/crawl-report.ts --help
 *
 * Defaults: writes the report into the crawl directory itself.
 */

import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import { analyzeCrawl } from '../engine/verify/crawl-completeness';
import { writeCrawlReport } from '../engine/verify/crawl-report';

interface ParsedArgs {
  help: boolean;
  crawlDir: string | null;
  outDir: string | null;
}

const HELP = `Usage:
  tsx scripts/crawl-report.ts --crawl-dir=<path> [--out=<dir>]

Required:
  --crawl-dir=<path>   Crawl directory with graph.json (and optionally
                       network.jsonl, errors.jsonl, states/). A bare positional
                       path is also accepted.

Options:
  --out=<dir>          Where to write crawl-gap-report.md/.json.
                       Defaults to the crawl directory itself.
  --help               Show this help.`;

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { help: false, crawlDir: null, outDir: null };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      result.help = true;
    } else if (raw.startsWith('--crawl-dir=')) {
      result.crawlDir = raw.slice('--crawl-dir='.length);
    } else if (raw.startsWith('--out=')) {
      result.outDir = raw.slice('--out='.length);
    } else if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    } else if (result.crawlDir === null) {
      result.crawlDir = raw;
    } else {
      throw new Error(`Unexpected positional argument: ${raw}`);
    }
  }
  return result;
}

function assertValidCrawlDir(crawlDir: string): void {
  if (!existsSync(crawlDir)) {
    throw new Error(`Crawl directory does not exist: ${crawlDir}`);
  }
  if (!statSync(crawlDir).isDirectory()) {
    throw new Error(`Crawl path is not a directory: ${crawlDir}`);
  }
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(HELP);
    process.exit(2);
    return;
  }

  if (parsed.help || parsed.crawlDir === null) {
    console.log(HELP);
    process.exit(parsed.help ? 0 : 2);
    return;
  }

  const crawlDir = resolve(parsed.crawlDir);
  try {
    assertValidCrawlDir(crawlDir);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(2);
    return;
  }

  const outDir = parsed.outDir
    ? isAbsolute(parsed.outDir)
      ? parsed.outDir
      : resolve(parsed.outDir)
    : crawlDir;

  try {
    const report = await analyzeCrawl(crawlDir);
    const { mdPath, jsonPath } = writeCrawlReport(outDir, report);

    console.log('\nCrawl completeness report');
    console.log(`  Distinct routes:      ${report.distinctRoutes}`);
    console.log(`  Distinct states:      ${report.distinctStates}`);
    console.log(`  Total states:         ${report.totalStates}`);
    console.log(`  Total interactions:   ${report.totalInteractions}`);
    console.log(`  Dedup ratio:          ${(report.dedupRatio * 100).toFixed(0)}%`);
    console.log(
      `  Recent discovery:     ${(report.recentDiscoveryRate * 100).toFixed(0)}%`,
    );
    console.log(`  Saturated:            ${report.saturated ? 'yes' : 'no'}`);
    console.log(`  Verdict: ${report.verdict}`);
    console.log('\n  Gaps:');
    console.log(`    uncaptured targets: ${report.gapCounts['uncaptured-target']}`);
    console.log(`    referenced routes:  ${report.gapCounts['referenced-route']}`);
    console.log(`    unfollowed popups:  ${report.gapCounts['unfollowed-popup']}`);
    console.log(`    errored states:     ${report.gapCounts['errored-state']}`);
    console.log(`    empty states:       ${report.gapCounts['empty-state']}`);
    if (report.warnings.length > 0) {
      console.log(`\n  Warnings: ${report.warnings.length}`);
      for (const w of report.warnings.slice(0, 8)) console.log(`    - ${w}`);
    }
    console.log(`\n  Wrote:\n    ${mdPath}\n    ${jsonPath}`);
  } catch (err) {
    console.error(`crawl:report failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
