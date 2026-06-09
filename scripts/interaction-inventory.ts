#!/usr/bin/env tsx
/**
 * Interaction Inventory (Part 4).
 *
 * Walks a crawl run (graph.json + states/<id>/meta.json + network.jsonl) and
 * emits the FUNCTIONAL CHECKLIST of everything the clone must make work:
 * every captured interactive element / state, classified by kind
 * (click / right-click / hover / keyboard / dnd / nav), with its label, the
 * view it occurred in, the DOM target (selector / text / aria), and the network
 * call(s) it triggered (so we know what each control DOES).
 *
 * Output:
 *   docs/research/clickup-parity/interaction-inventory.json
 *   docs/research/clickup-parity/interaction-inventory.md
 *
 * Usage:
 *   npm run interaction-inventory -- --run=docs/research/crawl/app.clickup.com/seed-full-1
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT_JSON = 'docs/research/clickup-parity/interaction-inventory.json';
const OUT_MD = 'docs/research/clickup-parity/interaction-inventory.md';

/** Window (ms) after an interaction in which a network call is attributed to it. */
const ATTRIBUTION_WINDOW_MS = 4_000;

type InteractionKind =
  | 'click'
  | 'right-click'
  | 'hover'
  | 'keyboard'
  | 'dnd'
  | 'nav';

type Interaction = {
  kind?: string;
  selector?: string;
  selectorLabel?: string;
  elementTag?: string;
  keyCombo?: string;
  opensOverlay?: boolean;
};

type GraphNode = {
  id: string;
  url?: string;
  title?: string;
  depth?: number;
  capturedAt?: string;
  sourceKind?: string;
};

type GraphEdge = {
  fromStateId: string;
  toStateId: string;
  interaction?: Interaction;
  capturedAt?: string;
};

type Graph = { nodes: GraphNode[]; edges?: GraphEdge[] };

type NetEntry = {
  kind?: string;
  method?: string;
  url?: string;
  status?: number;
  resourceType?: string;
  capturedAt?: string;
};

type NetCall = { method: string; url: string; status?: number };

type InventoryItem = {
  kind: InteractionKind;
  label: string;
  view: string;
  viewUrl: string;
  target: { selector: string; text: string; tag: string };
  keyCombo?: string;
  opensOverlay: boolean;
  fromStateId: string;
  toStateId: string;
  networkCalls: NetCall[];
};

function parseArgs(argv: string[]): { run: string } {
  let run = '';
  for (const raw of argv) {
    if (raw.startsWith('--run=')) run = raw.slice('--run='.length);
  }
  if (!run) {
    throw new Error('Missing --run=<crawl-dir>');
  }
  return { run };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Classify an edge's interaction kind into a canonical inventory kind. */
function classify(interaction: Interaction | undefined, node: GraphNode): InteractionKind {
  const k = (interaction?.kind ?? '').toLowerCase();
  if (k === 'right-click') return 'right-click';
  if (k === 'hover') return 'hover';
  if (k === 'keyboard') return 'keyboard';
  const label = (interaction?.selectorLabel ?? '').toLowerCase();
  const sel = (interaction?.selector ?? '').toLowerCase();
  if (k === 'dnd' || sel === 'pointer-drag' || label.startsWith('dnd-')) return 'dnd';
  // A click that changed the URL is a navigation.
  if (k === 'click' && (node.sourceKind === 'route' || node.sourceKind === 'nav')) {
    return 'nav';
  }
  return 'click';
}

/** Friendly view name from a node's title / URL. */
function viewLabel(node: GraphNode): string {
  if (node.title) return node.title;
  const url = node.url ?? '';
  const m = url.match(/\/v\/([a-z]+)\/([a-z]+)\//i);
  if (m) return `view:${m[1]}/${m[2]}`;
  return url || node.id;
}

/** Read a captured state's meta to enrich the DOM target with aria/text. */
function readMeta(runDir: string, stateId: string): { aria: string } {
  const metaPath = join(runDir, 'states', stateId, 'meta.json');
  if (!existsSync(metaPath)) return { aria: '' };
  try {
    const meta = readJson<{ ariaPath?: string }>(metaPath);
    if (meta.ariaPath && existsSync(meta.ariaPath)) {
      const aria = readFileSync(meta.ariaPath, 'utf8').slice(0, 200).replace(/\s+/g, ' ').trim();
      return { aria };
    }
  } catch {
    /* best-effort */
  }
  return { aria: '' };
}

function loadNetwork(runDir: string): NetEntry[] {
  const path = join(runDir, 'network.jsonl');
  if (!existsSync(path)) return [];
  const out: NetEntry[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as NetEntry);
    } catch {
      /* skip malformed line */
    }
  }
  return out;
}

/** Is this network entry an interesting backend call (not a static asset)? */
function isBackendCall(e: NetEntry): boolean {
  if (e.kind !== 'request') return false;
  const url = e.url ?? '';
  if (!url) return false;
  const rt = e.resourceType ?? '';
  if (rt === 'image' || rt === 'stylesheet' || rt === 'font' || rt === 'media' || rt === 'script') {
    return false;
  }
  if (/\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ico|map)(\?|$)/i.test(url)) return false;
  // Keep XHR/fetch/document, especially API + graphql.
  return rt === 'xhr' || rt === 'fetch' || rt === 'document' || /\/(api|v\d|graphql)\b/i.test(url);
}

/**
 * Attribute backend calls to an edge: requests fired in the window AFTER the
 * edge's capture timestamp. The edge timestamp marks when the interaction was
 * performed, so calls just after it are what the control triggered.
 */
function attributeCalls(
  edge: GraphEdge,
  toNode: GraphNode,
  backend: NetEntry[],
): NetCall[] {
  const anchorIso = edge.capturedAt ?? toNode.capturedAt;
  if (!anchorIso) return [];
  const anchor = Date.parse(anchorIso);
  if (Number.isNaN(anchor)) return [];

  const calls: NetCall[] = [];
  const seen = new Set<string>();
  for (const e of backend) {
    const t = e.capturedAt ? Date.parse(e.capturedAt) : NaN;
    if (Number.isNaN(t)) continue;
    if (t < anchor - 500 || t > anchor + ATTRIBUTION_WINDOW_MS) continue;
    const method = e.method ?? 'GET';
    const url = (e.url ?? '').split('?')[0];
    const key = `${method} ${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push({ method, url, status: e.status });
    if (calls.length >= 8) break;
  }
  return calls;
}

function buildInventory(runDir: string): InventoryItem[] {
  const graph = readJson<Graph>(join(runDir, 'graph.json'));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const backend = loadNetwork(runDir).filter(isBackendCall);

  const items: InventoryItem[] = [];
  for (const edge of graph.edges ?? []) {
    const toNode = nodeById.get(edge.toStateId);
    const fromNode = nodeById.get(edge.fromStateId);
    if (!toNode) continue;
    const interaction = edge.interaction;
    const kind = classify(interaction, toNode);
    const view = viewLabel(fromNode ?? toNode);
    const meta = readMeta(runDir, edge.toStateId);

    items.push({
      kind,
      label: interaction?.selectorLabel || interaction?.keyCombo || '(unlabeled)',
      view,
      viewUrl: (fromNode ?? toNode).url ?? '',
      target: {
        selector: interaction?.selector ?? '',
        text: interaction?.selectorLabel ?? '',
        tag: interaction?.elementTag ?? '',
      },
      keyCombo: interaction?.keyCombo,
      opensOverlay: Boolean(interaction?.opensOverlay),
      fromStateId: edge.fromStateId,
      toStateId: edge.toStateId,
      networkCalls: attributeCalls(edge, toNode, backend),
    });
  }
  return items;
}

type Grouped = Record<string, Record<string, InventoryItem[]>>;

function groupByViewAndKind(items: InventoryItem[]): Grouped {
  const out: Grouped = {};
  for (const it of items) {
    (out[it.view] ??= {});
    (out[it.view][it.kind] ??= []).push(it);
  }
  return out;
}

function countByKind(items: InventoryItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[it.kind] = (out[it.kind] ?? 0) + 1;
  return out;
}

function renderMarkdown(runDir: string, items: InventoryItem[], grouped: Grouped): string {
  const lines: string[] = [];
  lines.push('# Interaction Inventory');
  lines.push('');
  lines.push(`Run: \`${runDir}\``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Functional checklist of every captured interactive control. Each');
  lines.push('row must be made to work in the clone. Network calls show what the');
  lines.push('control DOES.');
  lines.push('');

  const totals = countByKind(items);
  lines.push('## Totals by kind');
  lines.push('');
  lines.push('| Kind | Count |');
  lines.push('| --- | --- |');
  for (const [kind, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${kind} | ${n} |`);
  }
  lines.push(`| **TOTAL** | **${items.length}** |`);
  lines.push('');

  lines.push('## Distinct controls per view');
  lines.push('');
  lines.push('| View | Distinct controls | By kind |');
  lines.push('| --- | --- | --- |');
  for (const [view, byKind] of Object.entries(grouped)) {
    const flat = Object.values(byKind).flat();
    const distinct = new Set(flat.map((i) => `${i.kind}:${i.label}`)).size;
    const breakdown = Object.entries(byKind)
      .map(([k, arr]) => `${k}=${arr.length}`)
      .join(', ');
    lines.push(`| ${view} | ${distinct} | ${breakdown} |`);
  }
  lines.push('');

  for (const [view, byKind] of Object.entries(grouped)) {
    lines.push(`## ${view}`);
    lines.push('');
    for (const [kind, arr] of Object.entries(byKind)) {
      lines.push(`### ${kind} (${arr.length})`);
      lines.push('');
      lines.push('| Label | Target | Triggers |');
      lines.push('| --- | --- | --- |');
      for (const it of arr) {
        const target = it.target.selector || it.target.text || it.target.tag || '—';
        const triggers = it.networkCalls.length
          ? it.networkCalls.map((c) => `${c.method} ${c.url}`).join('<br>')
          : it.opensOverlay
            ? 'opens overlay'
            : 'state change';
        lines.push(
          `| ${escapeCell(it.label)} | ${escapeCell(target)} | ${escapeCell(triggers)} |`,
        );
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300);
}

function main(): void {
  const { run } = parseArgs(process.argv.slice(2));
  if (!existsSync(join(run, 'graph.json'))) {
    throw new Error(`No graph.json in ${run}`);
  }

  const items = buildInventory(run);
  const grouped = groupByViewAndKind(items);

  const json = {
    generatedAt: new Date().toISOString(),
    run,
    totals: countByKind(items),
    totalItems: items.length,
    byView: Object.fromEntries(
      Object.entries(grouped).map(([view, byKind]) => [
        view,
        {
          distinctControls: new Set(
            Object.values(byKind)
              .flat()
              .map((i) => `${i.kind}:${i.label}`),
          ).size,
          byKind: Object.fromEntries(
            Object.entries(byKind).map(([k, arr]) => [k, arr.length]),
          ),
        },
      ]),
    ),
    items,
  };

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  writeFileSync(OUT_MD, `${renderMarkdown(run, items, grouped)}\n`, 'utf8');

  console.log(`[inventory] ${items.length} items across ${Object.keys(grouped).length} views`);
  console.log(`[inventory] kinds: ${JSON.stringify(countByKind(items))}`);
  console.log(`[inventory] wrote ${OUT_JSON}`);
  console.log(`[inventory] wrote ${OUT_MD}`);
}

main();
