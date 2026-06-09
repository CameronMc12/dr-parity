/**
 * Defensive readers for a crawl run directory. Tolerates malformed JSONL,
 * missing files, and base64 bodies. Reports which expected inputs were absent.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { forEachJsonlLine, isRequest, isResponse } from '../surface-map/jsonl.js';
import type { NetworkRequestLine, NetworkResponseLine } from '../surface-map/types.js';

export type RunInputs = {
  hasNetwork: boolean;
  hasGraph: boolean;
  hasSummary: boolean;
  hasStates: boolean;
  missing: string[];
};

const CRAWL_ROOT = 'docs/research/crawl/app.clickup.com';

/** Resolve the run dir: explicit `--run`, or the most recent run with states. */
export function resolveRunDir(repoRoot: string, runFlag?: string): string {
  if (runFlag) {
    const abs = runFlag.startsWith('/') ? runFlag : join(repoRoot, runFlag);
    if (!existsSync(abs)) throw new Error(`run dir not found: ${abs}`);
    return abs;
  }
  const root = join(repoRoot, CRAWL_ROOT);
  if (!existsSync(root)) throw new Error(`crawl root not found: ${root}`);
  const candidates = readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => {
      try {
        return statSync(p).isDirectory() && existsSync(join(p, 'network.jsonl'));
      } catch {
        return false;
      }
    })
    .map((p) => ({ p, mtime: statSync(join(p, 'network.jsonl')).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) throw new Error(`no runs with network.jsonl under ${root}`);
  return candidates[0].p;
}

export function inspectInputs(runDir: string): RunInputs {
  const probe = (rel: string) => existsSync(join(runDir, rel));
  const hasNetwork = probe('network.jsonl');
  const hasGraph = probe('graph.json');
  const hasSummary = probe('summary.json');
  const statesDir = join(runDir, 'states');
  const hasStates =
    existsSync(statesDir) &&
    readdirSync(statesDir).some((d) => d.startsWith('state-'));
  const missing: string[] = [];
  if (!hasNetwork) missing.push('network.jsonl');
  if (!hasGraph) missing.push('graph.json');
  if (!hasSummary) missing.push('summary.json');
  if (!hasStates) missing.push('states/');
  return { hasNetwork, hasGraph, hasSummary, hasStates, missing };
}

export type ParsedNetwork = {
  requests: NetworkRequestLine[];
  responses: NetworkResponseLine[];
  malformedLines: number;
};

/** Stream network.jsonl, collecting requests + responses defensively. */
export async function readNetwork(runDir: string): Promise<ParsedNetwork> {
  const file = join(runDir, 'network.jsonl');
  const requests: NetworkRequestLine[] = [];
  const responses: NetworkResponseLine[] = [];
  let malformedLines = 0;
  if (!existsSync(file)) return { requests, responses, malformedLines };
  await forEachJsonlLine(file, (line) => {
    if (isRequest(line)) requests.push(line);
    else if (isResponse(line)) responses.push(line);
    else malformedLines += 1;
  });
  return { requests, responses, malformedLines };
}

export type GraphNode = { id?: string; url?: string };

/** Read graph.json node URLs defensively. */
export function readGraphUrls(runDir: string): string[] {
  const file = join(runDir, 'graph.json');
  if (!existsSync(file)) return [];
  try {
    const graph = JSON.parse(readFileSync(file, 'utf8')) as { nodes?: GraphNode[] };
    return (graph.nodes ?? [])
      .map((n) => (typeof n.url === 'string' ? n.url : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type StateMeta = Record<string, unknown> & { sourceKind?: string };

/** Read every state's meta.json, skipping unreadable ones. */
export function readStateMetas(runDir: string): StateMeta[] {
  const statesDir = join(runDir, 'states');
  if (!existsSync(statesDir)) return [];
  const out: StateMeta[] = [];
  for (const dir of readdirSync(statesDir)) {
    if (!dir.startsWith('state-')) continue;
    const metaPath = join(statesDir, dir, 'meta.json');
    if (!existsSync(metaPath)) continue;
    try {
      out.push(JSON.parse(readFileSync(metaPath, 'utf8')) as StateMeta);
    } catch {
      // skip malformed meta
    }
  }
  return out;
}
