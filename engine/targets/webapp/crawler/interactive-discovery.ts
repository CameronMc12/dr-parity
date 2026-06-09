import type { Page } from 'playwright';
import { isBlocked } from './blocklist';

const INTERACTIVE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'select',
  'summary',
  '[data-toggle]',
  '[data-modal]',
] as const;

export type DiscoveredElement = {
  index: number;
  selectorHint: string;
  text: string;
  ariaLabel: string;
  tag: string;
  role: string | null;
  blocked: boolean;
};

type RawElement = {
  index: number;
  text: string;
  ariaLabel: string;
  tag: string;
  role: string | null;
  blocked: boolean;
  selectorHint: string;
};

/**
 * Walks the live DOM, finds interactive elements visible inside the viewport,
 * stashes them on `window.__drParityElements` so the caller can re-reach them
 * via Playwright `page.evaluate` calls keyed by index.
 *
 * Uses a string-script payload to avoid esbuild's `__name` helper injection
 * that breaks inside `page.evaluate` callbacks.
 */
export async function discoverInteractive(
  page: Page,
  extraBlocklist: string[],
): Promise<DiscoveredElement[]> {
  const selectorList = INTERACTIVE_SELECTORS.join(',');
  const payload = JSON.stringify({ selectorList, extraBlocklist });
  const script = `(() => {
    var ARGS = ${payload};
    var w = window;
    w.__drParityElements = [];
    function isVisible(el) {
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      var style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      if (parseFloat(style.opacity || '1') < 0.05) return false;
      var vw = window.innerWidth, vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return false;
      if (rect.right < 0 || rect.left > vw) return false;
      return true;
    }
    var ALWAYS_BLOCKED_TEXT = ['delete','remove','log out','logout','sign out','cancel subscription','cancel plan','unsubscribe','disconnect','revoke','archive','trash','clear all','reset','confirm payment','purchase','pay','send'];
    var DANGER_CLASS_RE = /\\b(destructive|danger|delete|trash)\\b/i;
    function isBlockedInPage(el) {
      var text = (el.textContent || '').toLowerCase().trim();
      var aria = (el.getAttribute('aria-label') || '').toLowerCase().trim();
      var cls = el.getAttribute('class') || '';
      var haystacks = [text, aria].filter(Boolean);
      for (var i = 0; i < ALWAYS_BLOCKED_TEXT.length; i++) {
        var phrase = ALWAYS_BLOCKED_TEXT[i];
        for (var j = 0; j < haystacks.length; j++) if (haystacks[j].indexOf(phrase) !== -1) return true;
      }
      for (var i2 = 0; i2 < ARGS.extraBlocklist.length; i2++) {
        var p = ARGS.extraBlocklist[i2].toLowerCase().trim();
        if (!p) continue;
        for (var j2 = 0; j2 < haystacks.length; j2++) if (haystacks[j2].indexOf(p) !== -1) return true;
      }
      if (DANGER_CLASS_RE.test(cls)) return true;
      var cur = el.parentElement;
      var depth = 0;
      while (cur && depth < 6) {
        var c = cur.getAttribute('class') || '';
        if (DANGER_CLASS_RE.test(c)) return true;
        cur = cur.parentElement;
        depth++;
      }
      var type = el.type || null;
      var insideForm = !!el.closest('form');
      if (type === 'submit' && insideForm) return true;
      return false;
    }
    var candidates = Array.prototype.slice.call(document.querySelectorAll(ARGS.selectorList));
    var seen = new Set();
    var out = [];
    var index = 0;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (seen.has(el)) continue;
      seen.add(el);
      if (!isVisible(el)) continue;
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
      var ariaLabel = el.getAttribute('aria-label') || '';
      var tag = el.tagName.toLowerCase();
      var role = el.getAttribute('role');
      var blocked = isBlockedInPage(el);
      var testid = el.getAttribute('data-testid');
      var selectorHint = testid
        ? '[data-testid="' + testid + '"]'
        : (ariaLabel
            ? tag + '[aria-label="' + ariaLabel + '"]'
            : tag + (text ? ' ("' + text.slice(0, 30) + '")' : ''));
      w.__drParityElements.push(el);
      out.push({ index: index, text: text, ariaLabel: ariaLabel, tag: tag, role: role, blocked: blocked, selectorHint: selectorHint });
      index++;
      if (out.length >= 200) break;
    }
    return out;
  })()`;

  const raw = (await page.evaluate(script)) as RawElement[];

  // Sanity guard: also run host-side blocklist (defence in depth).
  return raw.map((r) => ({
    ...r,
    role: r.role ?? null,
    blocked:
      r.blocked ||
      isBlocked(
        {
          text: r.text,
          ariaLabel: r.ariaLabel,
          className: null,
          type: null,
          insideForm: false,
          ancestorClasses: [],
        },
        extraBlocklist,
      ),
  }));
}

export async function discoverRightClickTargets(page: Page): Promise<number[]> {
  const script = `(() => {
    var w = window;
    if (!w.__drParityElements) w.__drParityElements = [];
    var sel = [
      '[role="row"]', '[role="listitem"]', '[data-context-menu]', 'li', '.card',
      // ClickUp task rows (custom web components, no role="row").
      '.cu-task-row', '[class*="cu-task-row" i]', '[class*="task-row" i]',
      // Board cards.
      '.cu-board-card', '[class*="board-card" i]',
      // Sidebar items: spaces / folders / lists. Right-click surfaces the
      // space/folder/list context menu (rename, color, create, delete, etc.).
      '[class*="sidebar" i] [class*="item" i]',
      'nav [role="treeitem"]',
      '[class*="cu-sidebar" i] a',
      '[data-test*="sidebar" i] [class*="row" i]',
      '[class*="sidebar" i] [class*="space" i]',
      '[class*="sidebar" i] [class*="folder" i]',
      '[class*="sidebar" i] [class*="list" i]'
    ].join(', ');
    var seen = new Set();
    var indices = [];
    var candidates = Array.prototype.slice.call(document.querySelectorAll(sel));
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (seen.has(el)) continue;
      seen.add(el);
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      w.__drParityElements.push(el);
      indices.push(w.__drParityElements.length - 1);
      if (indices.length >= 24) break;
    }
    return indices;
  })()`;
  return (await page.evaluate(script)) as number[];
}
