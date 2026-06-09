#!/usr/bin/env tsx
/**
 * Merge MULTIPLE webapp crawl directories into ONE combined crawl dir that the
 * existing `build:webapp` (scripts/build.ts --target=webapp --crawl-dir=<dir>)
 * consumes unchanged.
 *
 * WHY: build.ts accepts a single crawl dir, but ClickUp views (board, calendar,
 * gantt, list, timeline, table, doc) each live on a distinct URL captured in its
 * own crawl. The shell-split step needs MULTIPLE route nodes that share the same
 * shell to detect shell-vs-content. This script unions several crawls so they all
 * sit under one graph.json before building.
 *
 * Additive + no-regression: this is a brand-new script. It does NOT touch the
 * crawler, build.ts, or any emitter. It only reads input crawl dirs and writes a
 * fresh merged dir.
 *
 * What it produces in <mergedDir>:
 *   - graph.json        — schemaVersion 2; per-crawl-prefixed + canonicalKey-deduped
 *                         nodes; remapped edges (fromStateId/toStateId).
 *   - states/<newId>/   — every kept node's state dir copied under its new id.
 *   - network.jsonl     — streamed concat of all inputs, deduped by record
 *                         fingerprint. NEVER fully parsed into memory.
 *   - storage-state.json— from the input crawl with the most localStorage entries.
 *   - summary.json      — synthesized counts.
 *   - signatures.json   — copied/merged if present (empty ok).
 */

import {
  createReadStream,
  createWriteStream,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, isAbsolute, join, resolve } from 'node:path';

import type { CrawlGraph, StateEdge, StateNode } from '../engine/targets/webapp/crawler/types';
import { CRAWL_GRAPH_SCHEMA_VERSION } from '../engine/targets/webapp/crawler/types';

interface MergeArgs {
  outDir: string;
  crawlDirs: string[];
}

interface PerCrawlCount {
  crawlDir: string;
  prefix: string;
  rawNodes: number;
  keptNodes: number;
}

const STATE_PATH_FIELDS = ['domPath', 'screenshotPath', 'ariaPath'] as const;

function parseArgs(argv: string[]): MergeArgs {
  let outDir: string | null = null;
  const crawlDirs: string[] = [];

  for (const raw of argv) {
    if (raw.startsWith('--out=')) {
      outDir = raw.slice('--out='.length);
    } else if (raw.startsWith('--out-dir=')) {
      outDir = raw.slice('--out-dir='.length);
    } else if (raw.startsWith('--crawl-dir=')) {
      crawlDirs.push(raw.slice('--crawl-dir='.length));
    } else if (raw.startsWith('--')) {
      throw new Error(`Unknown flag: ${raw}`);
    } else {
      crawlDirs.push(raw);
    }
  }

  if (!outDir || outDir.length === 0) {
    throw new Error('Missing required flag: --out=<mergedDir>');
  }
  if (crawlDirs.length === 0) {
    throw new Error('No input crawl dirs supplied. Pass them as positionals or repeatable --crawl-dir=.');
  }

  return { outDir: resolve(outDir), crawlDirs: crawlDirs.map((d) => resolve(d)) };
}

/** Read + validate an input crawl's graph.json. Fail-fast with a clear message. */
function readInputGraph(crawlDir: string): CrawlGraph {
  if (!existsSync(crawlDir) || !statSync(crawlDir).isDirectory()) {
    throw new Error(`Input crawl dir not found or not a directory: ${crawlDir}`);
  }
  const graphPath = join(crawlDir, 'graph.json');
  if (!existsSync(graphPath)) {
    throw new Error(`Input crawl is missing graph.json: ${graphPath}`);
  }
  const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as CrawlGraph;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(`Malformed graph.json (missing nodes/edges arrays): ${graphPath}`);
  }
  return graph;
}

/**
 * Rewrite a node's repo-relative state path to point at the merged dir. Inputs
 * store paths repo-root-relative (e.g.
 * `docs/research/crawl/<host>/<ts>/states/<oldId>/dom.html`); we keep the same
 * repo-relative style but swap the segment ending in `states/<oldId>` for the
 * merged dir's `states/<newId>`, preserving the trailing filename.
 */
function rewriteStatePath(
  originalPath: string,
  oldId: string,
  newId: string,
  mergedStatesRelDir: string,
): string {
  const file = basename(originalPath);
  return `${mergedStatesRelDir}/${newId}/${file}`;
}

/**
 * The repo-relative directory of the merged states dir (POSIX style, matching how
 * the crawler stores `docs/research/crawl/...`). Falls back to an absolute path if
 * the merged dir lives outside the repo.
 */
function mergedStatesRelativeDir(absOut: string): string {
  const cwd = process.cwd();
  const statesAbs = join(absOut, 'states');
  if (statesAbs.startsWith(cwd + '/')) {
    return statesAbs.slice(cwd.length + 1).split('\\').join('/');
  }
  return statesAbs.split('\\').join('/');
}

interface MergeNodesResult {
  nodes: StateNode[];
  edges: StateEdge[];
  perCrawl: PerCrawlCount[];
  dedupedCount: number;
  routeUrls: string[];
}

/**
 * Prefix every node id per input crawl, remap edges, copy each kept node's state
 * dir into the merged dir, rewrite its state paths, and dedupe by canonicalKey
 * across crawls (first occurrence wins). Nodes without a canonicalKey are keyed
 * by their absolute URL so distinct view URLs never collapse.
 */
function mergeNodes(
  graphs: { graph: CrawlGraph; crawlDir: string }[],
  absOut: string,
): MergeNodesResult {
  const statesRelDir = mergedStatesRelativeDir(absOut);
  const nodes: StateNode[] = [];
  const edges: StateEdge[] = [];
  const perCrawl: PerCrawlCount[] = [];
  const seenCanonical = new Set<string>();
  let dedupedCount = 0;

  graphs.forEach(({ graph, crawlDir }, crawlIndex) => {
    const prefix = `c${crawlIndex}_`;
    const idRemap = new Map<string, string>(); // oldId -> newId for kept nodes
    let keptNodes = 0;

    for (const node of graph.nodes) {
      const dedupKey = node.canonicalKey ?? `url:${node.url}`;
      if (seenCanonical.has(dedupKey)) {
        dedupedCount += 1;
        continue;
      }
      seenCanonical.add(dedupKey);

      const newId = `${prefix}${node.id}`;
      idRemap.set(node.id, newId);

      const srcStateDir = join(crawlDir, 'states', node.id);
      const destStateDir = join(absOut, 'states', newId);
      if (existsSync(srcStateDir)) {
        cpSync(srcStateDir, destStateDir, { recursive: true });
      }

      const rewritten: StateNode = { ...node, id: newId };
      for (const field of STATE_PATH_FIELDS) {
        const value = node[field];
        if (typeof value === 'string' && value.length > 0) {
          rewritten[field] = rewriteStatePath(value, node.id, newId, statesRelDir);
        }
      }
      nodes.push(rewritten);
      keptNodes += 1;
    }

    // Remap edges whose BOTH endpoints survived dedup in this crawl. An edge to a
    // deduped duplicate is dropped (its target lives under the first crawl's id).
    for (const edge of graph.edges) {
      const from = idRemap.get(edge.fromStateId);
      const to = idRemap.get(edge.toStateId);
      if (from && to) {
        edges.push({ ...edge, fromStateId: from, toStateId: to });
      }
    }

    perCrawl.push({ crawlDir, prefix, rawNodes: graph.nodes.length, keptNodes });
  });

  const routeUrls = Array.from(new Set(nodes.map((n) => n.url))).sort();
  return { nodes, edges, perCrawl, dedupedCount, routeUrls };
}

/** Fingerprint a single network.jsonl record for cross-crawl dedup. */
function recordFingerprint(line: string): string | null {
  let rec: { kind?: string; method?: string; url?: string; status?: number | string };
  try {
    rec = JSON.parse(line) as typeof rec;
  } catch {
    return null;
  }
  const kind = rec.kind ?? '';
  const url = rec.url ?? '';
  if (kind === 'request') return `request|${(rec.method ?? '').toUpperCase()}|${url}`;
  if (kind === 'response') return `response|${rec.status ?? ''}|${url}`;
  return `${kind}|${url}`;
}

/**
 * Stream every input's network.jsonl line-by-line into the merged file, deduping
 * by record fingerprint. NEVER reads a whole network.jsonl into memory — only the
 * fingerprint set grows, and that holds short strings, not bodies.
 */
async function mergeNetwork(crawlDirs: string[], absOut: string): Promise<{ written: number; total: number }> {
  const outPath = join(absOut, 'network.jsonl');
  const out = createWriteStream(outPath, { encoding: 'utf8' });
  const seen = new Set<string>();
  let written = 0;
  let total = 0;

  try {
    for (const crawlDir of crawlDirs) {
      const netPath = join(crawlDir, 'network.jsonl');
      if (!existsSync(netPath)) continue;

      const rl = createInterface({
        input: createReadStream(netPath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim().length === 0) continue;
        total += 1;
        const fp = recordFingerprint(line);
        if (fp !== null) {
          if (seen.has(fp)) continue;
          seen.add(fp);
        }
        if (!out.write(line + '\n')) {
          await new Promise<void>((res) => out.once('drain', res));
        }
        written += 1;
      }
      rl.close();
    }
  } finally {
    await new Promise<void>((res, rej) => out.end((err?: Error | null) => (err ? rej(err) : res())));
  }

  return { written, total };
}

/** Count localStorage entries in a storage-state.json; -1 on any failure. */
function countLocalStorage(crawlDir: string): number {
  const p = join(crawlDir, 'storage-state.json');
  if (!existsSync(p)) return -1;
  try {
    const data = JSON.parse(readFileSync(p, 'utf8')) as {
      origins?: { localStorage?: unknown[] }[];
      storageState?: { origins?: { localStorage?: unknown[] }[] };
    };
    const origins = data.storageState?.origins ?? data.origins ?? [];
    return origins.reduce((sum, o) => sum + (o.localStorage?.length ?? 0), 0);
  } catch {
    return -1;
  }
}

/**
 * Pick the storage-state.json from the input crawl with the most localStorage
 * entries; on a tie or unreadable shape, fall back to the largest file. Copy it
 * into the merged dir. Returns the chosen crawl dir, or null if none had one.
 */
function copyBestStorageState(crawlDirs: string[], absOut: string): string | null {
  let best: { crawlDir: string; ls: number; bytes: number } | null = null;

  for (const crawlDir of crawlDirs) {
    const p = join(crawlDir, 'storage-state.json');
    if (!existsSync(p)) continue;
    const ls = countLocalStorage(crawlDir);
    const bytes = statSync(p).size;
    const better =
      best === null ||
      ls > best.ls ||
      (ls === best.ls && bytes > best.bytes);
    if (better) best = { crawlDir, ls, bytes };
  }

  if (!best) return null;
  cpSync(join(best.crawlDir, 'storage-state.json'), join(absOut, 'storage-state.json'));
  return best.crawlDir;
}

/** Merge signatures.json across inputs (union of signature strings). Empty ok. */
function mergeSignatures(crawlDirs: string[], absOut: string): void {
  const signatures = new Set<string>();
  for (const crawlDir of crawlDirs) {
    const p = join(crawlDir, 'signatures.json');
    if (!existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, 'utf8')) as { signatures?: string[] };
      for (const s of data.signatures ?? []) signatures.add(s);
    } catch {
      // skip unreadable signature file
    }
  }
  writeFileSync(
    join(absOut, 'signatures.json'),
    JSON.stringify({ signatures: Array.from(signatures) }, null, 2),
  );
}

export async function mergeWebappCrawls(args: MergeArgs): Promise<void> {
  const { outDir: absOut, crawlDirs } = args;

  if (crawlDirs.some((d) => absOut === d || absOut.startsWith(d + '/'))) {
    throw new Error('Refusing to write the merged dir inside one of the input crawl dirs.');
  }

  mkdirSync(join(absOut, 'states'), { recursive: true });

  const graphs = crawlDirs.map((crawlDir) => ({ crawlDir, graph: readInputGraph(crawlDir) }));

  const { nodes, edges, perCrawl, dedupedCount, routeUrls } = mergeNodes(graphs, absOut);

  if (nodes.length === 0) {
    throw new Error('Merged graph has zero nodes — every input node was empty or deduped away.');
  }

  const first = graphs[0].graph;
  const mergedGraph: CrawlGraph = {
    schemaVersion: CRAWL_GRAPH_SCHEMA_VERSION,
    nodes,
    edges,
    startUrl: first.startUrl ?? nodes[0].url,
    userAgent: first.userAgent ?? '',
    viewport: first.viewport ?? '',
  };
  writeFileSync(join(absOut, 'graph.json'), JSON.stringify(mergedGraph, null, 2));

  const net = await mergeNetwork(crawlDirs, absOut);
  const storageSource = copyBestStorageState(crawlDirs, absOut);
  mergeSignatures(crawlDirs, absOut);

  writeFileSync(
    join(absOut, 'summary.json'),
    JSON.stringify(
      {
        stateCount: nodes.length,
        edgeCount: edges.length,
        mergedFrom: crawlDirs.length,
        dedupedNodes: dedupedCount,
        networkRecords: net.written,
        networkRecordsBeforeDedup: net.total,
        finishedAt: new Date().toISOString(),
        reachedLimit: 'queue-empty' as const,
      },
      null,
      2,
    ),
  );

  console.log('\nMerged webapp crawls:');
  for (const c of perCrawl) {
    console.log(`  ${c.prefix} ${c.crawlDir}: ${c.rawNodes} nodes -> ${c.keptNodes} kept`);
  }
  console.log(`\nTotal merged nodes: ${nodes.length} (deduped ${dedupedCount} across crawls)`);
  console.log(`Merged edges: ${edges.length}`);
  console.log(
    `Network records: ${net.written} written / ${net.total} read (deduped ${net.total - net.written})`,
  );
  console.log(`Storage-state source: ${storageSource ?? 'none found'}`);
  console.log(`\nDistinct route URLs in merged graph (${routeUrls.length}):`);
  for (const u of routeUrls) console.log(`  - ${u}`);
  console.log(`\nWrote merged crawl dir: ${absOut}`);
}

async function main(): Promise<void> {
  let args: MergeArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    console.error(
      '\nUsage:\n  npm run merge:webapp -- --out=<mergedDir> <crawlDir1> <crawlDir2> ...\n' +
        '  npm run merge:webapp -- --out=<mergedDir> --crawl-dir=<dir1> --crawl-dir=<dir2>',
    );
    process.exit(2);
    return;
  }

  try {
    await mergeWebappCrawls(args);
  } catch (err) {
    console.error(`merge:webapp failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

const invokedDirectly = (() => {
  try {
    const entry = process.argv[1] ?? '';
    return entry.endsWith('/scripts/merge-webapp-crawls.ts') ||
      entry.endsWith('\\scripts\\merge-webapp-crawls.ts');
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main();
}
