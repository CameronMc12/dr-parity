/**
 * Per-element escape-hatch predicates for the React target.
 *
 * The htmlToJsx converter accepts a `shouldEscapeHatch(el)` callback.
 * When it returns true for an element, that element's INNER subtree is
 * emitted as dangerouslySetInnerHTML and React stops reconciling it
 * after mount. This is the only way to safely host subtrees that a
 * third-party runtime script mutates AFTER hydration: React's
 * StrictMode dev double-render would otherwise wipe those mutations
 * back to the original JSX, breaking the carousel/widget/etc.
 *
 * Each predicate here is capability-detected: it inspects the attribs
 * or className for a specific marker the captured site uses. Sites
 * that do not carry that marker are unaffected, so this file is safe
 * to apply across every React-target capture.
 *
 * Currently registered patterns:
 *
 *   Shape C (Apple ac-gallery carousels):
 *     Captured DOM has containers with `data-media-gallery=""` (e.g.
 *     `<div id="tv-media-gallery" class="media-gallery ..."
 *           data-media-gallery="">`). The Apple `ac-gallery` runtime
 *     script applies `current current-item` classNames and inline
 *     `--progress` / `transform: translate(...)` styles onto descendant
 *     `.media-gallery-item` slides on first init and on every slide
 *     change. In production preview the runtime wins and the carousel
 *     renders correctly; in `npm run dev`, React's StrictMode mounts
 *     twice and the second mount re-applies the original JSX (no
 *     className, no style), wiping the runtime mutation and freezing
 *     the carousel on slide 1. Sealing the `data-media-gallery`
 *     container's inner subtree from React makes the runtime the sole
 *     authority on its DOM state, matching production behaviour.
 */

import type { Element } from 'domhandler';

/**
 * Shape C predicate: any element marked as an Apple ac-gallery
 * container. Capability-detected via the `data-media-gallery` attribute
 * Apple emits on every gallery root (TV gallery, FAM gallery, etc.).
 */
function isAcGalleryContainer(el: Element): boolean {
  return el.attribs ? 'data-media-gallery' in el.attribs : false;
}

/**
 * Combined escape-hatch predicate for the React target. Returns true
 * when an element matches ANY known runtime-mutated pattern. Idempotent
 * + capability-detected; sites without these markers see no change.
 */
export function reactEscapeHatchPredicate(el: Element): boolean {
  return isAcGalleryContainer(el);
}
