/**
 * Parity state specs: the list of (route, interaction) pairs that BOTH the
 * reference and candidate are driven through so every avenue scores the same
 * states. Loaded from an explicit states file or derived from a crawl graph.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrawlGraph } from '../../targets/webapp/crawler/types';

export type StateInteraction = {
  label: string;
  kind: 'click' | 'hover';
  selector: string;
};

export type ParityState = {
  /** Stable id used in output paths and gap labels. */
  id: string;
  /** Path or full URL fragment appended to each base. e.g. "/" or "/inbox". */
  path: string;
  /** Human label. Defaults to path. */
  label: string;
  /** Optional interactions exercised within this state. */
  interactions: StateInteraction[];
};

export type StatesFile = {
  states?: ParityState[];
  /** Back-compat: accept a `routes` key too. */
  routes?: ParityState[];
};

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'root';
}

function pathFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url.startsWith('/') ? url : `/${url}`;
  }
}

/** Load an explicit states/routes file. */
export async function loadStatesFile(path: string): Promise<ParityState[]> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as StatesFile | ParityState[];
  const list = Array.isArray(parsed) ? parsed : parsed.states ?? parsed.routes;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`States file ${path} contains no states`);
  }
  return list.map((s, i) => ({
    id: s.id ?? slugify(s.path ?? `state-${i}`),
    path: s.path,
    label: s.label ?? s.path,
    interactions: s.interactions ?? [],
  }));
}

/** Derive states from a crawl graph.json (one per unique node URL). */
export async function loadStatesFromCrawl(crawlDir: string): Promise<ParityState[]> {
  const graphPath = join(crawlDir, 'graph.json');
  const raw = await readFile(graphPath, 'utf8');
  const graph = JSON.parse(raw) as CrawlGraph;

  const byUrl = new Map<string, ParityState>();
  const nodeUrlById = new Map<string, string>();

  for (const node of graph.nodes ?? []) {
    nodeUrlById.set(node.id, node.url);
    const path = pathFromUrl(node.url);
    if (!byUrl.has(node.url)) {
      byUrl.set(node.url, {
        id: slugify(path),
        path,
        label: node.title || path,
        interactions: [],
      });
    }
  }

  for (const edge of graph.edges ?? []) {
    const kind = edge.interaction.kind;
    if (kind !== 'click' && kind !== 'hover') continue;
    const fromUrl = nodeUrlById.get(edge.fromStateId);
    if (!fromUrl) continue;
    const state = byUrl.get(fromUrl);
    if (!state) continue;
    const interaction: StateInteraction = {
      label: slugify(edge.interaction.selectorLabel || edge.interaction.selector),
      kind,
      selector: edge.interaction.selector,
    };
    if (!state.interactions.some((i) => i.selector === interaction.selector)) {
      state.interactions.push(interaction);
    }
  }

  const states = [...byUrl.values()];
  if (states.length === 0) {
    throw new Error(`Crawl graph at ${graphPath} produced no states`);
  }
  return states;
}

/** A single root state, for the self-parity / smoke case. */
export function rootState(): ParityState {
  return { id: 'root', path: '/', label: 'root', interactions: [] };
}
