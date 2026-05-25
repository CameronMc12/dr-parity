/**
 * Load the crawler's Phase 2 output. Reads `graph.json` and returns a lazy
 * reader for per-state DOM so we don't blow memory on large crawls.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';

import type { CrawlGraph } from '../crawler/types';

/**
 * `domPath` in graph.json is written inconsistently across crawler writers:
 * `state-capture.ts` stores it repo-root-relative (e.g.
 * `docs/research/crawl/<host>/<ts>/states/state-0001/dom.html`), while
 * `route-recapture.ts` stores it crawlDir-relative (`states/state-0001/dom.html`).
 * It may also be absolute. Resolve tolerantly by trying ordered candidates and
 * returning the first that exists on disk.
 */
function resolveDomPath(domPath: string, stateId: string, crawlDir: string): string {
  const candidates = [
    isAbsolute(domPath) ? domPath : null,
    resolve(process.cwd(), domPath),
    join(crawlDir, domPath),
    join(crawlDir, 'states', stateId, basename(domPath)),
  ].filter((c): c is string => c !== null);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Fall back to the most-likely candidate so the caller surfaces a clear
  // ENOENT against a sensible path rather than a doubled one.
  return candidates[candidates.length - 1];
}

export interface LoadedGraph {
  graph: CrawlGraph;
  crawlDir: string;
  getStateDom: (stateId: string) => Promise<string>;
}

export async function loadCrawlGraph(crawlDir: string): Promise<LoadedGraph> {
  const absDir = resolve(crawlDir);
  const graphPath = join(absDir, 'graph.json');

  if (!existsSync(graphPath)) {
    throw new Error(`Crawl graph not found: ${graphPath}`);
  }

  const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as CrawlGraph;

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(`Malformed graph.json at ${graphPath}`);
  }

  const nodeIndex = new Map(graph.nodes.map((n) => [n.id, n]));

  const getStateDom = async (stateId: string): Promise<string> => {
    const node = nodeIndex.get(stateId);
    if (!node) throw new Error(`Unknown state id: ${stateId}`);
    const domPath = resolveDomPath(node.domPath, stateId, absDir);
    return readFile(domPath, 'utf8');
  };

  return { graph, crawlDir: absDir, getStateDom };
}
