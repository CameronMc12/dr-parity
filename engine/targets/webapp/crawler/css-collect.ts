import type { Page } from 'playwright';

/**
 * A single stylesheet collected from the live page, in document order.
 *
 * `kind` records how the text was obtained so downstream code (and humans
 * auditing the snapshot) can tell apart same-origin serialisation from a
 * cross-origin fetch fallback or an inline `<style>` element.
 */
export type CollectedSheet = {
  href: string | null;
  text: string;
  kind: 'cssRules' | 'fetch' | 'inline';
};

/**
 * Collects, IN DOCUMENT ORDER, the full text of every stylesheet on the live
 * page. Runs entirely inside the page context.
 *
 * Strategy per sheet:
 *  - same-origin / accessible: serialise `cssRules` verbatim (preserves
 *    `@media`, `@keyframes`, `:hover`/`:focus` pseudo, `:root` custom props).
 *  - cross-origin (where `.cssRules` throws): fetch the sheet's `href` text from
 *    the page context. ClickUp CSS is same-site CDN, so the fetch succeeds.
 *  - inline `<style>` element: read `ownerNode.textContent`.
 *
 * Never flattens to computed styles. Returns whatever it can; sheets that fail
 * every path are skipped rather than aborting the whole collection.
 */
export async function collectStylesheets(page: Page): Promise<CollectedSheet[]> {
  // Stringified to dodge esbuild's __name helper injection on nested arrows
  // (tsx target=ES2017), matching the convention in dom-hash.ts.
  const script = `(async () => {
    var out = [];
    var sheets = Array.prototype.slice.call(document.styleSheets);
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var href = sheet.href || null;
      var ownerTag = sheet.ownerNode && sheet.ownerNode.tagName
        ? sheet.ownerNode.tagName.toLowerCase()
        : '';
      // Inline <style>: read its source text directly.
      if (!href && ownerTag === 'style') {
        var inlineText = sheet.ownerNode.textContent || '';
        if (inlineText) out.push({ href: null, text: inlineText, kind: 'inline' });
        continue;
      }
      // Try same-origin serialisation first.
      var serialised = null;
      try {
        var rules = sheet.cssRules;
        if (rules) {
          var parts = [];
          for (var r = 0; r < rules.length; r++) parts.push(rules[r].cssText);
          serialised = parts.join('\\n');
        }
      } catch (e) {
        serialised = null; // cross-origin: cssRules throws
      }
      if (serialised) {
        out.push({ href: href, text: serialised, kind: 'cssRules' });
        continue;
      }
      // Cross-origin fallback: fetch the href text from page context.
      if (href) {
        try {
          var resp = await fetch(href, { credentials: 'include' });
          if (resp && resp.ok) {
            var body = await resp.text();
            if (body) out.push({ href: href, text: body, kind: 'fetch' });
          }
        } catch (e2) {
          // give up on this sheet; do not break the rest
        }
      }
    }
    return out;
  })()`;

  const result = (await page.evaluate(script)) as CollectedSheet[];
  return Array.isArray(result) ? result : [];
}
