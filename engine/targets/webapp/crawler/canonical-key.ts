/**
 * Composite canonical state key.
 *
 * Whole-DOM hashing alone over-dedups: two genuinely-different states on the
 * same route (a route with a modal open vs. closed, or a different active tab)
 * can hash close enough — or, with id-reroll normalisation, identically — to be
 * wrongly collapsed. Conversely a trivially-different state (an id reroll) must
 * still dedup.
 *
 * The canonical key combines:
 *   - the normalised route URL (content-defining params kept; see url-normalize)
 *   - a SORTED, low-noise structural signature of the visible overlay / tab /
 *     drawer / top-level panel layout
 *   - the existing normalised DOM hash
 *
 * Genuinely-different states differ in the structural signature, so they get
 * distinct keys. Trivially-different states share route + signature + DOM hash,
 * so they still dedup. The whole signature scan is defensive: any failure falls
 * back to an empty signature and the key degrades gracefully to route + hash.
 */

import type { Page } from 'playwright';
import { normalizeRouteUrl } from './url-normalize';

export type StructuralSignature = {
  dialogs: string[];
  activeTabs: string[];
  drawers: string[];
  panels: string[];
};

const EMPTY_SIGNATURE: StructuralSignature = {
  dialogs: [],
  activeTabs: [],
  drawers: [],
  panels: [],
};

/**
 * Reads the visible overlay/tab/drawer/panel structure from the live DOM. Pure
 * read-only. Returns an empty signature on any failure so callers never throw.
 */
export async function scanStructuralSignature(page: Page): Promise<StructuralSignature> {
  const script = `(() => {
    function norm(s) { return (s || '').replace(/\\s+/g, ' ').trim().slice(0, 60); }
    function visible(el) {
      if (!el) return false;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      var st = window.getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return false;
      return true;
    }
    function collect(sel, labeller) {
      var out = [];
      var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!visible(el)) continue;
        var label = labeller(el);
        if (label) out.push(label);
      }
      return out;
    }
    function dialogLabel(el) {
      var aria = el.getAttribute('aria-label');
      if (aria) return 'dialog:' + norm(aria);
      var labelled = el.getAttribute('aria-labelledby');
      if (labelled) {
        var ref = document.getElementById(labelled);
        if (ref) return 'dialog:' + norm(ref.textContent);
      }
      var heading = el.querySelector('h1,h2,h3,[role="heading"]');
      if (heading) return 'dialog:' + norm(heading.textContent);
      return 'dialog:anon';
    }
    function tabLabel(el) {
      var t = norm(el.textContent) || norm(el.getAttribute('aria-label'));
      return t ? 'tab:' + t : 'tab:anon';
    }
    function drawerLabel(el) {
      var aria = el.getAttribute('aria-label');
      if (aria) return 'drawer:' + norm(aria);
      var cls = norm(el.getAttribute('class'));
      return 'drawer:' + (cls || 'anon');
    }
    function panelLabel(el) {
      var id = el.getAttribute('id') || '';
      var role = el.getAttribute('role') || el.tagName.toLowerCase();
      return 'panel:' + role + (id ? '#' + id : '');
    }

    var dialogs = collect('[role="dialog"], [role="alertdialog"], [aria-modal="true"]', dialogLabel);
    var activeTabs = collect('[role="tab"][aria-selected="true"], [aria-selected="true"][role="tab"], .tab.active, [role="tab"].active', tabLabel);
    var drawers = collect('[role="complementary"], [class*="drawer" i][aria-hidden="false"], aside[aria-hidden="false"], [class*="popover" i]', drawerLabel);
    var topPanels = collect('main, [role="main"], [role="region"], [role="tabpanel"]:not([hidden])', panelLabel);

    return {
      dialogs: dialogs,
      activeTabs: activeTabs,
      drawers: drawers,
      panels: topPanels.slice(0, 12)
    };
  })()`;

  try {
    const raw = (await page.evaluate(script)) as Partial<StructuralSignature> | null;
    if (!raw) return { ...EMPTY_SIGNATURE };
    return {
      dialogs: Array.isArray(raw.dialogs) ? raw.dialogs : [],
      activeTabs: Array.isArray(raw.activeTabs) ? raw.activeTabs : [],
      drawers: Array.isArray(raw.drawers) ? raw.drawers : [],
      panels: Array.isArray(raw.panels) ? raw.panels : [],
    };
  } catch {
    return { ...EMPTY_SIGNATURE };
  }
}

/** Serialise a structural signature into a stable, sorted string. */
function serialiseSignature(sig: StructuralSignature): string {
  const parts = [
    ...sig.dialogs,
    ...sig.activeTabs,
    ...sig.drawers,
    ...sig.panels,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  return parts.join('|');
}

/**
 * Compose the canonical key from the page URL, the structural signature, and
 * the already-computed normalised DOM hash.
 */
export function composeCanonicalKey(
  url: string,
  sig: StructuralSignature,
  domHash: string,
): string {
  const route = normalizeRouteUrl(url);
  return `${route}::${serialiseSignature(sig)}::${domHash}`;
}

/** Convenience: scan the live page and compose the key in one call. */
export async function computeCanonicalKey(
  page: Page,
  domHash: string,
): Promise<string> {
  const sig = await scanStructuralSignature(page);
  return composeCanonicalKey(page.url(), sig, domHash);
}
