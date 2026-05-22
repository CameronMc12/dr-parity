import type { Page } from 'playwright';

const NAV_TEXT_PATTERNS = [
  'home',
  'dashboard',
  'calendar',
  'posts',
  'inbox',
  'messages',
  'analytics',
  'reports',
  'reviews',
  'library',
  'workflows',
  'approval',
  'settings',
  'profile',
];

export type NavLink = { url: string };

export function routePathOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return rawUrl;
  }
}

/**
 * Discovers "top-level nav links" so the crawler can prioritise breadth across
 * the app over depth in any single route. Combines structural selectors
 * (nav/aside/header/[role=navigation]) with a text-based heuristic against
 * common SaaS nav labels.
 */
export async function discoverNavLinks(
  page: Page,
  currentUrl: string,
): Promise<NavLink[]> {
  const payload = JSON.stringify({ patterns: NAV_TEXT_PATTERNS });
  const script = `(() => {
    var ARGS = ${payload};
    var SEL = 'nav a[href], [role="navigation"] a[href], aside a[href], header a[href]';
    var seen = new Set();
    var out = [];
    function isVisible(el) {
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      var style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return true;
    }
    function pushIf(href) {
      if (!href) return;
      if (seen.has(href)) return;
      seen.add(href);
      out.push({ url: href });
    }
    var structural = Array.prototype.slice.call(document.querySelectorAll(SEL));
    for (var i = 0; i < structural.length; i++) {
      var el = structural[i];
      if (!isVisible(el)) continue;
      try { pushIf(el.href); } catch (e) {}
    }
    var allLinks = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
    for (var j = 0; j < allLinks.length; j++) {
      var a = allLinks[j];
      if (!isVisible(a)) continue;
      var text = (a.textContent || '').toLowerCase().trim();
      if (!text) continue;
      for (var k = 0; k < ARGS.patterns.length; k++) {
        if (text === ARGS.patterns[k] || text.indexOf(ARGS.patterns[k]) === 0) {
          try { pushIf(a.href); } catch (e) {}
          break;
        }
      }
    }
    return out;
  })()`;
  const raw = (await page.evaluate(script)) as NavLink[];
  const currentPath = routePathOf(currentUrl);
  let currentOrigin: string | null = null;
  try {
    currentOrigin = new URL(currentUrl).origin;
  } catch {
    currentOrigin = null;
  }
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of raw) {
    if (!item.url) continue;
    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      continue;
    }
    if (currentOrigin && parsed.origin !== currentOrigin) continue;
    if (parsed.pathname === currentPath) continue;
    const key = parsed.origin + parsed.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: parsed.toString() });
  }
  return out;
}
