/**
 * Detect the persistent SHELL vs the per-route CONTENT outlet across a set of
 * captured base DOMs.
 *
 * The captured app (e.g. ClickUp, an Angular SPA) renders the same chrome on
 * every route: a global nav rail (`cu-simple-bar`), top bar, and a host element
 * whose INNER content is swapped by the framework router when the route
 * changes. The shell is the common subtree; the content outlet is the single
 * container whose inner subtree differs across every route while its ancestor
 * chain and sibling set stay constant.
 *
 * Heuristic (robust, framework-agnostic):
 *   1. Walk down the largest common structural prefix from <body>. At each
 *      level normalise away framework noise classes (`ng-star-inserted`,
 *      `ng-*`, hashed scope ids) so cosmetic per-route class flips do not read
 *      as structural divergence.
 *   2. While every doc has the SAME normalised child-signature list, the level
 *      is shell. Descend through unique single-child chains directly.
 *   3. When a level has multiple children, find children whose own SUBTREE
 *      differs across docs (by inner-HTML length spread) versus children that
 *      stay byte-stable. A child that is stable across all routes is shell
 *      (e.g. the sidebar). A child that varies is a content candidate.
 *   4. The content outlet is the DEEPEST single container that (a) has a
 *      varying subtree across all routes and (b) whose constant-sibling set is
 *      non-empty OR whose parent holds it as the sole varying child. We descend
 *      into the varying child as long as exactly one child varies; we stop when
 *      the varying node has no single deeper varying child to descend into.
 *
 * Returns a list of candidate selector segments forming an absolute path from
 * <body>, plus the resolved final selector. Icon-sprite style siblings (pure
 * `<svg><symbol>` defs that legitimately differ per route but are not content)
 * are excluded via a structural guard: a varying child is only followed when it
 * contains non-`<symbol>`/`<defs>` element children.
 */

const NOISE_CLASS_RE = /^(ng-[\w-]*|cdk-[\w-]*|_ng[\w-]*)$/;

function normClasses(classAttr: string | undefined): string[] {
  if (!classAttr) return [];
  return classAttr
    .trim()
    .split(/\s+/)
    .filter((c) => c.length > 0 && c !== 'ng-star-inserted' && !NOISE_CLASS_RE.test(c));
}

/** Stable structural signature of an element, ignoring framework noise. */
function sigOf($: any, el: any): string {
  if (!el) return '(null)';
  const tag = (el.tagName || el.name || '').toLowerCase();
  if (tag.length === 0) return '#text';
  const id = $(el).attr('id');
  const idPart = id ? `#${id}` : '';
  const cls = normClasses($(el).attr('class')).slice(0, 5).join('.');
  return `${tag}${idPart}${cls.length > 0 ? '.' + cls : ''}`;
}

function childSigs($: any, el: any): string[] {
  if (!el) return [];
  return $(el)
    .children()
    .toArray()
    .map((c: any) => sigOf($, c));
}

/**
 * A varying child is content-like only when its subtree contains real layout
 * elements, not just SVG sprite defs. ClickUp injects per-route icon symbols
 * into a shared `<svg>` sprite; that legitimately differs per route but is
 * chrome, not content. Reject candidates whose element children are entirely
 * `<symbol>` / `<defs>`.
 */
function isSpriteLike($: any, el: any): boolean {
  if (!el) return false;
  const tag = (el.tagName || el.name || '').toLowerCase();
  // Icon-sprite host components (`cu3-icons`, `*-icon-sprite`, etc.) and any
  // element whose only meaningful descendants are an <svg> full of <symbol>
  // defs. ClickUp lazily injects per-route icons into a shared sprite, so it
  // legitimately varies per route but is chrome, not content.
  if (/(^|-)icons?($|-)/.test(tag) || /sprite/.test(tag)) return true;
  const svgs = $(el).find('svg').toArray();
  if (svgs.length > 0) {
    const symbolCount = $(el).find('svg > symbol, svg > defs').length;
    const realLayout = $(el)
      .find('div, main, section, header, nav, ul, table, span')
      .toArray()
      .filter((n: any) => $(n).text().trim().length > 0).length;
    if (symbolCount > 4 && realLayout === 0) return true;
  }
  const kids = $(el).children().toArray();
  if (kids.length > 0 && kids.every((k: any) => {
    const t = (k.tagName || k.name || '').toLowerCase();
    return t === 'symbol' || t === 'defs';
  })) {
    return true;
  }
  return false;
}

/**
 * Noise siblings that legitimately appear/grow/shrink per route but are never
 * the content outlet: inert `<script>`s, framework overlay/portal hosts that
 * are empty or only hold transient overlays, and analytics injects. Excluding
 * these lets the walk follow the single real content child even when these
 * also "vary".
 */
const NOISE_TAGS = new Set(['script', 'style', 'link', 'noscript', 'template']);
const NOISE_HOST_RE =
  /(reactmodalportal|cdk-overlay|chmln|cdk-live-announcer|overlay-container|toast|tooltip)/i;

function isNoiseSibling($: any, el: any): boolean {
  if (!el) return true;
  const tag = (el.tagName || el.name || '').toLowerCase();
  if (NOISE_TAGS.has(tag)) return true;
  const idClass = `${$(el).attr('id') ?? ''} ${$(el).attr('class') ?? ''} ${tag}`;
  if (NOISE_HOST_RE.test(idClass)) return true;
  return false;
}

export interface OutletDetection {
  /** Absolute CSS selector path to the content-outlet element, from <body>. */
  selector: string;
  /** Per-level signature breadcrumbs, for diagnostics. */
  path: string[];
  /** Selector segments of the constant sibling(s) at the outlet level (the shell siblings, e.g. the sidebar). */
  constantSiblings: string[];
}

/**
 * Build a stable absolute selector for an element by walking its ancestor
 * chain, preferring `tag#id`, then `tag.class1.class2`, then nth-of-type.
 */
function absoluteSelector($: any, el: any): string {
  const segs: string[] = [];
  let cur = el;
  while (cur) {
    const tag = (cur.tagName || cur.name || '').toLowerCase();
    if (tag.length === 0 || tag === 'html') break;
    if (tag === 'body') break;
    const id = $(cur).attr('id');
    if (id) {
      segs.unshift(`#${cssEscape(id)}`);
      break; // id is unique enough to anchor the path
    }
    const cls = normClasses($(cur).attr('class'));
    let seg = tag;
    if (cls.length > 0) seg += '.' + cls.map(cssEscape).join('.');
    // disambiguate among same-signature siblings with nth-of-type
    const parent = $(cur).parent().get(0);
    if (parent) {
      const sameTag = $(parent)
        .children(tag)
        .toArray();
      if (sameTag.length > 1) {
        const idx = sameTag.indexOf(cur) + 1;
        seg += `:nth-of-type(${idx})`;
      }
    }
    segs.unshift(seg);
    cur = $(cur).parent().get(0);
  }
  return segs.join(' > ');
}

function cssEscape(value: string): string {
  // Class/id tokens from captured Angular markup are already valid CSS idents.
  // Escape only the characters that would break a selector if present.
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Detect the content outlet across N base DOMs. `docs` are loaded cheerio
 * instances; `roots` are the <body> elements (or any shared common root). All
 * docs must share the same `app-root`-style entry.
 */
export function detectContentOutlet(docs: any[]): OutletDetection {
  if (docs.length < 2) {
    throw new Error('detectContentOutlet needs at least two route DOMs to diff.');
  }

  // Anchor at <body> in every doc.
  let cursors: any[] = docs.map(($: any) => $('body').get(0));
  const path: string[] = ['body'];
  let lastOutlet: any | null = null;
  let lastConstantSiblings: string[] = [];

  const MAX_DEPTH = 40;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    // Signature lists per doc, with noise siblings (scripts, portals, sprites,
    // overlay hosts) removed so the walk tracks the real structural children.
    const realChildren = cursors.map(($el, i) =>
      docs[i](cursors[i])
        .children()
        .toArray()
        .filter((c: any) => !isNoiseSibling(docs[i], c)),
    );
    const sigLists = realChildren.map((kids, i) => kids.map((c: any) => sigOf(docs[i], c)));
    if (sigLists.some((l) => l.length === 0)) break;

    const ref = JSON.stringify(sigLists[0]);
    const allSameSigList = sigLists.every((l) => JSON.stringify(l) === ref);

    if (allSameSigList && sigLists[0].length === 1) {
      // Unique shared single child → shell, descend.
      cursors = realChildren.map((kids) => kids[0]);
      path.push(sigLists[0][0]);
      continue;
    }

    // Classify each child (by signature, aligned across docs) by its inner-HTML
    // length spread across routes. A child whose subtree is near-constant is
    // shell (e.g. the sidebar — its only per-route delta is an active-state
    // class). A child whose subtree length swings widely is content. We measure
    // the absolute spread so a dominant content region can be told apart from a
    // shell sibling that merely flips a class.
    const refSigs: string[] = sigLists[0];
    const candidates: { sig: string; idx: number; spread: number; maxLen: number }[] = [];
    refSigs.forEach((s: string, idx: number) => {
      const lens = realChildren.map((kids, i) => {
        const match = kids.find((c: any) => sigOf(docs[i], c) === s);
        if (!match) return -1;
        return (docs[i](match).html() ?? '').length;
      });
      if (lens.some((n) => n < 0)) return; // sig not present in all docs
      const min = Math.min(...lens);
      const max = Math.max(...lens);
      const spread = max - min;
      const el0 = realChildren[0][idx];
      if (el0 && !isSpriteLike(docs[0], el0)) {
        candidates.push({ sig: s, idx, spread, maxLen: max });
      }
    });

    // A child is "varying content" when its spread is materially large.
    const varying = candidates
      .filter((c) => c.spread > Math.max(2048, c.maxLen * 0.1))
      .sort((a, b) => b.spread - a.spread);

    if (varying.length === 0) break;

    // Dominant-content rule: when one varying child's spread dwarfs the next
    // (>=3x), it is the single content lineage even if a sibling shows a minor
    // spread (e.g. the sidebar flipping an active class). Descend into it.
    const dominant =
      varying.length === 1 || varying[0].spread >= varying[1].spread * 3
        ? varying[0]
        : null;

    if (!dominant) {
      // Several siblings change comparably → current container is the smallest
      // box holding all per-route content. It is the outlet.
      lastOutlet = cursors[0];
      lastConstantSiblings = refSigs.filter((s: string) => !varying.some((v) => v.sig === s));
      break;
    }

    lastConstantSiblings = refSigs.filter((s: string) => s !== dominant.sig);
    cursors = realChildren.map((kids, i) => {
      const match = kids.find((c: any) => sigOf(docs[i], c) === dominant.sig);
      return match ?? kids[dominant.idx];
    });
    path.push(dominant.sig);
    lastOutlet = cursors[0];
  }

  if (!lastOutlet) {
    // Degenerate: fall back to <body> itself.
    lastOutlet = docs[0]('body').get(0);
  }

  const selector = absoluteSelector(docs[0], lastOutlet);
  return { selector, path, constantSiblings: lastConstantSiblings };
}
