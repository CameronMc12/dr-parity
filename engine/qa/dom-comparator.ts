/**
 * DOM structure comparator — compares the simplified DOM trees of the original
 * and clone pages to surface missing elements, tag mismatches, and text
 * differences. Complements the pixel-diff approach with structural analysis.
 */

import type { Page } from 'playwright';
import type { StructureDiffResult, TextDiff, TagMismatch } from '../types/diff';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DomCompareOptions {
  /** Max tree depth to walk. Default 5. */
  maxDepth?: number;
  /** Attributes to ignore during comparison. Default: data-*, class, style. */
  ignoreAttributes?: string[];
}

interface DomNode {
  tag: string;
  role: string | null;
  text: string | null;
  childCount: number;
  children: DomNode[];
}

interface DomTreeResult {
  tree: DomNode;
  count: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare the DOM structures of two already-opened pages. Both pages should
 * be navigated and fully loaded before calling this function.
 */
export async function compareDomStructure(
  originalPage: Page,
  clonePage: Page,
  options?: DomCompareOptions,
): Promise<StructureDiffResult> {
  const maxDepth = options?.maxDepth ?? 5;

  const [originalTree, cloneTree] = await Promise.all([
    extractDomTree(originalPage, maxDepth),
    extractDomTree(clonePage, maxDepth),
  ]);

  const result: StructureDiffResult = {
    totalElements: { original: originalTree.count, clone: cloneTree.count },
    missingElements: [],
    extraElements: [],
    textDifferences: [],
    tagMismatches: [],
  };

  diffTrees(originalTree.tree, cloneTree.tree, '', result);

  return result;
}

// ---------------------------------------------------------------------------
// DOM tree extraction (runs inside browser context)
// ---------------------------------------------------------------------------

async function extractDomTree(page: Page, maxDepth: number): Promise<DomTreeResult> {
  return page.evaluate((depth: number) => {
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG']);

    function walkDom(el: Element, currentDepth: number): DomNode | null {
      if (currentDepth > depth) return null;

      const children = Array.from(el.children)
        .filter((c) => !SKIP_TAGS.has(c.tagName))
        .map((c) => walkDom(c, currentDepth + 1))
        .filter((c): c is DomNode => c !== null);

      const firstChild = el.childNodes[0];
      const isTextOnly =
        el.childNodes.length === 1 &&
        firstChild !== undefined &&
        firstChild.nodeType === 3;
      const text = isTextOnly ? (el.textContent?.trim().slice(0, 100) ?? null) : null;

      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text,
        childCount: children.length,
        children,
      };
    }

    const main = document.querySelector('main') || document.body;
    const tree = walkDom(main, 0);
    const count = document.querySelectorAll('*').length;
    return { tree: tree ?? { tag: 'body', role: null, text: null, childCount: 0, children: [] }, count };
  }, maxDepth);
}

// ---------------------------------------------------------------------------
// Recursive tree diff
// ---------------------------------------------------------------------------

function diffTrees(
  original: DomNode | null,
  clone: DomNode | null,
  path: string,
  result: StructureDiffResult,
): void {
  if (!original && !clone) return;

  if (!original) {
    result.extraElements.push(path || '(root)');
    return;
  }
  if (!clone) {
    result.missingElements.push(path || '(root)');
    return;
  }

  if (original.tag !== clone.tag) {
    result.tagMismatches.push({
      selector: path || '(root)',
      originalTag: original.tag,
      cloneTag: clone.tag,
    });
  }

  if (original.text && clone.text && original.text !== clone.text) {
    result.textDifferences.push({
      selector: path || '(root)',
      original: original.text,
      clone: clone.text,
    });
  }

  const maxChildren = Math.max(
    original.children.length,
    clone.children.length,
  );

  for (let i = 0; i < maxChildren; i++) {
    const origChild = original.children[i] ?? null;
    const cloneChild = clone.children[i] ?? null;
    const childTag = origChild?.tag ?? cloneChild?.tag ?? 'unknown';
    const childPath = `${path} > ${childTag}:nth-child(${i + 1})`;

    diffTrees(origChild, cloneChild, childPath, result);
  }
}
