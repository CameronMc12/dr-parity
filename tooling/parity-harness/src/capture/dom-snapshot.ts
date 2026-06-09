import type { BrowserContext } from 'playwright';
import { VIEWPORT } from '../config.js';
import type { DomStats } from '../types.js';

/**
 * Normalises raw HTML to strip volatile attributes that change run-to-run
 * but carry no structural meaning:
 *   - Hash-suffixed IDs (id="x-abc123def" → id="x-NORMALIZED")
 *   - Unix timestamps / large digit strings (10+ digits)
 *   - ISO date strings
 *   - data-* debug attributes
 *   - Nonces / integrity hashes in style attributes
 *   - Cache-buster query params (?v=..., ?t=..., ?_=...)
 */
function normaliseHtml(raw: string): string {
  return raw
    // Hash-suffixed IDs: id="word-abc123def456" → id="word-NORMALIZED"
    .replace(/\bid="([^"]*?)-[0-9a-f]{6,}"/, 'id="$1-NORMALIZED"')
    // Timestamps (Unix ms / large digit strings, 10+ digits)
    .replace(/\b\d{10,}\b/g, 'TIMESTAMP')
    // ISO date strings e.g. 2026-05-28T15:32:00.000Z
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, 'ISO_DATE')
    // data-* attributes
    .replace(/\s+data-[a-z][a-z0-9-]*="[^"]*"/g, '')
    // Nonce / integrity attributes
    .replace(/\s+nonce="[^"]*"/g, '')
    .replace(/\s+integrity="[^"]*"/g, '')
    // Cache-buster query params: ?v=xxx, ?t=xxx, ?_=xxx, &v=xxx etc.
    .replace(/[?&](?:v|t|_|cache|bust|rev)=[^"&\s]*/g, '');
}

/**
 * Walks a normalised HTML string and extracts structural stats for DOM diffing.
 * Uses a regex-based approach to avoid needing a DOM parser dependency.
 */
export function extractDomStats(html: string): DomStats {
  // Count opening tags (self-closing + regular)
  const tagMatches = html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g);
  const nodesByTag: Record<string, number> = {};
  let totalNodes = 0;

  for (const m of tagMatches) {
    const tag = m[1].toLowerCase();
    nodesByTag[tag] = (nodesByTag[tag] ?? 0) + 1;
    totalNodes++;
  }

  // Count class tokens
  const nodesByClass: Record<string, number> = {};
  const classAttrMatches = html.matchAll(/\bclass="([^"]*)"/g);
  for (const m of classAttrMatches) {
    const classes = m[1].split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      nodesByClass[cls] = (nodesByClass[cls] ?? 0) + 1;
    }
  }

  // Estimate tree depth via nesting level (max open-tag stack depth)
  let depth = 0;
  let maxDepth = 0;
  // Void elements that don't affect nesting depth
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g;
  for (const m of html.matchAll(tokenRe)) {
    const full = m[0];
    const tag = m[1].toLowerCase();
    if (VOID.has(tag) || full.endsWith('/>')) continue;
    if (full.startsWith('</')) {
      depth = Math.max(0, depth - 1);
    } else {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
    }
  }

  return { totalNodes, nodesByTag, nodesByClass, treeDepth: maxDepth };
}

/**
 * Navigates to url, captures outerHTML from document.documentElement,
 * normalises it, then returns both normalised HTML and extracted stats.
 */
export async function captureDomSnapshot(
  context: BrowserContext,
  url: string,
  settleMs: number,
): Promise<{ normalised: string; stats: DomStats }> {
  const page = await context.newPage();
  try {
    await page.setViewportSize(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(settleMs);
    const raw: string = await page.evaluate(() => document.documentElement.outerHTML);
    const normalised = normaliseHtml(raw);
    const stats = extractDomStats(normalised);
    return { normalised, stats };
  } finally {
    await page.close();
  }
}
