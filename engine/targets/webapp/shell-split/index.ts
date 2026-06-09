/**
 * Shell/content split orchestrator for the webapp target.
 *
 * Given the inferred routes, the crawl DOM reader, and the parsed asset map,
 * this:
 *   1. Loads each route's base DOM and detects the persistent SHELL vs the
 *      per-route CONTENT outlet by structural diff (detect-outlet).
 *   2. Emits one LAYOUT component (shell rendered once + <Outlet/>) from the
 *      richest base DOM, with the outlet element's children replaced by a
 *      portal marker.
 *   3. Emits one CONTENT component per route (only that route's outlet inner
 *      HTML, verbatim) with its overlay toggles wired.
 *   4. Emits a router.tsx layout-route wrapping the child content routes.
 *
 * Isolated under shell-split/; reuses verbatim/interaction pieces from
 * emit-stateful. Never touches engine/targets/react/html-to-jsx.ts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import type { RouteGroup } from '../inference/types';
import type { CloneAssetMap } from '../../shared';
import { rewriteBodyAssetUrls } from '../../shared';

import { detectContentOutlet } from './detect-outlet';
import { buildShellHtml, buildContentHtml } from './build-shell-content';
import { emitLayoutComponent } from './emit-layout';
import { emitContentComponent } from './emit-content';
import { emitShellRouter } from './emit-shell-router';

const LAYOUT_COMPONENT_NAME = 'AppLayout';

function writeFile(filePath: string, content: string): number {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export interface ShellSplitInput {
  routes: RouteGroup[];
  getStateDom: (stateId: string) => Promise<string>;
  assetMap: CloneAssetMap | null;
  outDir: string;
  /**
   * Verbatim hidden icon-sprite `<svg>` (union of all captured `<symbol>` defs).
   * Prepended to the verbatim shell HTML so every `<use xlink:href="#cu3-icon-X">`
   * across the app resolves in-document. Empty string injects nothing.
   */
  spriteSvg?: string;
  /**
   * Captured-app hostname (e.g. `app.clickup.com`). Lets the SPA-nav interceptor
   * treat the captured DOM's absolute production hrefs as same-origin links it
   * governs. Empty => window-origin-only same-origin detection.
   */
  captureHost?: string;
}

export interface ShellSplitResult {
  outletSelector: string;
  shellSourceRoute: string;
  layoutComponent: string;
  contentComponents: number;
  unmatchedTriggers: number;
}

/** Pick the base DOM whose content region is RICHEST to source the shell from. */
function pickShellSourceIndex(contentLengths: number[]): number {
  let best = 0;
  for (let i = 1; i < contentLengths.length; i++) {
    if (contentLengths[i] > contentLengths[best]) best = i;
  }
  return best;
}

export async function emitShellSplit(input: ShellSplitInput): Promise<ShellSplitResult> {
  const { routes, getStateDom, assetMap, outDir } = input;
  const spriteSvg = input.spriteSvg ?? '';
  const captureHost = input.captureHost ?? '';
  if (routes.length === 0) {
    throw new Error('emitShellSplit requires at least one route.');
  }

  // Load + asset-rewrite every route's base DOM.
  const baseHtmls = await Promise.all(
    routes.map(async (r) => {
      const raw = await getStateDom(r.baseStateGroup.baseStateId);
      return assetMap ? rewriteBodyAssetUrls(raw, assetMap) : raw;
    }),
  );

  // Detect the content outlet across all route DOMs.
  const docs = baseHtmls.map((html) => cheerio.load(html, null, true));
  const detection = detectContentOutlet(docs);
  const outletSelector = detection.selector;

  // Choose the richest base DOM as the shell source (its chrome is the most
  // complete capture of the persistent shell).
  const contentLengths = docs.map(($: any) => ($(outletSelector).first().html() ?? '').length);
  const shellIdx = pickShellSourceIndex(contentLengths);

  const pagesDir = join(outDir, 'src', 'pages');

  // 1. Layout component from the richest base DOM. The harvested icon sprite is
  // prepended VERBATIM (outside cheerio) so the camelCase `cu3-icon-*` symbol
  // ids survive untouched; routing it through cheerio would lower-case them and
  // break every `<use xlink:href="#cu3-icon-X">` lookup.
  const built = buildShellHtml(baseHtmls[shellIdx], outletSelector);
  const shellHtml = spriteSvg ? `${spriteSvg}${built.shellHtml}` : built.shellHtml;
  const layoutTsx = emitLayoutComponent({
    componentName: LAYOUT_COMPONENT_NAME,
    shellHtml,
    routes: routes.map((r) => ({ path: r.routePath })),
    captureHost,
  });
  writeFile(join(pagesDir, `${LAYOUT_COMPONENT_NAME}.tsx`), layoutTsx);

  // 2. One content component per route.
  let unmatchedTriggers = 0;
  routes.forEach((route, i) => {
    const { contentHtml } = buildContentHtml(baseHtmls[i], outletSelector);
    const result = emitContentComponent({ route, contentHtml });
    writeFile(join(pagesDir, `${result.componentName}.tsx`), result.tsx);
    unmatchedTriggers += result.unmatchedTriggers.length;
  });

  // 3. Router: layout route wrapping the child content routes.
  emitShellRouter({ routes, layoutComponent: LAYOUT_COMPONENT_NAME, outDir });

  return {
    outletSelector,
    shellSourceRoute: routes[shellIdx].routePath,
    layoutComponent: LAYOUT_COMPONENT_NAME,
    contentComponents: routes.length,
    unmatchedTriggers,
  };
}

export { detectContentOutlet } from './detect-outlet';
export { buildShellHtml, buildContentHtml, OUTLET_MARKER_ATTR } from './build-shell-content';
export { emitLayoutComponent } from './emit-layout';
export { emitContentComponent } from './emit-content';
export { emitShellRouter, buildShellRouterEntries } from './emit-shell-router';
export { emitSidebarNavEffect } from './sidebar-nav';
