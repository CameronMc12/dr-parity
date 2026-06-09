/**
 * coverage-report — after a crawl run, report what fraction of the Phase 1
 * Static Surface Map was actually exercised, and list what was MISSED.
 *
 * Usage:
 *   npm run coverage-report                       # most recent run with network.jsonl
 *   npm run coverage-report -- --run=<run-dir>    # explicit run dir (abs or repo-relative)
 */

import { resolve } from 'node:path';
import { generateCoverage } from '../engine/analyze/coverage/report.js';
import { resolveRunDir } from '../engine/analyze/coverage/run-reader.js';

function parseRunFlag(argv: string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('--run=')) return arg.slice('--run='.length);
  }
  const idx = argv.indexOf('--run');
  if (idx !== -1 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

async function main(): Promise<void> {
  const repoRoot = resolve(__dirname, '..');
  const runFlag = parseRunFlag(process.argv.slice(2));

  let runDir: string;
  try {
    runDir = resolveRunDir(repoRoot, runFlag);
  } catch (error) {
    console.error(`[coverage-report] ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  console.log(`[coverage-report] run dir: ${runDir}`);
  const { report, outDir } = await generateCoverage(repoRoot, runDir);

  const { endpoint, route, interaction } = report;
  if (report.missingInputs.length > 0) {
    console.warn(`[coverage-report] missing inputs: ${report.missingInputs.join(', ')}`);
  }
  console.log(`[coverage-report] endpoints: ${endpoint.overall.hit}/${endpoint.overall.total} (${endpoint.overall.pct}%)`);
  console.log(`[coverage-report] routes:    ${route.overall.hit}/${route.overall.total} (${route.overall.pct}%)`);
  console.log(`[coverage-report] states:    ${interaction.totalStates}`);
  for (const cls of interaction.emptyClasses) {
    console.warn(`[coverage-report] interaction hole: '${cls}' never fired`);
  }
  console.log(`[coverage-report] new endpoint discoveries: ${endpoint.newDiscoveries.length}`);
  console.log(`[coverage-report] written to: ${outDir}`);
}

main().catch((error) => {
  console.error('[coverage-report] failed:', error);
  process.exit(1);
});
