/**
 * Load the crawler's Phase 2 output. Reads `graph.json` and returns a lazy
 * reader for per-state DOM so we don't blow memory on large crawls.
 */

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { CrawlGraph } from '../crawler/types';

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
    const domPath = node.domPath.startsWith('/')
      ? node.domPath
      : join(absDir, node.domPath);
    return readFile(domPath, 'utf8');
  };

  return { graph, crawlDir: absDir, getStateDom };
}
