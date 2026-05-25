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
 * Single source of truth for every registered escape-hatch pattern.
 *
 * Each entry pairs the raw attribute marker (the substring a third-party
 * runtime script greps the DOM for, and that we test against captured
 * script source text) with the CSS selector that matches the container
 * element carrying it. Both the per-element predicate and the deferred-
 * script machinery derive from this list so they can never drift apart.
 */
interface EscapeHatchPattern {
  /** Raw attribute name as it appears in the DOM and in script source. */
  readonly attr: string;
  /** CSS selector matching the escape-hatch container. */
  readonly selector: string;
}

const ESCAPE_HATCH_PATTERNS: readonly EscapeHatchPattern[] = [
  // Shape C (Apple ac-gallery carousels). Apple's gallery runtime greps
  // `document.querySelectorAll("[data-media-gallery]")` exactly once at
  // module top level, so the container must exist before the script runs.
  { attr: 'data-media-gallery', selector: '[data-media-gallery]' },
];

/**
 * CSS selectors for every registered escape-hatch container. Injected into
 * the emitted post-hydration runtime so it knows which DOM to wait for
 * before running deferred scripts.
 */
export const ESCAPE_HATCH_SELECTORS = ESCAPE_HATCH_PATTERNS.map((p) => p.selector);

/**
 * Raw marker substrings used to detect, from a hoisted script's SOURCE
 * text, whether that script depends on escape-hatch DOM. A script whose
 * source contains any of these is deferred until the matching DOM commits.
 */
export const ESCAPE_HATCH_SCRIPT_MARKERS = ESCAPE_HATCH_PATTERNS.map((p) => p.attr);

/**
 * True when an element carries any registered escape-hatch attribute
 * marker (capability-detected; sites without these markers see no change).
 */
function isEscapeHatchContainer(el: Element): boolean {
  if (!el.attribs) return false;
  return ESCAPE_HATCH_PATTERNS.some((p) => p.attr in el.attribs);
}

/**
 * Combined escape-hatch predicate for the React target. Returns true
 * when an element matches ANY known runtime-mutated pattern. Idempotent
 * + capability-detected; sites without these markers see no change.
 */
export function reactEscapeHatchPredicate(el: Element): boolean {
  return isEscapeHatchContainer(el);
}
