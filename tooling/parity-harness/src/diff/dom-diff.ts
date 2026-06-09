import type { DomStats } from '../types.js';
import { extractDomStats } from '../capture/dom-snapshot.js';

/**
 * Given a full HTML string and a list of CSS selectors, extract a reduced
 * HTML fragment that contains only the outerHTML of matching top-level
 * containers. Used for shell-only DOM diff.
 *
 * Because we operate on raw HTML strings (no DOM parser in Node), we use a
 * heuristic: scan for opening tags whose class or id attributes include one of
 * the selector tokens, then extract from that opening tag to its matching
 * close tag.  This is intentionally conservative — it only restricts the diff
 * to nodes that are clearly part of the shell.
 */
export function restrictHtmlToSelectors(html: string, selectors: string[]): string {
  // Build a set of class/id tokens from the selector list (strip . # prefixes)
  const tokens = new Set<string>();
  for (const sel of selectors) {
    const parts = sel.split(/[\s>+~,]+/);
    for (const part of parts) {
      // class tokens: .foo → foo, [class*="foo"] → foo
      const classMatch = part.match(/(?:^|\.)([a-zA-Z][a-zA-Z0-9_-]*)/) ??
                         part.match(/\[class\*="([^"]+)"\]/);
      if (classMatch) tokens.add(classMatch[1].toLowerCase());
      // tag tokens: header, nav, etc.
      const tagMatch = part.match(/^([a-zA-Z][a-zA-Z0-9-]*)(?:[.#\[]|$)/);
      if (tagMatch) tokens.add(tagMatch[1].toLowerCase());
    }
  }

  const fragments: string[] = [];
  // Walk every opening tag; if it mentions one of the shell tokens in its
  // class/id attributes, grab the full subtree.
  const openTagRe = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m: RegExpExecArray | null;

  while ((m = openTagRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2].toLowerCase();
    const attrClasses = (attrs.match(/class="([^"]*)"/) ?? [])[1] ?? '';
    const attrId = (attrs.match(/id="([^"]*)"/) ?? [])[1] ?? '';
    const attrTokens = [...attrClasses.split(/\s+/), attrId, tag].filter(Boolean);

    const matches = attrTokens.some(t => tokens.has(t));
    if (!matches) continue;

    // Found a shell element — extract its subtree by tracking depth
    const start = m.index;
    let depth = 1;
    let pos = openTagRe.lastIndex;
    const VOID = new Set(['area','base','br','col','embed','hr','img','input',
                          'link','meta','param','source','track','wbr']);
    const innerRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*\/?>)/g;
    innerRe.lastIndex = pos;

    let end = html.length;
    let innerM: RegExpExecArray | null;
    while ((innerM = innerRe.exec(html)) !== null) {
      const innerTag = innerM[1].toLowerCase();
      const full = innerM[0];
      if (VOID.has(innerTag) || full.endsWith('/>')) continue;
      if (full.startsWith('</')) {
        depth--;
        if (depth === 0) { end = innerRe.lastIndex; break; }
      } else {
        depth++;
      }
    }
    fragments.push(html.slice(start, end));
    // Skip past this subtree to avoid double-counting nested matches
    openTagRe.lastIndex = end;
  }

  return fragments.join('\n');
}

/**
 * Structural DOM similarity score.
 *
 * Heuristic: average of four normalised similarity sub-scores:
 *   1. totalNodes   — 1 - |A - B| / max(A, B)
 *   2. tagVariety   — |union| tags that appear in BOTH / |union| of all tags
 *      (Jaccard-like; rewards matching the same tag inventory)
 *   3. classVariety — same as tagVariety but for CSS class tokens
 *   4. treeDepth    — 1 - |depthA - depthB| / max(depthA, depthB)
 *
 * Each sub-score is clamped to [0, 1]. A final score of 1.0 means the two
 * DOMs are structurally identical by this measure.
 *
 * When shellSelectors is provided, both DOMs are restricted to shell-matching
 * subtrees before scoring.
 */
export function domDiff(
  a: DomStats,
  b: DomStats,
  shellSelectors?: string[],
  aNormalisedHtml?: string,
  bNormalisedHtml?: string,
): number {
  // If shell selectors and raw HTML are supplied, re-derive stats from shell subtrees
  if (shellSelectors && shellSelectors.length > 0 && aNormalisedHtml && bNormalisedHtml) {
    const aFragment = restrictHtmlToSelectors(aNormalisedHtml, shellSelectors);
    const bFragment = restrictHtmlToSelectors(bNormalisedHtml, shellSelectors);
    // Fall back to full stats if restriction yielded nothing (shell not rendered yet)
    if (aFragment.trim().length > 0 || bFragment.trim().length > 0) {
      a = extractDomStats(aFragment);
      b = extractDomStats(bFragment);
    }
  }

  return _scoreDomStats(a, b);
}

function _scoreDomStats(a: DomStats, b: DomStats): number {
  // 1. Total node count similarity
  const maxNodes = Math.max(a.totalNodes, b.totalNodes);
  const nodeSimilarity = maxNodes === 0
    ? 1
    : 1 - Math.abs(a.totalNodes - b.totalNodes) / maxNodes;

  // 2. Tag variety similarity (Jaccard on tag sets weighted by presence)
  const tagSimilarity = jaccardWeighted(a.nodesByTag, b.nodesByTag);

  // 3. Class variety similarity
  const classSimilarity = jaccardWeighted(a.nodesByClass, b.nodesByClass);

  // 4. Tree depth similarity
  const maxDepth = Math.max(a.treeDepth, b.treeDepth);
  const depthSimilarity = maxDepth === 0
    ? 1
    : 1 - Math.abs(a.treeDepth - b.treeDepth) / maxDepth;

  return (nodeSimilarity + tagSimilarity + classSimilarity + depthSimilarity) / 4;
}

/**
 * Weighted Jaccard similarity for two count maps.
 * intersection = sum of min(a[k], b[k]) for all k
 * union        = sum of max(a[k], b[k]) for all k
 * score        = intersection / union
 */
function jaccardWeighted(
  a: Record<string, number>,
  b: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let intersection = 0;
  let union = 0;
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    intersection += Math.min(av, bv);
    union += Math.max(av, bv);
  }
  return union === 0 ? 1 : intersection / union;
}
