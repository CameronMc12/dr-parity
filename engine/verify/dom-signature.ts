import type { Page } from 'playwright';

/**
 * Captures a normalized DOM signature inside the page. Each node becomes a
 * string token combining tag, stable classes, and trimmed text. Volatile
 * attributes (ids, _ngcontent/_nghost hashes, data-* hashes, timestamps) are
 * dropped so structural similarity is not punished for runtime noise.
 */
const SIGNATURE_FN = `() => {
  const VOLATILE_CLASS = /^(ng-|_ng|css-[a-z0-9]{4,}$|sc-[A-Za-z0-9]{5,}$|jsx-\\\\d+$)/;
  const TIMESTAMP = /\\\\b\\\\d{1,2}:\\\\d{2}(:\\\\d{2})?\\\\s?(am|pm)?\\\\b/gi;
  const LONGNUM = /\\\\b\\\\d{4,}\\\\b/g;
  const normClasses = (el) => {
    const out = [];
    for (const c of el.classList) {
      if (!c) continue;
      if (VOLATILE_CLASS.test(c)) continue;
      out.push(c);
    }
    return out.sort();
  };
  const normText = (el) => {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.textContent || '';
    }
    t = t.replace(/\\\\s+/g, ' ').trim();
    if (!t) return '';
    t = t.replace(TIMESTAMP, '<ts>').replace(LONGNUM, '<n>');
    return t.slice(0, 64);
  };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const tokens = [];
  const walk = (el, depth) => {
    if (depth > 40) return;
    if (SKIP.has(el.tagName)) return;
    const tag = el.tagName.toLowerCase();
    const cls = normClasses(el).join('.');
    const text = normText(el);
    tokens.push(tag + '|' + cls + '|' + text);
    for (const child of el.children) walk(child, depth + 1);
  };
  if (document.body) walk(document.body, 0);
  return tokens;
}`;

export async function captureDomSignature(page: Page): Promise<string[]> {
  try {
    const tokens = await page.evaluate(SIGNATURE_FN as unknown as () => string[]);
    return Array.isArray(tokens) ? tokens : [];
  } catch {
    return [];
  }
}

/**
 * Structural similarity between two normalized DOM signatures. Uses a
 * multiset (bag) intersection over union of node tokens, which is order- and
 * insertion-robust and bounded in 0..1.
 */
export function domSimilarity(ref: string[], cand: string[]): number {
  if (ref.length === 0 && cand.length === 0) return 1;
  if (ref.length === 0 || cand.length === 0) return 0;

  const refCounts = new Map<string, number>();
  for (const t of ref) refCounts.set(t, (refCounts.get(t) ?? 0) + 1);

  const candCounts = new Map<string, number>();
  for (const t of cand) candCounts.set(t, (candCounts.get(t) ?? 0) + 1);

  let intersection = 0;
  for (const [token, refCount] of refCounts) {
    const candCount = candCounts.get(token) ?? 0;
    intersection += Math.min(refCount, candCount);
  }

  const union = ref.length + cand.length - intersection;
  return union > 0 ? intersection / union : 0;
}
