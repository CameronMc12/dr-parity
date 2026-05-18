/**
 * Locate the <header>/<main>/<footer> landmarks inside a <body> element.
 *
 * Two-stage strategy:
 *   1. PRIMARY — look at body's direct children. If any landmark sits at that
 *      level, use them. This is the historical behaviour and what well-formed
 *      pages produce (e.g. the clone-enerblock fixture).
 *   2. FALLBACK — many real sites wrap everything in a single <div class="wrapper">
 *      (real-world example: vivre.agency). In that case the direct-children
 *      search returns -1 for every landmark and the slicer collapses the whole
 *      page into one BodyPreamble blob. To recover, we descend through the
 *      wrapper layer and treat its children as the effective body children for
 *      slicing purposes. Anything at the true body root that is a sibling of
 *      the wrapper (tracking iframes, hidden SVG masks, etc.) is returned as
 *      `preambleSiblings` so the caller can still emit it as BodyPreamble noise.
 */

import type { AnyNode, Element } from 'domhandler';

export interface LandmarkLocations {
  /**
   * The list of nodes the slicer should treat as the "direct children of body".
   * In the primary path this is literally body.children. In the fallback path
   * it is the children of an inner wrapper element.
   */
  effectiveChildren: AnyNode[];
  /**
   * Body-root siblings that sit alongside the wrapper. Empty in the primary
   * path. In the fallback path these are emitted into BodyPreamble so they
   * are not lost.
   */
  preambleSiblings: AnyNode[];
  headerIdx: number;
  mainIdx: number;
  footerIdx: number;
}

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag';
}

function indicesIn(nodes: AnyNode[]): { headerIdx: number; mainIdx: number; footerIdx: number } {
  let headerIdx = -1;
  let mainIdx = -1;
  let footerIdx = -1;
  nodes.forEach((node, i) => {
    if (!isElement(node)) return;
    if (headerIdx === -1 && node.tagName === 'header') headerIdx = i;
    if (mainIdx === -1 && node.tagName === 'main') mainIdx = i;
    if (node.tagName === 'footer') footerIdx = i;
  });
  return { headerIdx, mainIdx, footerIdx };
}

function elementChildren(nodes: AnyNode[]): Element[] {
  return nodes.filter(isElement);
}

function dfsFindLandmark(node: AnyNode): Element | null {
  if (!isElement(node)) return null;
  if (node.tagName === 'header' || node.tagName === 'main' || node.tagName === 'footer') {
    return node;
  }
  for (const child of node.children as AnyNode[]) {
    const hit = dfsFindLandmark(child);
    if (hit) return hit;
  }
  return null;
}

export function findLandmarks(body: Element): LandmarkLocations {
  const rootChildren = body.children as AnyNode[];

  // Primary path: landmarks directly under <body>.
  const primary = indicesIn(rootChildren);
  if (primary.headerIdx !== -1 || primary.mainIdx !== -1 || primary.footerIdx !== -1) {
    return {
      effectiveChildren: rootChildren,
      preambleSiblings: [],
      ...primary,
    };
  }

  // Fallback path: descend into a single-element wrapper (if present),
  // otherwise DFS for the first landmark and use its parent's children.
  const rootElements = elementChildren(rootChildren);

  if (rootElements.length === 1) {
    const wrapper = rootElements[0];
    const wrapperChildren = wrapper.children as AnyNode[];
    const inWrapper = indicesIn(wrapperChildren);
    if (inWrapper.headerIdx !== -1 || inWrapper.mainIdx !== -1 || inWrapper.footerIdx !== -1) {
      return {
        effectiveChildren: wrapperChildren,
        preambleSiblings: rootChildren.filter((n) => n !== wrapper),
        ...inWrapper,
      };
    }
    // Deeper wrapper — recurse one more time via DFS pivot below using the
    // wrapper itself as the search root.
    return pivotOnDfs(body, wrapper);
  }

  if (rootElements.length > 1) {
    return pivotOnDfs(body, body);
  }

  // No element children at all — caller will fall back to current behaviour.
  return {
    effectiveChildren: rootChildren,
    preambleSiblings: [],
    headerIdx: -1,
    mainIdx: -1,
    footerIdx: -1,
  };
}

function pivotOnDfs(body: Element, searchRoot: Element): LandmarkLocations {
  let firstLandmark: Element | null = null;
  for (const child of searchRoot.children as AnyNode[]) {
    firstLandmark = dfsFindLandmark(child);
    if (firstLandmark) break;
  }

  if (!firstLandmark || !firstLandmark.parent || !isElement(firstLandmark.parent as AnyNode)) {
    return {
      effectiveChildren: body.children as AnyNode[],
      preambleSiblings: [],
      headerIdx: -1,
      mainIdx: -1,
      footerIdx: -1,
    };
  }

  const parent = firstLandmark.parent as Element;
  const effectiveChildren = parent.children as AnyNode[];
  const indices = indicesIn(effectiveChildren);

  // Preamble siblings: everything at body root that is NOT the ancestor chain
  // leading to `parent`. The ancestor chain itself is "transparent".
  const ancestorChain = new Set<AnyNode>();
  let cursor: AnyNode | null = parent;
  while (cursor && cursor !== body) {
    ancestorChain.add(cursor);
    cursor = (cursor as Element).parent as AnyNode | null;
  }
  const preambleSiblings = (body.children as AnyNode[]).filter((n) => !ancestorChain.has(n));

  return {
    effectiveChildren,
    preambleSiblings,
    ...indices,
  };
}
