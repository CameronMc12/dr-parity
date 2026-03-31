/**
 * Multi-page extraction support for Dr Parity.
 *
 * Enables crawling and extracting data from multiple pages of a site,
 * detecting shared layout components, and identifying route patterns
 * for Next.js App Router code generation.
 */

import type { Page } from 'playwright';
import type { PageData, SectionSpec } from '../types/extraction';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MultiPageMode = 'single' | 'multi-manual' | 'multi-crawl';

export interface MultiPageOptions {
  entryUrl: string;
  mode: MultiPageMode;
  /** Explicit URL list for manual mode. */
  pageList?: string[];
  /** Maximum pages to crawl in crawl mode. Default 20. */
  maxPages?: number;
  extractionOptions?: {
    maxDepth?: number;
    maxElements?: number;
  };
}

export interface MultiPageResult {
  pages: PageExtractionEntry[];
  sharedLayout?: SharedLayoutInfo;
  routes: DetectedRoute[];
  totalPages: number;
}

export interface PageExtractionEntry {
  url: string;
  /** URL path segment, e.g. /about, /blog/post-1 */
  path: string;
  pageData: PageData;
  isHomepage: boolean;
}

export interface SharedLayoutInfo {
  headerSelector?: string;
  footerSelector?: string;
  navSelector?: string;
  sidebarSelector?: string;
  /** Section IDs that appear on multiple pages. */
  sharedSectionIds: string[];
}

export interface DetectedRoute {
  /** Route pattern, e.g. /blog/[slug] */
  pattern: string;
  /** Concrete paths matching this pattern. */
  examplePaths: string[];
  isDynamic: boolean;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PAGES = 20;

const ASSET_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.webm', '.mov',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.css', '.js', '.map',
]);

// ---------------------------------------------------------------------------
// Page discovery (crawl mode)
// ---------------------------------------------------------------------------

/**
 * Crawl a site starting from `entryUrl` and return a deduplicated,
 * sorted list of internal page URLs (up to `maxPages`).
 */
export async function discoverPages(
  page: Page,
  entryUrl: string,
  maxPages?: number,
): Promise<string[]> {
  const limit = maxPages ?? DEFAULT_MAX_PAGES;
  const origin = new URL(entryUrl).origin;

  const rawLinks: string[] = await page.evaluate((pageOrigin: string) => {
    const anchors = document.querySelectorAll('a[href]');
    const hrefs: string[] = [];

    for (const anchor of Array.from(anchors)) {
      const href = (anchor as HTMLAnchorElement).href;
      if (!href) continue;

      try {
        const url = new URL(href, document.baseURI);
        if (url.origin === pageOrigin) {
          hrefs.push(url.href);
        }
      } catch {
        // Malformed URL — skip
      }
    }

    return hrefs;
  }, origin);

  const normalized = normalizeUrls(rawLinks, origin);
  const filtered = filterPageUrls(normalized);

  // Always include the entry URL at the start
  const entryNormalized = normalizeUrl(entryUrl);
  const withEntry = [entryNormalized, ...filtered.filter((u) => u !== entryNormalized)];

  return withEntry.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Shared layout detection
// ---------------------------------------------------------------------------

/**
 * Compare extracted PageData across multiple pages to find sections
 * that appear consistently (header, footer, sidebar, nav).
 */
export function detectSharedLayout(pages: PageData[]): SharedLayoutInfo {
  if (pages.length < 2) {
    return { sharedSectionIds: [] };
  }

  // Build a fingerprint for each section: tag-like name + className prefix
  type SectionFingerprint = {
    name: string;
    className: string;
    position: number; // relative position: 0 = first, 1 = last
    sections: SectionSpec[];
  };

  const fingerprintsByPage: SectionFingerprint[][] = pages.map((pd) =>
    pd.sections.map((s, idx) => ({
      name: s.name,
      className: normalizeClassName(s.className),
      position: idx / Math.max(pd.sections.length - 1, 1),
      sections: [s],
    })),
  );

  // Find fingerprints that appear across ALL pages
  const sharedSectionIds: string[] = [];
  let headerSelector: string | undefined;
  let footerSelector: string | undefined;
  let navSelector: string | undefined;
  let sidebarSelector: string | undefined;

  if (fingerprintsByPage.length === 0) {
    return { sharedSectionIds: [] };
  }

  const firstPageFPs = fingerprintsByPage[0];
  for (const fp of firstPageFPs) {
    const matchesAllPages = fingerprintsByPage.every((pageFPs) =>
      pageFPs.some((otherFP) => fingerprintsMatch(fp, otherFP)),
    );

    if (!matchesAllPages) continue;

    sharedSectionIds.push(fp.sections[0].id);

    // Classify by position and name
    const nameLC = fp.name.toLowerCase();
    if (fp.position < 0.15 || nameLC === 'header' || nameLC === 'nav') {
      if (nameLC === 'header' || nameLC.includes('header')) {
        headerSelector = buildSectionSelector(fp.sections[0]);
      }
      if (nameLC === 'nav' || nameLC.includes('navigation')) {
        navSelector = buildSectionSelector(fp.sections[0]);
      }
      // If it's at the top but we haven't classified it yet, default to header
      if (!headerSelector && fp.position < 0.1) {
        headerSelector = buildSectionSelector(fp.sections[0]);
      }
    }

    if (fp.position > 0.85 || nameLC === 'footer') {
      footerSelector = buildSectionSelector(fp.sections[0]);
    }

    // Sidebar detection: narrow width relative to viewport, consistent side position
    const section = fp.sections[0];
    if (
      section.boundingRect.width > 0 &&
      section.boundingRect.width < 400 &&
      (section.boundingRect.left < 10 || section.boundingRect.left > 800)
    ) {
      sidebarSelector = buildSectionSelector(section);
    }
  }

  return {
    headerSelector,
    footerSelector,
    navSelector,
    sidebarSelector,
    sharedSectionIds,
  };
}

// ---------------------------------------------------------------------------
// Route pattern detection
// ---------------------------------------------------------------------------

/**
 * Analyze a set of URL paths and detect dynamic route patterns
 * suitable for Next.js App Router `[slug]` segments.
 */
export function detectRoutePatterns(paths: string[]): DetectedRoute[] {
  const cleanPaths = paths
    .map((p) => {
      try {
        return new URL(p, 'http://localhost').pathname;
      } catch {
        return p;
      }
    })
    .map((p) => (p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p));

  // Group by depth (number of path segments)
  const byDepth = new Map<number, string[]>();
  for (const path of cleanPaths) {
    const segments = path.split('/').filter(Boolean);
    const depth = segments.length;
    const existing = byDepth.get(depth) ?? [];
    existing.push(path);
    byDepth.set(depth, existing);
  }

  const routes: DetectedRoute[] = [];

  for (const [depth, depthPaths] of byDepth) {
    if (depth === 0) {
      // Root path
      routes.push({
        pattern: '/',
        examplePaths: ['/'],
        isDynamic: false,
        pageCount: 1,
      });
      continue;
    }

    // Group paths by shared prefix (all segments except the last)
    const byPrefix = new Map<string, string[]>();
    for (const path of depthPaths) {
      const segments = path.split('/').filter(Boolean);
      const prefix = segments.length > 1
        ? '/' + segments.slice(0, -1).join('/')
        : '/';
      const existing = byPrefix.get(prefix) ?? [];
      existing.push(path);
      byPrefix.set(prefix, existing);
    }

    for (const [prefix, prefixPaths] of byPrefix) {
      if (prefixPaths.length >= 2) {
        // Dynamic route: 2+ paths share a prefix but differ in the last segment
        const pattern = prefix === '/'
          ? '/[slug]'
          : `${prefix}/[slug]`;
        routes.push({
          pattern,
          examplePaths: prefixPaths,
          isDynamic: true,
          pageCount: prefixPaths.length,
        });
      } else {
        // Static route
        routes.push({
          pattern: prefixPaths[0],
          examplePaths: prefixPaths,
          isDynamic: false,
          pageCount: 1,
        });
      }
    }
  }

  // Sort: static routes first, then dynamic, alphabetically within each group
  routes.sort((a, b) => {
    if (a.isDynamic !== b.isDynamic) return a.isDynamic ? 1 : -1;
    return a.pattern.localeCompare(b.pattern);
  });

  return routes;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash, query params, and trailing slash
    parsed.hash = '';
    parsed.search = '';
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    return parsed.href;
  } catch {
    return url;
  }
}

function normalizeUrls(urls: string[], _origin: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result.sort();
}

function filterPageUrls(urls: string[]): string[] {
  return urls.filter((url) => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.toLowerCase();

      // Filter out asset URLs
      for (const ext of ASSET_EXTENSIONS) {
        if (pathname.endsWith(ext)) return false;
      }

      // Filter out mailto/tel links (shouldn't be here but safety check)
      if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') {
        return false;
      }

      // Filter out fragment-only links
      if (parsed.pathname === '' || parsed.pathname === '/') {
        // Keep the homepage
        return true;
      }

      return true;
    } catch {
      return false;
    }
  });
}

function normalizeClassName(className: string): string {
  if (!className) return '';
  // Take first 3 significant class names for fingerprinting
  return className
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('__') && c.length < 40)
    .slice(0, 3)
    .sort()
    .join(' ');
}

function fingerprintsMatch(
  a: { name: string; className: string },
  b: { name: string; className: string },
): boolean {
  // Match by name
  if (a.name && b.name && a.name === b.name) return true;
  // Match by className overlap
  if (a.className && b.className && a.className === b.className) return true;
  return false;
}

function buildSectionSelector(section: SectionSpec): string {
  if (section.className) {
    const firstClass = section.className.split(/\s+/)[0];
    if (firstClass) return `.${firstClass}`;
  }
  return section.name;
}
