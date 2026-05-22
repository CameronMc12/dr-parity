/**
 * Hoist <noscript>-embedded <picture> sources into their visible sibling.
 *
 * Many large sites (Apple in particular) render lazy <picture> elements in
 * a "JS will fill me in later" shape:
 *
 *   <picture data-anim-lazy-image="">
 *     <source data-empty="" srcset="data:image/gif;..." media="..." />
 *     <img src="/real-large.jpg" alt="..." />
 *   </picture>
 *   <noscript>
 *     <picture>
 *       <source srcset="/real-small.jpg, /real-small_2x.jpg 2x" media="(max-width:734px)" />
 *       <source srcset="/real-medium.jpg, /real-medium_2x.jpg 2x" media="(max-width:1068px)" />
 *       <source srcset="/real-large.jpg, /real-large_2x.jpg 2x" media="(min-width:0px)" />
 *       <img src="/real-large.jpg" alt="..." />
 *     </picture>
 *   </noscript>
 *
 * In a real browser the captured site's runtime JS rewrites the visible
 * <source data-empty> attribute to point at the real responsive variants.
 * Without that JS (and our generated clones do not ship Apple's runtime),
 * the browser picks the data: URI placeholder and the tile renders blank.
 *
 * This pass rewrites the visible <picture> to carry the same <source> set
 * as the <noscript> sibling, while leaving the <noscript> block intact.
 * The result is a static <picture> that picks the right variant on its
 * own. Idempotent: a second pass detects sources without `data-empty` and
 * leaves them alone.
 *
 * Capability-detected: only mutates when both the placeholder <source
 * data-empty> AND a sibling <noscript><picture> exist. Untouched on every
 * other site shape.
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

  // Selector: any <picture> with a child <source data-empty>. This is the
  // strongest signal that the visible picture is awaiting JS. Sites that
  // do not use this pattern won't match.
  $('picture').each((_: number, pictureEl: AnyNode) => {
    const $picture = $(pictureEl);
    const placeholderSources = $picture.children('source[data-empty]');
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

    // Remove the visible picture's placeholder <source data-empty>
    // elements. Then prepend the real ones in document order. Prepending
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
