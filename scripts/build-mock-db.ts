/**
 * build:mock-db — assemble a normalized mock database for the ClickUp
 * seed-workspace React clone from REAL captured network responses.
 *
 *   npm run build:mock-db                       # newest seed-smoke run + seed-smoke-1
 *   npm run build:mock-db -- --run=<dir>        # explicit run dir(s), comma-separated
 *   npm run build:mock-db -- --out=<dir>        # primary output dir
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildMockDb } from '../engine/analyze/mock-db/build.js';

const REPO = resolve(import.meta.dirname, '..');
const CRAWL_ROOT = join(REPO, 'docs/research/crawl/app.clickup.com');
const MANIFEST = join(REPO, 'docs/research/clickup-parity/seed/seed-manifest.json');
const ENDPOINTS = join(REPO, 'docs/research/clickup-parity/surface-map/endpoints.json');
const PRIMARY_OUT = join(REPO, 'clones/clickup-seed-react/src/mock');
const INSPECT_OUT = join(REPO, 'docs/research/clickup-parity/mock-db');

function parseFlag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

/** Pick run dirs: --run override, else newest seed-smoke-* (+ a sibling for coverage). */
function resolveRunDirs(): string[] {
  const flag = parseFlag('run');
  if (flag) {
    return flag.split(',').map((d) => (d.startsWith('/') ? d : join(CRAWL_ROOT, d)));
  }
  const seedRuns = readdirSync(CRAWL_ROOT)
    .filter((d) => d.startsWith('seed-smoke-'))
    .map((d) => join(CRAWL_ROOT, d))
    .filter((d) => existsSync(join(d, 'network.jsonl')))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!seedRuns.length) throw new Error('No seed-smoke-* run with network.jsonl found.');
  // merge all seed-smoke runs to maximise entity coverage
  return seedRuns;
}

function writeJson(dir: string, name: string, data: unknown): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2));
}

function writeText(dir: string, name: string, text: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), text);
}

async function main(): Promise<void> {
  const runDirs = resolveRunDirs();
  const outDir = parseFlag('out') ? resolve(parseFlag('out')!) : PRIMARY_OUT;

  console.log('[mock-db] runs:');
  for (const d of runDirs) console.log('   -', d.replace(REPO + '/', ''));

  const result = await buildMockDb({
    runDirs,
    manifestPath: MANIFEST,
    endpointsPath: ENDPOINTS,
  });

  for (const target of [outDir, INSPECT_OUT]) {
    writeJson(target, 'mock-db.json', result.db);
    writeJson(target, 'endpoint-map.json', result.endpointMap);
    writeText(target, 'coverage.md', result.coverage.markdown);
    writeText(target, 'README.md', result.readme);
  }

  const c = result.coverage.entityCounts;
  console.log('\n[mock-db] parsed responses:', result.capturedCount);
  console.log('[mock-db] entity counts:');
  for (const [k, v] of Object.entries(c)) console.log(`   ${k.padEnd(14)} ${v}`);
  console.log('[mock-db] workspace:', result.db.workspace ? result.db.workspace.id : 'MISSING');

  const capturedTasks = Object.values(result.db.tasks).filter((t) => t._source === 'captured').length;
  const fixtureTasks = Object.values(result.db.tasks).filter((t) => t._source === 'fixture').length;
  console.log(`[mock-db] tasks: ${capturedTasks} captured, ${fixtureTasks} fixture-filled`);
  console.log(`[mock-db] seed ids found: ${result.coverage.seedFound.length}, missing: ${result.coverage.seedMissing.length}`);
  if (result.coverage.seedMissing.length) {
    console.log('   missing:', result.coverage.seedMissing.join(', '));
  }
  console.log(`[mock-db] endpoint gaps (no captured response): ${result.gapCount}`);
  console.log('\n[mock-db] wrote:');
  console.log('   ', join(outDir, 'mock-db.json').replace(REPO + '/', ''));
  console.log('   ', join(INSPECT_OUT, 'mock-db.json').replace(REPO + '/', ''));
}

main().catch((err) => {
  console.error('[mock-db] FAILED:', err);
  process.exit(1);
});
