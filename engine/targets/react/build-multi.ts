/**
 * Multi-page React build orchestrator.
 *
 * Mirrors engine/targets/astro/build-multi.ts. Reads N clone directories
 * (one per crawled URL), slices each, then emits a single multi-entry
 * Vite + React + TS project where each captured URL becomes its own
 * <pageName>.html entry. Shared components (Header, Footer, etc.) that
 * appear on 2+ pages are deduped to src/components/shared/.
 *
 * Parity guarantees (do NOT regress):
 *   - Per-page heads are byte-preserved; no cross-page dedupe at the head.
 *   - Per-page captured body scripts are hoisted into that page's HTML.
 *   - Extra stylesheet hrefs (orphan caches) are computed per page.
 *   - Links between pages do full reloads, because each <pageName>.html
 *     is a real entry — no React Router.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import {
  extractHead,
  sliceBody,
  copyAssetsToPublic,
  dirSizeBytes,
} from '../shared';
import {
  collectAndStripBodyScripts,
  renderHoistedScripts,
  listPublicCssFiles,
  extractSourceStylesheetHrefs,
  planCssLinks,
  filterAlreadyLinked,
} from './collect-hoistable';
import { emitMultiPageReact, routeToPageName, type ReactPageSlice } from './emit-multi';
import { writePostHydrationSyncLib } from './post-hydration-sync';
import { buildResponsiveSheet } from './responsive-sheet';
import { writeMultiScaffold } from './scaffold-multi';

export interface ReactMultiPageInput {
  /** Path to a clone dir (must contain index.html + manifest.json). */
  cloneDir: string;
  /** Pathname for the original URL, e.g. "/", "/about". */
  pathname: string;
  /** Optional original full URL (for logging). */
  url?: string;
}

export interface ReactMultiBuildOptions {
  pages: ReactMultiPageInput[];
  outDir: string;
  name: string;
  force: boolean;
}

export interface ReactMultiBuildSummary {
  pagesEmitted: string[];
  sharedComponents: string[];
  perPageComponents: number;
  assetCount: number;
  assetBytes: number;
}

export async function buildReactMulti(
  options: ReactMultiBuildOptions,
): Promise<ReactMultiBuildSummary> {
  const { pages, outDir, name, force } = options;

  if (pages.length === 0) {
    throw new Error('buildReactMulti: no pages provided');
  }

  const absOut = resolve(outDir);

  for (const p of pages) {
    const absClone = resolve(p.cloneDir);
    if (absOut === absClone || absOut.startsWith(absClone + '/')) {
      throw new Error('Refusing to write into a clone directory.');
    }
    if (!existsSync(join(absClone, 'index.html'))) {
      throw new Error(`Clone dir missing index.html: ${absClone}`);
    }
  }

  if (existsSync(absOut) && !force) {
    throw new Error(
      `Output directory already exists: ${absOut} (pass --force to overwrite)`,
    );
  }

  mkdirSync(absOut, { recursive: true });

  // Cumulatively copy assets — later pages layer on top of earlier ones.
  const publicDir = join(absOut, 'public');
  let totalAssetCount = 0;
  let totalAssetBytes = 0;

  for (const page of pages) {
    copyAssetsToPublic(resolve(page.cloneDir), publicDir);
    const after = dirSizeBytes(publicDir);
    totalAssetCount = after.count;
    totalAssetBytes = after.bytes;
  }

  // Build the dr-parity responsive @media sheet ahead of slicing. We
  // publish it into /public so every emitted <page>.html can link it via
  // extraStylesheetHrefs. This replaces the previous post-emit HTML patch:
  // a re-emit run now reproduces the same <link> tag because the href is
  // baked into the slice, not patched in afterwards.
  const responsive = buildResponsiveSheet({
    outDir: absOut,
    cloneDirs: pages.map((p) => p.cloneDir),
  });

  // Read every captured index.html up-front so we can compute the union
  // of source-linked stylesheets across siblings before slicing each page.
  const perPageRawHtml = pages.map((p) => ({
    pathname: p.pathname,
    cloneDir: resolve(p.cloneDir),
    html: readFileSync(join(resolve(p.cloneDir), 'index.html'), 'utf8'),
  }));

  // Aggregate every page's source stylesheet hrefs into a single union.
  // The source cascade can rely on stylesheets a given page never linked
  // itself (page A's sheet carries @media blocks the source cascade only
  // loaded on page B). Linking the union into every page matches that
  // cascade pattern more closely than per-page-only injection.
  const publicCssFiles = listPublicCssFiles(publicDir);
  const aggregatedSourceHrefs = unionInOrder(
    perPageRawHtml.map((p) => extractSourceStylesheetHrefs(p.html)),
  );
  const plannedLinks = planCssLinks({
    sourceStylesheetHrefs: aggregatedSourceHrefs,
    publicCssFiles,
  });

  // Slice each page.
  const slices: ReactPageSlice[] = perPageRawHtml.map((p) => {
    const $ = cheerio.load(p.html, null, true);
    const head = extractHead($);

    // Strip body scripts BEFORE slicing so JSX emitter doesn't render
    // them; then splice back into this page's <body>.
    const bodyScripts = collectAndStripBodyScripts($);
    const hoistedBodyScripts = renderHoistedScripts(bodyScripts);

    const { components, pageImports } = sliceBody($);

    // Aggregated extra stylesheet hrefs: every captured stylesheet across
    // sibling pages plus any orphan /public/*.css the source did not
    // link, minus anything already in this page's head verbatim.
    const extraStylesheetHrefs = filterAlreadyLinked(head.innerHTML, plannedLinks);

    // Append the dr-parity responsive sheet href so the link is written
    // at emit time. Appending at the end keeps it last in the cascade so
    // it loses any specificity tie with earlier captured rules. That
    // matches how the source site would have loaded the same @media block
    // via the last-loaded captured stylesheet.
    if (responsive.publicHref) {
      const filteredResponsive = filterAlreadyLinked(head.innerHTML, [
        responsive.publicHref,
      ]);
      if (
        filteredResponsive.length > 0 &&
        !extraStylesheetHrefs.includes(responsive.publicHref)
      ) {
        extraStylesheetHrefs.push(responsive.publicHref);
      }
    }

    const pageName = routeToPageName(p.pathname);
    return {
      route: p.pathname,
      pageName,
      head,
      components,
      pageImports,
      extraStylesheetHrefs,
      hoistedBodyScripts,
    };
  });

  // Dedupe page names. Collisions (same flattened slug from different
  // pathnames) get -2, -3, ... suffixes — same rule as the Astro target.
  const seen = new Map<string, number>();
  for (const slice of slices) {
    const count = (seen.get(slice.pageName) ?? 0) + 1;
    seen.set(slice.pageName, count);
    if (count > 1) {
      slice.pageName = `${slice.pageName}-${count}`;
    }
  }

  const emitSummary = emitMultiPageReact({ outDir: absOut, pages: slices });

  // Shared post-hydration sync lib (consumed by every entry).
  writePostHydrationSyncLib(join(absOut, 'src'));

  // Scaffold with multi-entry vite config listing every page.
  writeMultiScaffold(absOut, name, emitSummary.pagesWritten);

  return {
    pagesEmitted: emitSummary.pagesWritten,
    sharedComponents: emitSummary.sharedComponents,
    perPageComponents: emitSummary.perPageComponents,
    assetCount: totalAssetCount,
    assetBytes: totalAssetBytes,
  };
}

/**
 * Stable, order-preserving union of N string arrays. First occurrence wins
 * for ordering; duplicates are dropped. Used to aggregate every captured
 * page's source stylesheet hrefs into a single cascade so every emitted
 * page links the same superset and the source cascade survives even when
 * a given URL did not link a sibling's stylesheet.
 */
function unionInOrder(lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
