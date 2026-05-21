import { createHash } from 'node:crypto';
import type { Page } from 'playwright';

/**
 * Normalises the DOM by stripping volatile attributes (style, auto-generated
 * ids, aria-describedby refs, live-clock text) before hashing. Two structurally
 * identical states should yield the same hash even if React rerolled an id.
 *
 * Runs inside the page context so we get the live DOM after interactions.
 */
export async function computeDomHash(page: Page): Promise<{
  hash: string;
  rawHtml: string;
  normalisedHtml: string;
}> {
  // Pass the function as a string-stringified script to avoid esbuild's __name
  // helper injection on nested arrow expressions (tsx target=ES2017).
  const script = `(() => {
    var VOLATILE_ATTRS = ['style','data-reactid','aria-describedby','aria-labelledby','aria-controls','aria-owns'];
    function isAutoId(value) {
      if (!value) return false;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(value)) return true;
      if (/^(?:radix|headlessui|reach|react-aria|floating-ui|rmsc)[-:]/i.test(value)) return true;
      if (/^[a-z0-9_-]{16,}$/i.test(value) && /\\d/.test(value)) return true;
      if (/^:r[0-9a-z]+:?$/i.test(value)) return true;
      return false;
    }
    var root = document.documentElement.cloneNode(true);
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      for (var j = 0; j < VOLATILE_ATTRS.length; j++) el.removeAttribute(VOLATILE_ATTRS[j]);
      var id = el.getAttribute('id');
      if (id && isAutoId(id)) el.removeAttribute('id');
      var className = el.getAttribute('class');
      if (className) {
        var sorted = className.split(/\\s+/).filter(Boolean).sort().join(' ');
        el.setAttribute('class', sorted);
      }
      var tag = el.tagName.toLowerCase();
      var cls = (el.getAttribute('class') || '').toLowerCase();
      var hasDatetime = el.hasAttribute('datetime');
      var looksLiveTime = tag === 'time' || hasDatetime || /\\b(time|date|clock|timer|elapsed|countdown)\\b/.test(cls);
      if (looksLiveTime) {
        var children = Array.prototype.slice.call(el.childNodes);
        for (var k = 0; k < children.length; k++) {
          if (children[k].nodeType === Node.TEXT_NODE) children[k].textContent = '';
        }
      }
    }
    var raw = document.documentElement.outerHTML;
    var normalised = root.outerHTML.replace(/>\\s+</g, '><').replace(/\\s{2,}/g, ' ').trim();
    return { rawHtml: raw, normalisedHtml: normalised };
  })()`;
  const result = (await page.evaluate(script)) as { rawHtml: string; normalisedHtml: string };
  const { rawHtml, normalisedHtml } = result;

  const hash = createHash('sha256').update(normalisedHtml).digest('hex');
  return { hash, rawHtml, normalisedHtml };
}
