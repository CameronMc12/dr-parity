#!/usr/bin/env node
/**
 * Transform the raw computed-style chrome snapshot into a lean, renderable tree
 * the React clone can import and render with baked inline styles.
 *
 * Reads : docs/research/clickup-parity/baseline/chrome-computed.json
 * Writes: clones/clickup-seed-react/src/data/chrome-tree.json
 *
 * Pruning:
 *  - drop Angular scoping attrs (_ngcontent / _nghost) and noisy directive attrs
 *  - keep class, data-test, aria-*, href, src, alt, width/height, xlink:href
 *  - keep the captured computed styles verbatim (they are the whole point)
 *  - drop comment-only / zero-rect invisible helper subtrees
 */
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const IN_FILE = join('docs', 'research', 'clickup-parity', 'baseline', 'chrome-computed.json');
const OUT_FILE = join('clones', 'clickup-seed-react', 'src', 'data', 'chrome-tree.json');

// Attributes worth keeping for visual fidelity + structure. Everything else is
// dropped (Angular internals, directives, test hooks we do not need).
const KEEP_ATTR_EXACT = new Set([
  'class', 'href', 'src', 'alt', 'width', 'height', 'role', 'type',
  'placeholder', 'name', 'cu3-size', 'cu3-type', 'cu3-background', 'cu3-round',
  'cu3-variant', 'data-test', 'data-sidebar-item-id', 'data-active',
  'data-test-selected', 'xmlns', 'xmlns:xlink', 'xlink:href', 'data-testid',
  'cu3-vertical',
]);

function keepAttr(name) {
  if (KEEP_ATTR_EXACT.has(name)) return true;
  if (name.startsWith('aria-')) return true;
  return false;
}

const DROP_COMPUTED = new Map([['stroke', 'none']]);

// Tags whose icon glyph color must follow the captured text `color`. The sprite
// paths carry no `fill`, so they default to black. getComputedStyle reports that
// black `fill` even where ClickUp paints the icon white via currentColor. Forcing
// `fill: currentColor` makes the glyph inherit the (correctly captured) `color`,
// so rail icons render white and topbar icons render dark, matching the original.
const ICON_TAGS = new Set(['svg', 'cu3-icon', 'use', 'path', 'g']);

function cleanComputed(computed, tag) {
  if (!computed) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(computed)) {
    if (DROP_COMPUTED.get(k) === v) continue;
    out[k] = v;
  }
  if (ICON_TAGS.has(tag) && (out.fill === undefined || out.fill === 'rgb(0, 0, 0)')) {
    out.fill = 'currentColor';
  }
  return Object.keys(out).length ? out : undefined;
}

function prune(node) {
  if (!node) return null;
  const out = { tag: node.tag };
  const attrs = {};
  for (const [k, v] of Object.entries(node.attrs || {})) {
    if (keepAttr(k)) attrs[k] = v;
  }
  if (Object.keys(attrs).length) out.attrs = attrs;
  const computed = cleanComputed(node.computed, node.tag);
  if (computed) out.computed = computed;
  if (node.text) out.text = node.text;
  if (node.useHref) out.useHref = node.useHref;
  if (node.rect) out.rect = node.rect;
  const kids = [];
  for (const c of node.children || []) {
    const pc = prune(c);
    if (pc) kids.push(pc);
  }
  if (kids.length) out.children = kids;
  return out;
}

function main() {
  const raw = JSON.parse(readFileSync(IN_FILE, 'utf8'));
  const lean = { capturedAt: raw.capturedAt, viewport: raw.viewport, regions: {} };
  for (const [key, region] of Object.entries(raw.regions)) {
    lean.regions[key] = {
      selector: region.selector,
      rect: region.rect,
      tree: prune(region.tree),
    };
  }
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(lean), 'utf8');
  const kb = (Buffer.byteLength(JSON.stringify(lean)) / 1024).toFixed(0);
  console.log(`[build-chrome-tree] wrote ${OUT_FILE} (${kb} KB)`);
}

main();
