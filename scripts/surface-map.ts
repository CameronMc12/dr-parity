#!/usr/bin/env tsx
/**
 * Phase 1 "Static Surface Map" extractor for the ClickUp clone pipeline.
 *
 * Produces a definitive crawler manifest (API endpoints + app routes + NgRx
 * actions) derived entirely from on-disk capture data. Additive — touches no
 * existing engine extract/analyze/generate/qa code.
 *
 * Usage:
 *   npm run surface-map
 *   npm run surface-map -- --no-wakaru
 *   npm run surface-map -- --crawl-dir=docs/research/crawl/app.clickup.com
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { EndpointAccumulator, countEndpoints } from '@engine/analyze/surface-map/endpoints.js';
import {
  ObservedRouteAccumulator,
  extractRouteDefinitions,
} from '@engine/analyze/surface-map/routes.js';
import { extractActions, countActions } from '@engine/analyze/surface-map/actions.js';
import { selectChunks, runWakaru } from '@engine/analyze/surface-map/wakaru.js';
import { forEachJsonlLine } from '@engine/analyze/surface-map/jsonl.js';
import {
  endpointsMarkdown,
  routesMarkdown,
  actionsMarkdown,
  indexMarkdown,
} from '@engine/analyze/surface-map/markdown.js';
import type {
  NetworkRequestLine,
  NetworkResponseLine,
  RoutesResult,
} from '@engine/analyze/surface-map/types.js';

const DEFAULT_CRAWL_DIR = 'docs/research/crawl/app.clickup.com';
const BUNDLE_SUBPATH = 'replay-merged/_ext/app-cdn.clickup.com';
const OUT_DIR = 'docs/research/clickup-parity/surface-map';

function parseArgs(argv: string[]) {
  let crawlDir = DEFAULT_CRAWL_DIR;
  let runWakaruStep = true;
  for (const arg of argv) {
    if (arg === '--no-wakaru') runWakaruStep = false;
    else if (arg.startsWith('--crawl-dir=')) crawlDir = arg.slice('--crawl-dir='.length);
  }
  return { crawlDir: resolve(crawlDir), runWakaruStep };
}

function findJsonlFiles(crawlDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === BUNDLE_SUBPATH.split('/')[0]) continue; // skip replay-merged tree
        walk(full);
      } else if (name === 'network.jsonl') {
        out.push(full);
      }
    }
  };
  walk(crawlDir);
  return out;
}

function findBundleFiles(crawlDir: string): string[] {
  const dir = join(crawlDir, BUNDLE_SUBPATH);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.js'))
    .map((n) => join(dir, n));
}

function writeJson(path: string, data: unknown) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const { crawlDir, runWakaruStep } = parseArgs(process.argv.slice(2));

  if (!existsSync(crawlDir)) {
    console.error(`[surface-map] crawl dir not found: ${crawlDir}`);
    process.exit(1);
  }

  const jsonlFiles = findJsonlFiles(crawlDir);
  const bundleFiles = findBundleFiles(crawlDir);

  if (jsonlFiles.length === 0) {
    console.error(`[surface-map] no network.jsonl files under ${crawlDir}`);
    process.exit(1);
  }
  if (bundleFiles.length === 0) {
    console.warn(`[surface-map] WARN: no bundles under ${join(crawlDir, BUNDLE_SUBPATH)} — routes/actions will be empty`);
  }

  console.log(`[surface-map] ${jsonlFiles.length} network.jsonl files, ${bundleFiles.length} bundles`);

  const endpointAcc = new EndpointAccumulator();
  const observedAcc = new ObservedRouteAccumulator();
  let lineCount = 0;

  for (const file of jsonlFiles) {
    await forEachJsonlLine(file, (line) => {
      lineCount += 1;
      const typed = line as NetworkRequestLine | NetworkResponseLine;
      endpointAcc.add(typed);
      observedAcc.add(typed);
    });
  }
  console.log(`[surface-map] streamed ${lineCount} network lines`);

  const endpoints = endpointAcc.result();
  const routes: RoutesResult = {
    routeDefinitions: extractRouteDefinitions(bundleFiles),
    observedRoutes: observedAcc.result(),
  };
  const actions = extractActions(bundleFiles);

  mkdirSync(OUT_DIR, { recursive: true });

  const caveats: string[] = [
    'Endpoint shapes are inferred from the first observed request/response only (depth ≤ 4).',
    'Path templates tokenize ids/uuids/hashes/viewIds heuristically; meaningful path words are preserved.',
    'Route definitions are scraped from minified bundles; nesting is flattened (each `path:` literal listed independently).',
    'Action types are heuristic NgRx `[Source] Event` literals; some log strings may slip through or be filtered out.',
  ];

  let wakaru = [] as ReturnType<typeof runWakaru>;
  if (runWakaruStep && bundleFiles.length > 0) {
    const candidates = selectChunks(bundleFiles);
    console.log(`[surface-map] wakaru: unpacking ${candidates.length} high-value chunks`);
    wakaru = runWakaru(candidates, join(OUT_DIR, 'wakaru'));
  } else {
    caveats.push('Wakaru unpacking skipped (--no-wakaru or no bundles).');
  }

  writeJson(join(OUT_DIR, 'endpoints.json'), endpoints);
  writeJson(join(OUT_DIR, 'routes.json'), routes);
  writeJson(join(OUT_DIR, 'actions.json'), actions);

  writeFileSync(join(OUT_DIR, 'endpoints.md'), endpointsMarkdown(endpoints), 'utf8');
  writeFileSync(join(OUT_DIR, 'routes.md'), routesMarkdown(routes), 'utf8');
  writeFileSync(join(OUT_DIR, 'actions.md'), actionsMarkdown(actions), 'utf8');
  writeFileSync(
    join(OUT_DIR, 'INDEX.md'),
    indexMarkdown({
      endpoints,
      routes,
      actions,
      wakaru,
      jsonlFileCount: jsonlFiles.length,
      bundleCount: bundleFiles.length,
      caveats,
    }),
    'utf8',
  );

  console.log('[surface-map] done:');
  console.log(`  endpoints: ${countEndpoints(endpoints)} across ${Object.keys(endpoints).length} services`);
  console.log(`  routes:    ${routes.routeDefinitions.length} defs, ${routes.observedRoutes.length} observed`);
  console.log(`  actions:   ${countActions(actions)} across ${actions.length} namespaces`);
  console.log(`  wakaru:    ${wakaru.filter((w) => w.status === 'unpacked').length}/${wakaru.length} unpacked`);
  console.log(`  output:    ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('[surface-map] fatal:', err);
  process.exit(1);
});
