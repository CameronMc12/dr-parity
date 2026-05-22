/**
 * Hoist <noscript>-embedded <picture> sources into their visible sibling.
 *
 * Many large sites (Apple in particular) render lazy <picture> elements in
 * one of two equivalent "JS will fill me in later" shapes:
 *
 *   Shape A (data-empty source):
 *     <picture data-anim-lazy-image="">
 *       <source data-empty="" srcset="data:image/gif;..." media="..." />
 *       <img src="/real-large.jpg" alt="..." />
 *     </picture>
 *     <noscript> <picture>...real sources...</picture> </noscript>
 *
 *   Shape B (data-lazy picture with placeholder source):
 *     <picture data-lazy="">
 *       <source srcset="data:image/gif;..." media="..." />
 *       <img src="/real-large.jpg" alt="..." />
 *     </picture>
 *     <noscript> <picture>...real sources...</picture> </noscript>
 *
 * In a real browser the captured site's runtime JS rewrites the visible
 * <source> srcset to the real responsive variants on scroll-into-view.
 * Without that JS (and our generated clones do not ship Apple's runtime),
 * the browser picks the data: URI placeholder and the tile renders blank.
 * Worse, in React clones, even when the runtime IS shipped, React's
 * StrictMode dev-only double-render races the runtime and overwrites the
 * real srcset back to the JSX placeholder. So the same fix applies to
 * both static and React targets: rewrite the visible <picture> to carry
 * the real <source> set at emit time.
 *
 * Capability-detected: only mutates when both a placeholder source
 * pattern (data-empty OR srcset starting with `data:image/gif`) AND a
 * sibling <noscript><picture> exist. Idempotent: a second pass finds no
 * more placeholders and leaves the document alone.
 */

import * as cheerioModule from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

type CheerioRoot = any;

export interface HoistNoscriptPictureResult {
  /** Number of <picture> elements whose <source> set was hoisted. */
  picturesHoisted: number;
  /** Number of <source> elements written into visible pictures. */
  sourcesWritten: number;
}

/**
 * Walks the loaded cheerio document and hoists noscript-embedded picture
 * sources into their visible sibling. Mutates the document in place.
 */
export function hoistNoscriptPictureSources($: CheerioRoot): HoistNoscriptPictureResult {
  let picturesHoisted = 0;
  let sourcesWritten = 0;

  // Selector: any <picture> with a child <source> that is awaiting JS.
  // Two signals qualify (capability-detected):
  //   1. <source data-empty>           — explicit placeholder marker
  //   2. <source srcset="data:image/gif;..."> on a <picture data-lazy>
  // Either pattern, paired with a <noscript><picture> sibling carrying
  // real responsive sources, indicates a lazy picture whose runtime JS
  // would otherwise be responsible for substituting the real srcset.
  // Sites that do not use either pattern won't match.
  $('picture').each((_: number, pictureEl: AnyNode) => {
    const $picture = $(pictureEl);
    const placeholderSources = collectPlaceholderSources($picture);
    if (placeholderSources.length === 0) return;

    // Find the noscript that immediately follows the visible picture.
    // Apple wraps the real <picture> in <noscript> as the next sibling.
    // We walk forward to skip whitespace text nodes.
    const noscript = findFollowingNoscript($, $picture);
    if (!noscript) return;

    const noscriptHtml = noscript.html();
    if (!noscriptHtml) return;

    // Parse the noscript body in fragment mode so we can read the real
    // <source> set. Many cheerio builds expose .html() on a noscript as
    // the inner literal text (because scriptingEnabled defaults make
    // noscript opaque), so re-parsing as a fragment is safest.
    const $frag = cheerio.load(noscriptHtml, null, false);
    const $realPicture = $frag('picture').first();
    if ($realPicture.length === 0) return;

    const realSources = $realPicture.children('source').toArray() as Element[];
    if (realSources.length === 0) return;

    // Remove the visible picture's placeholder <source> elements (either
    // data-empty markers or data:image/gif srcsets on a data-lazy
    // picture). Then prepend the real ones in document order. Prepending
    // (not appending) keeps the inner <img> as the final child, which is
    // the <picture> spec contract (img must come after sources).
    placeholderSources.remove();

    // Insert real sources after any existing non-placeholder <source>
    // children but before the <img>. Cheerio: get the <img> child, then
    // insert before it. If no <img> exists, append at the end.
    const innerImg = $picture.children('img').first();
    const realSourcesHtml = realSources
      .map((el) => $frag.html(el as any) ?? '')
      .filter((s) => s.length > 0)
      .join('');

    if (realSourcesHtml.length === 0) return;

    if (innerImg.length > 0) {
      innerImg.before(realSourcesHtml);
    } else {
      $picture.append(realSourcesHtml);
    }

    // If the inner <img> still lacks a srcset and the noscript <img> had
    // one, copy that over too. This keeps fallback rendering accurate.
    if (innerImg.length > 0) {
      const $realImg = $realPicture.children('img').first();
      if ($realImg.length > 0) {
        for (const attr of ['srcset', 'sizes']) {
          if (!innerImg.attr(attr) && $realImg.attr(attr)) {
            innerImg.attr(attr, $realImg.attr(attr) as string);
          }
        }
      }
    }

    picturesHoisted++;
    sourcesWritten += realSources.length;
  });

  return { picturesHoisted, sourcesWritten };
}

/**
 * Returns the set of placeholder <source> children of the given
 * <picture>. A source is a placeholder when EITHER:
 *   - it carries `data-empty` (Apple's explicit marker), OR
 *   - the parent <picture> has `data-lazy` AND the source's srcset is
 *     a `data:image/gif` data-URI (Apple's other lazy pattern).
 * The two checks together cover the patterns observed on apple.com and
 * remain narrow enough to avoid touching unrelated <picture> elements.
 */
function collectPlaceholderSources($picture: any): any {
  const explicit = $picture.children('source[data-empty]');
  if (explicit.length > 0) return explicit;

  // Only treat data:image/gif sources as placeholders when the parent is
  // explicitly marked lazy. Without that gate, ordinary inline-data
  // images on unrelated sites would be misclassified.
  const isLazy = $picture.is('[data-lazy]');
  if (!isLazy) return $picture.children('source[data-empty]'); // empty cheerio set

  return $picture.children('source').filter((_: number, el: any) => {
    const srcset = (el?.attribs?.srcset ?? '') as string;
    return /^\s*data:image\/gif\b/i.test(srcset);
  });
}

/**
 * Returns the cheerio wrapper for the <noscript> element that follows the
 * visible <picture>, skipping over whitespace text nodes. Returns null if
 * the next non-whitespace sibling is not a <noscript> containing a
 * <picture>.
 */
function findFollowingNoscript($: CheerioRoot, $picture: any): any {
  let next = $picture.next();
  // Skip any whitespace-only text nodes between picture and noscript.
  // Cheerio's .next() typically jumps over text nodes already, but be
  // defensive in case the DOM has comments or whitespace siblings.
  while (next.length > 0 && next.get(0)?.type !== 'tag') {
    next = next.next();
  }
  if (next.length === 0) return null;
  if ((next.get(0) as Element | undefined)?.tagName !== 'noscript') return null;
  return next;
}
