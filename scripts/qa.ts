#!/usr/bin/env tsx
/**
 * CLI entry point for running QA pixel-diff comparison.
 *
 * Usage:
 *   npx tsx scripts/qa.ts <original-url> [--clone-url http://localhost:3000] [--threshold 5]
 */

import { chromium, type Browser } from 'playwright';
import {
  captureScreenshots,
  captureHoverStates,
  type HoverStyleRule,
  type HoverStateScreenshot,
} from '../engine/qa/screenshotter';
import {
  runFullDiff,
  runHoverDiff,
  type ScreenshotPair,
  type HoverDiffPair,
  type HoverDiffSummary,
} from '../engine/qa/pixel-diff';
import {
  loadMaskConfigFile,
  type RegionMask,
  type ContentMask,
  type MaskFireReport,
} from '../engine/qa/content-masker';
import { ProgressReporter } from '../engine/utils/progress';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { resolve, join } from 'path';
import type { PixelDiffResult, ViewportDiff } from '../engine/types/diff';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface QAArgs {
  originalUrl: string;
  cloneUrl: string;
  threshold: number;
  outputDir: string;
  maskSelectors: string[];
  maskConfigPath: string | null;
  skipHoverQA: boolean;
  pageDataPath: string | null;
}

const USAGE = [
  'Usage: npx tsx scripts/qa.ts <original-url> [options]',
  '',
  'Options:',
  '  --clone-url <url>          Clone URL (default http://localhost:3000)',
  '  --threshold <pct>          Allowed diff percent (default 5)',
  '  --output <dir>             Output dir (default docs/design-references/qa)',
  '  --mask <selector>          CSS selector to mask (overlay solid color). Repeatable.',
  '  --mask-config <path>       JSON file: { masks: [{ selector, viewports?, reason? }] }',
  '  --skip-hover-qa            Skip the hover-state QA pass',
  '  --page-data <path>         Path to page-data.json for hover rule extraction',
].join('\n');

function parseArgs(): QAArgs {
  const args = process.argv.slice(2);

  const originalUrl = args.find((a) => !a.startsWith('--'));
  if (!originalUrl) {
    console.error(USAGE);
    process.exit(1);
  }

  let cloneUrl = 'http://localhost:3000';
  const cloneIdx = args.indexOf('--clone-url');
  if (cloneIdx !== -1 && args[cloneIdx + 1]) {
    cloneUrl = args[cloneIdx + 1];
  }

  let threshold = 5;
  const threshIdx = args.indexOf('--threshold');
  if (threshIdx !== -1 && args[threshIdx + 1]) {
    const parsed = Number(args[threshIdx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) {
      threshold = parsed;
    }
  }

  let outputDir = 'docs/design-references/qa';
  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    outputDir = args[outIdx + 1];
  }

  // --mask <selector> (repeatable)
  const maskSelectors: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mask' && args[i + 1]) {
      maskSelectors.push(args[i + 1]!);
      i++;
    }
  }

  let maskConfigPath: string | null = null;
  const maskCfgIdx = args.indexOf('--mask-config');
  if (maskCfgIdx !== -1 && args[maskCfgIdx + 1]) {
    maskConfigPath = resolve(args[maskCfgIdx + 1]!);
  }

  const skipHoverQA = args.includes('--skip-hover-qa');

  let pageDataPath: string | null = null;
  const pdIdx = args.indexOf('--page-data');
  if (pdIdx !== -1 && args[pdIdx + 1]) {
    pageDataPath = resolve(args[pdIdx + 1]!);
  }

  return {
    originalUrl,
    cloneUrl,
    threshold,
    outputDir: resolve(outputDir),
    maskSelectors,
    maskConfigPath,
    skipHoverQA,
    pageDataPath,
  };
}

// ---------------------------------------------------------------------------
// Mask & hover helpers
// ---------------------------------------------------------------------------

async function buildContentMask(
  cliSelectors: string[],
  configPath: string | null,
): Promise<ContentMask | undefined> {
  const regionMasks: RegionMask[] = cliSelectors.map((selector) => ({
    selector,
    reason: 'CLI --mask',
  }));

  if (configPath) {
    const fromConfig = await loadMaskConfigFile(configPath);
    regionMasks.push(...fromConfig);
  }

  if (regionMasks.length === 0) return undefined;
  return { regionMasks };
}

function printMaskFireReports(reports: Record<string, MaskFireReport[]>): void {
  // Aggregate by selector across all sites/viewports for a clean summary.
  const aggregated = new Map<
    string,
    { totalMatches: number; reason?: string; firings: number }
  >();

  for (const list of Object.values(reports)) {
    for (const r of list) {
      const existing = aggregated.get(r.selector) ?? {
        totalMatches: 0,
        reason: r.reason,
        firings: 0,
      };
      existing.totalMatches += r.matchCount;
      existing.firings++;
      aggregated.set(r.selector, existing);
    }
  }

  if (aggregated.size === 0) return;

  console.log('  Content masks fired:');
  for (const [selector, info] of aggregated.entries()) {
    const reasonStr = info.reason ? ` — ${info.reason}` : '';
    console.log(
      `    ${selector}: ${info.totalMatches} elements across ${info.firings} captures${reasonStr}`,
    );
  }
  console.log('');
}

async function loadHoverRulesFromPageData(
  pageDataPath: string | null,
): Promise<HoverStyleRule[]> {
  if (!pageDataPath) return [];

  try {
    const raw = await readFile(pageDataPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      stylesheets?: { stylesheets?: Array<{ rules?: HoverStyleRule[] }> };
    };

    const sheets = parsed.stylesheets?.stylesheets ?? [];
    const rules: HoverStyleRule[] = [];
    for (const sheet of sheets) {
      for (const rule of sheet.rules ?? []) {
        if (rule.selector && rule.selector.includes(':hover')) {
          rules.push(rule);
        }
      }
    }
    return rules;
  } catch {
    console.warn(`  Warning: could not read page-data at ${pageDataPath}`);
    return [];
  }
}

interface HoverPassResult {
  summary: HoverDiffSummary;
  pairCount: number;
}

async function runHoverPass(
  browser: Browser,
  args: QAArgs,
): Promise<HoverPassResult | null> {
  const hoverRules = await loadHoverRulesFromPageData(args.pageDataPath);

  const hoverDir = join(args.outputDir, 'hover');
  await mkdir(hoverDir, { recursive: true });

  // Capture hovers on both original and clone (desktop only — keeps QA fast)
  const captureFor = async (
    url: string,
    site: 'original' | 'clone',
  ): Promise<HoverStateScreenshot[]> => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      return await captureHoverStates(page, {
        outputDir: join(hoverDir, site),
        hoverRules,
        viewport: 'desktop',
      });
    } finally {
      await ctx.close();
    }
  };

  const [origShots, cloneShots] = await Promise.all([
    captureFor(args.originalUrl, 'original'),
    captureFor(args.cloneUrl, 'clone'),
  ]);

  // Pair by selector + ordinal
  const cloneBySelector = new Map<string, HoverStateScreenshot[]>();
  for (const c of cloneShots) {
    const list = cloneBySelector.get(c.selector) ?? [];
    list.push(c);
    cloneBySelector.set(c.selector, list);
  }

  const pairs: HoverDiffPair[] = [];
  const cloneIdxBySelector = new Map<string, number>();
  for (const o of origShots) {
    const cloneList = cloneBySelector.get(o.selector);
    if (!cloneList) continue;
    const idx = cloneIdxBySelector.get(o.selector) ?? 0;
    const match = cloneList[idx];
    if (!match) continue;
    cloneIdxBySelector.set(o.selector, idx + 1);

    pairs.push({
      selector: o.selector,
      label: o.label,
      original: o.path,
      clone: match.path,
      viewport: o.viewport,
    });
  }

  if (pairs.length === 0) return null;

  const summary = await runHoverDiff(pairs, join(hoverDir, 'diffs'));
  return { summary, pairCount: pairs.length };
}

function printHoverSummary(result: HoverPassResult | null): void {
  if (!result) {
    console.log('  Hover QA: no comparable hover pairs found (skipped).');
    console.log('');
    return;
  }
  const { summary, pairCount } = result;
  const passCount = summary.results.filter((r) => r.passed).length;
  console.log('  Hover QA (informational):');
  console.log(
    `    ${passCount}/${pairCount} elements >= ${summary.threshold}% match — ` +
      `avg ${summary.averageMatchPercent}% — ${summary.passed ? 'PASS' : 'FAIL'}`,
  );
  // Print worst offenders
  const failing = summary.results
    .filter((r) => !r.passed)
    .sort((a, b) => a.matchPercent - b.matchPercent)
    .slice(0, 5);
  for (const f of failing) {
    console.log(
      `      [${f.matchPercent}%] ${f.selector} — "${f.label}" (${f.diffImage})`,
    );
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatViewportLine(
  name: string,
  diff: ViewportDiff | undefined,
): string {
  if (!diff) return '';

  const matchPercent = (100 - diff.percentDifferent).toFixed(1);
  const diffPercent = diff.percentDifferent.toFixed(1);
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const padded = `${label}:`.padEnd(9);
  const warning = diff.percentDifferent > 5 ? ' !!!' : '';

  return `  ${padded} ${matchPercent}% match (${diffPercent}% diff)${warning}`;
}

function printReport(result: PixelDiffResult, threshold: number): boolean {
  const diffs: ViewportDiff[] = [result.desktop];
  if (result.tablet) diffs.push(result.tablet);
  if (result.mobile) diffs.push(result.mobile);

  const avgDiff =
    diffs.reduce((sum, d) => sum + d.percentDifferent, 0) / diffs.length;
  const overallMatch = Number((100 - avgDiff).toFixed(1));
  const passed = overallMatch >= 100 - threshold;

  console.log('');
  console.log('  Dr Parity QA Report');
  console.log('  ==============================');
  console.log(formatViewportLine('desktop', result.desktop));
  if (result.tablet) console.log(formatViewportLine('tablet', result.tablet));
  if (result.mobile) console.log(formatViewportLine('mobile', result.mobile));
  console.log('');
  console.log(`  Overall: ${overallMatch}% \u2014 ${passed ? 'PASS' : 'FAIL'}`);
  console.log('');

  return passed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();
  const { originalUrl, cloneUrl, threshold, outputDir, skipHoverQA } = args;

  console.log(`Original: ${originalUrl}`);
  console.log(`Clone:    ${cloneUrl}`);
  console.log(`Threshold: ${threshold}%`);
  if (args.maskSelectors.length > 0) {
    console.log(`Masks (CLI): ${args.maskSelectors.join(', ')}`);
  }
  if (args.maskConfigPath) {
    console.log(`Mask config: ${args.maskConfigPath}`);
  }
  if (skipHoverQA) console.log('Hover QA: SKIPPED');
  console.log('');

  await mkdir(outputDir, { recursive: true });

  const contentMasks = await buildContentMask(args.maskSelectors, args.maskConfigPath);

  const phaseCount = skipHoverQA ? 4 : 5;
  const progress = new ProgressReporter(phaseCount);

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Capture screenshots
    progress.startPhase('Capturing screenshots');
    const screenshots = await captureScreenshots(browser, {
      originalUrl,
      cloneUrl,
      outputDir,
      contentMasks,
    });
    progress.endPhase();

    // 2. Build pairs
    progress.startPhase('Building comparison pairs');
    const pairs: ScreenshotPair[] = [
      {
        original: screenshots.original.desktop,
        clone: screenshots.clone.desktop,
        viewport: 'desktop',
      },
    ];
    if (screenshots.original.tablet && screenshots.clone.tablet) {
      pairs.push({
        original: screenshots.original.tablet,
        clone: screenshots.clone.tablet,
        viewport: 'tablet',
      });
    }
    if (screenshots.original.mobile && screenshots.clone.mobile) {
      pairs.push({
        original: screenshots.original.mobile,
        clone: screenshots.clone.mobile,
        viewport: 'mobile',
      });
    }
    progress.endPhase(`${pairs.length} viewport pairs`);

    // 3. Run pixel-diff
    progress.startPhase('Running pixel-diff');
    const result = await runFullDiff(pairs, { outputDir });
    progress.endPhase();

    // 4. Hover QA pass (informational, optional)
    let hoverResult: HoverPassResult | null = null;
    if (!skipHoverQA) {
      progress.startPhase('Capturing & comparing hover states');
      try {
        hoverResult = await runHoverPass(browser, args);
      } catch (err) {
        console.warn(`  Hover QA failed: ${(err as Error).message}`);
      }
      progress.endPhase(
        hoverResult ? `${hoverResult.pairCount} hover pairs compared` : 'no pairs',
      );
    }

    // 5. Write report JSON
    progress.startPhase('Writing report');
    const reportPath = join(outputDir, 'qa-report.json');
    const reportPayload = {
      ...result,
      maskReports: screenshots.maskReports ?? {},
      hoverDiff: hoverResult?.summary ?? null,
    };
    await writeFile(reportPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
    progress.endPhase(reportPath);

    progress.summary();

    // Print mask fire reports
    if (screenshots.maskReports) {
      printMaskFireReports(screenshots.maskReports);
    }

    // Print hover summary (informational, doesn't gate)
    if (!skipHoverQA) printHoverSummary(hoverResult);

    // Print pixel-diff summary and exit
    const passed = printReport(result, threshold);
    process.exit(passed ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('QA failed:', err);
  process.exit(1);
});
