/**
 * Extract Angular route definitions from minified bundles plus observed
 * navigation URLs from the recorded network logs (streamed).
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type {
  NetworkRequestLine,
  NetworkResponseLine,
  ObservedRoute,
  RouteNode,
} from './types.js';
import { isResponse } from './jsonl.js';

// path:`...`  /  path:"..."  /  path:'...'
const PATH_RE = /path:\s*[`"']([^`"']*)[`"']/g;
const LOAD_CHILDREN_RE = /loadChildren:\s*\(\)\s*=>\s*import\(`([^`]+)`\)/;
const REDIRECT_RE = /redirectTo:\s*[`"']([^`"']*)[`"']/;
const COMPONENT_RE = /component:\s*([A-Za-z_$][\w$]*)/;

/**
 * Reject SVG path data / template-literal coordinate strings that share the
 * `path:` key but are not Angular route segments. Angular route paths are
 * short, contain no spaces, and no template interpolation.
 */
function isRouteLikePath(path: string): boolean {
  if (path.length > 80) return false;
  if (path.includes(' ')) return false;
  if (path.includes('${')) return false;
  if (/[A-Z]\s?[\d.]/.test(path)) return false; // SVG draw commands (M10, L 5)
  if (/[\d.]+,[\d.]+/.test(path)) return false; // coordinate pairs
  return true;
}

function routesFromSource(text: string, source: string): RouteNode[] {
  const out: RouteNode[] = [];
  let m: RegExpExecArray | null;
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(text)) !== null) {
    if (!isRouteLikePath(m[1])) continue;
    const window = text.slice(m.index, m.index + 240);
    const node: RouteNode = { path: m[1], source };
    const lc = window.match(LOAD_CHILDREN_RE);
    if (lc) node.loadChildren = lc[1];
    const rd = window.match(REDIRECT_RE);
    if (rd) node.redirectTo = rd[1];
    const cp = window.match(COMPONENT_RE);
    if (cp) node.component = cp[1];
    out.push(node);
  }
  return out;
}

export function extractRouteDefinitions(bundleFiles: string[]): RouteNode[] {
  const all: RouteNode[] = [];
  const seen = new Set<string>();
  for (const file of bundleFiles) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const source = basename(file);
    for (const node of routesFromSource(text, source)) {
      const key = `${node.path}|${node.loadChildren ?? ''}|${node.redirectTo ?? ''}|${node.component ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(node);
    }
  }
  all.sort((a, b) => a.path.localeCompare(b.path));
  return all;
}

const WSID_RE = /^\d{8,}$/;
const VIEW_ID_RE = /^[a-z0-9]+-\d+$/i;

function patternize(pathname: string): string {
  return pathname
    .split('/')
    .map((s) => (WSID_RE.test(s) ? ':wsid' : VIEW_ID_RE.test(s) ? ':viewId' : s))
    .join('/');
}

/** Streaming accumulator for observed app.clickup.com navigation URLs. */
export class ObservedRouteAccumulator {
  private map = new Map<string, ObservedRoute>();

  add(line: NetworkRequestLine | NetworkResponseLine): void {
    if (!isResponse(line)) return;
    let parsed: URL;
    try {
      parsed = new URL(line.url);
    } catch {
      return;
    }
    if (parsed.host !== 'app.clickup.com') return;
    if (parsed.pathname.includes('.')) return; // skip asset files

    const pattern = patternize(parsed.pathname);
    let entry = this.map.get(pattern);
    if (!entry) {
      entry = { pattern, examples: [], count: 0 };
      this.map.set(pattern, entry);
    }
    entry.count += 1;
    if (entry.examples.length < 3 && !entry.examples.includes(parsed.pathname)) {
      entry.examples.push(parsed.pathname);
    }
  }

  result(): ObservedRoute[] {
    return [...this.map.values()].sort((a, b) => b.count - a.count);
  }
}
