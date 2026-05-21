import type { Page } from 'playwright';

/**
 * Builds a stable-ish CSS selector for an element handle. Preference order:
 *   1. [data-testid="..."]
 *   2. [aria-label="..."]
 *   3. tag + nth-of-type chain (with role hint)
 *
 * Uses a string-script payload to avoid esbuild `__name` helper injection
 * inside `page.evaluate` callbacks.
 */
export type BuiltSelector = {
  selector: string;
  label: string;
  tag: string;
};

export async function buildSelectorForHandle(
  page: Page,
  elementId: number,
): Promise<BuiltSelector | null> {
  const script = `((id) => {
    var w = window;
    var el = (w.__drParityElements && w.__drParityElements[id]) || null;
    if (!el || !(el instanceof Element)) return null;
    function cssEscape(s) {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s);
      return s.replace(/(["\\\\#.:>+~()[\\]])/g, '\\\\$1');
    }
    var tag = el.tagName.toLowerCase();
    var testid = el.getAttribute('data-testid');
    if (testid) {
      return { selector: '[data-testid="' + cssEscape(testid) + '"]', label: testid, tag: tag };
    }
    var aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) {
      return { selector: tag + '[aria-label="' + cssEscape(aria) + '"]', label: aria, tag: tag };
    }
    var role = el.getAttribute('role');
    var text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur !== document.documentElement && depth < 6) {
      var parent = cur.parentElement;
      if (!parent) break;
      var children = Array.prototype.slice.call(parent.children);
      var same = children.filter(function (c) { return c.tagName === cur.tagName; });
      var idx = same.indexOf(cur) + 1;
      parts.unshift(cur.tagName.toLowerCase() + ':nth-of-type(' + idx + ')');
      cur = parent;
      depth++;
    }
    var positional = parts.join(' > ');
    return { selector: positional || tag, label: text || role || tag, tag: tag };
  })(${elementId})`;
  return (await page.evaluate(script)) as BuiltSelector | null;
}
