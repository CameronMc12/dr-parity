/**
 * Autonomous site crawler for multi-page cloning.
 *
 * Wraps `discoverPages()` from multi-page.ts with:
 *   - A real Playwright browser launch (so we can crawl any public URL)
 *   - Recursive depth-N discovery (default 3)
 *   - robots.txt awareness (skip URLs disallowed for `*`)
 *   - Noise filtering (wp-admin, feed, replytocom, asset extensions)
 *   - Per-page rate limiting (default 2s)
 *   - Hard caps (default 50 pages, depth 3)
 */

import { chromium, type Browser, type Page } from 'playwright';
import { discoverPages, matchesPathPrefix, normalizePathPrefix } from './multi-page';

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_RATE_LIMIT_MS = 2000;

const NOISE_PATH_PATTERNS = [
  /\/wp-admin(\/|$)/i,
  /\/wp-login/i,
  /\/wp-json(\/|$)/i,
  /\/xmlrpc\.php$/i,
  /\/feed(\/|$)/i,
  /\/rss(\/|$)/i,
  /\/cdn-cgi(\/|$)/i,
  /\/trackback(\/|$)/i,
  /\/comments(\/|$)/i,
  /\/tag\//i,
  /\/category\//i,
  /\/author\//i,
  /\/page\/\d+/i,
];

const NOISE_QUERY_KEYS = new Set([
  'replytocom',
  'share',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
]);

const NON_HTML_EXTENSIONS = new Set([
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.mp3', '.mp4', '.webm', '.mov', '.wav', '.ogg',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.css', '.js', '.json', '.xml', '.map',
  '.dmg', '.exe', '.pkg', '.deb',
]);

export interface CrawlOptions {
  entryUrl: string;
  maxPages?: number;
  maxDepth?: number;
  rateLimitMs?: number;
  respectRobots?: boolean;
  /**
   * Restrict crawling to URLs whose pathname starts with this prefix.
   * Example: `/en` keeps `/en` and `/en/about`, skips `/` and `/fr/about`.
   * Empty string or undefined disables prefix filtering.
   */
  pathPrefix?: string;
  /** Optional progress callback, called per discovered URL. */
  onProgress?: (info: { url: string; depth: number; total: number }) => void;
}

export interface CrawlResult {
  urls: string[];
  origin: string;
  truncatedAt?: 'max-pages' | 'max-depth';
  skipped: { url: string; reason: string }[];
}

export async function crawlSite(opts: CrawlOptions): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const rateLimit = opts.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
  const respectRobots = opts.respectRobots ?? true;
  const pathPrefix = normalizePathPrefix(opts.pathPrefix);

  const entryNormalized = normalizeForCrawl(opts.entryUrl);
  const origin = new URL(entryNormalized).origin;

  // The seed URL must satisfy the prefix; otherwise the crawl would have
  // nothing to expand from. Fail loudly instead of silently producing zero pages.
  if (pathPrefix && !matchesPathPrefix(entryNormalized, pathPrefix)) {
    const seedPath = new URL(entryNormalized).pathname;
    throw new Error(
      `Seed URL pathname "${seedPath}" does not start with --path-prefix="${pathPrefix}". ` +
        `Either change the seed URL or update the prefix.`,
    );
  }

  const disallowed = respectRobots
    ? await fetchRobotsDisallows(origin)
    : [];

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: entryNormalized, depth: 0 }];
  const skipped: { url: string; reason: string }[] = [];
  let truncatedAt: 'max-pages' | 'max-depth' | undefined;

  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    while (queue.length > 0) {
      if (visited.size >= maxPages) {
        truncatedAt = 'max-pages';
        break;
      }

      const next = queue.shift();
      if (!next) break;

      const { url, depth } = next;
      if (visited.has(url)) continue;

      if (!sameOrigin(url, origin)) continue;
      if (pathPrefix && !matchesPathPrefix(url, pathPrefix)) {
        skipped.push({ url, reason: `path-prefix:${pathPrefix}` });
        continue;
      }
      if (!shouldKeep(url, disallowed)) {
        skipped.push({ url, reason: classifySkip(url, disallowed) });
        continue;
      }

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      } catch (err) {
        skipped.push({
          url,
          reason: `nav-failed: ${err instanceof Error ? err.message : String(err)}`,
        });
        continue;
      }

      visited.add(url);
      opts.onProgress?.({ url, depth, total: visited.size });

      if (depth >= maxDepth) {
        // Don't expand further from this node, but it counts as visited.
        if (queue.length === 0) break;
        continue;
      }

      const children = await safeDiscover(page, url, pathPrefix);
      for (const child of children) {
        const normalized = normalizeForCrawl(child);
        if (visited.has(normalized)) continue;
        if (!sameOrigin(normalized, origin)) continue;
        if (pathPrefix && !matchesPathPrefix(normalized, pathPrefix)) continue;
        queue.push({ url: normalized, depth: depth + 1 });
      }

      if (rateLimit > 0 && queue.length > 0) {
        await sleep(rateLimit);
      }
    }

    if (visited.size >= maxPages) truncatedAt = 'max-pages';
    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }

  const urls = Array.from(visited);
  // Ensure entry URL is first.
  urls.sort((a, b) => {
    if (a === entryNormalized) return -1;
    if (b === entryNormalized) return 1;
    return a.localeCompare(b);
  });

  return { urls, origin, truncatedAt, skipped };
}

async function safeDiscover(
  page: Page,
  entryUrl: string,
  pathPrefix: string,
): Promise<string[]> {
  try {
    return await discoverPages(page, entryUrl, 500, pathPrefix || undefined);
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Normalize a URL for crawl-dedup purposes:
 *   - lowercase host
 *   - strip fragment
 *   - strip noise query keys; keep only meaningful query params (sorted)
 *   - strip trailing slash (except root)
 */
export function normalizeForCrawl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';

    const keep: [string, string][] = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (NOISE_QUERY_KEYS.has(k.toLowerCase())) continue;
      keep.push([k, v]);
    }
    keep.sort(([a], [b]) => a.localeCompare(b));
    u.search = '';
    for (const [k, v] of keep) u.searchParams.append(k, v);

    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;
    u.host = u.host.toLowerCase();
    return u.href;
  } catch {
    return url;
  }
}

function shouldKeep(url: string, disallowed: string[]): boolean {
  try {
    const u = new URL(url);
    const pathname = u.pathname.toLowerCase();

    // Reject non-HTML extensions
    const dot = pathname.lastIndexOf('.');
    if (dot !== -1) {
      const ext = pathname.slice(dot);
      if (NON_HTML_EXTENSIONS.has(ext)) return false;
    }

    // Reject noise patterns
    for (const pattern of NOISE_PATH_PATTERNS) {
      if (pattern.test(pathname)) return false;
    }

    // Robots.txt disallows
    for (const path of disallowed) {
      if (path && pathname.startsWith(path.toLowerCase())) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function classifySkip(url: string, disallowed: string[]): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const dot = pathname.lastIndexOf('.');
    if (dot !== -1 && NON_HTML_EXTENSIONS.has(pathname.slice(dot))) {
      return 'non-html-extension';
    }
    for (const pattern of NOISE_PATH_PATTERNS) {
      if (pattern.test(pathname)) return `noise:${pattern.source}`;
    }
    for (const path of disallowed) {
      if (path && pathname.startsWith(path.toLowerCase())) return `robots:${path}`;
    }
    return 'filtered';
  } catch {
    return 'invalid-url';
  }
}

/**
 * Fetch and parse robots.txt. Returns a flat list of Disallow paths that
 * apply to user-agent `*`. Best-effort: any fetch/parse error returns `[]`.
 */
export async function fetchRobotsDisallows(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseRobotsForStar(text);
  } catch {
    return [];
  }
}

export function parseRobotsForStar(robotsTxt: string): string[] {
  const lines = robotsTxt.split(/\r?\n/);
  const disallows: string[] = [];
  let inStarBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (line.length === 0) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      inStarBlock = value === '*';
      continue;
    }

    if (inStarBlock && key === 'disallow' && value.length > 0) {
      disallows.push(value);
    }
  }

  return disallows;
}
