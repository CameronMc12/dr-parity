/**
 * Classify what kind of overlay an added DOM subtree represents
 * (modal / dropdown / popover / drawer / toast / unknown).
 *
 * Heuristics ordered from most specific to least; first match wins.
 */

import type { StateEdge } from '../crawler/types';
import type { DomDiff, SerializedElement, ToggleKind } from './types';

function attr(el: SerializedElement, name: string): string {
  return el.attributes[name] ?? '';
}

function classList(el: SerializedElement): string[] {
  return attr(el, 'class')
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

function hasRole(el: SerializedElement, role: string): boolean {
  return attr(el, 'role').toLowerCase() === role;
}

function hasClassContaining(el: SerializedElement, needle: string): boolean {
  return classList(el).some((c) => c.includes(needle));
}

function styleContains(el: SerializedElement, needle: string): boolean {
  return attr(el, 'style').toLowerCase().includes(needle);
}

function nestedHasRole(el: SerializedElement, role: string): boolean {
  return el.innerHTML.includes(`role="${role}"`);
}

/**
 * The original code attempted attr(triggerEdge.interaction.selector, 'aria-haspopup')
 * but interaction.selector is a CSS selector string, not a SerializedElement. The
 * SerializedElement type has no place on Interaction, so the only signal available
 * is the selector text itself. CSS selectors like [aria-haspopup="menu"] surface
 * the attribute directly; substring containment is a faithful approximation.
 */
function triggerHasHaspopup(triggerEdge: StateEdge): boolean {
  const selector = triggerEdge.interaction.selector ?? '';
  return selector.includes('aria-haspopup');
}

export function classifyToggle(
  diff: DomDiff,
  triggerEdge: StateEdge,
): ToggleKind {
  const target = diff.added[0];
  if (!target) return 'unknown';

  if (hasRole(target, 'dialog') || attr(target, 'aria-modal') === 'true') {
    return 'modal';
  }
  if (nestedHasRole(target, 'dialog')) return 'modal';

  if (hasRole(target, 'menu') || triggerHasHaspopup(triggerEdge)) {
    return 'dropdown';
  }
  if (nestedHasRole(target, 'menu')) return 'dropdown';

  if (hasRole(target, 'tooltip')) return 'popover';
  if (hasClassContaining(target, 'tooltip')) return 'popover';
  if (hasClassContaining(target, 'popover')) return 'popover';

  if (hasClassContaining(target, 'drawer')) return 'drawer';
  if (styleContains(target, 'translatex') || styleContains(target, 'translate3d')) {
    return 'drawer';
  }

  if (hasClassContaining(target, 'toast') || hasRole(target, 'status')) {
    return 'toast';
  }

  if (
    hasClassContaining(target, 'modal') ||
    hasClassContaining(target, 'overlay') ||
    hasClassContaining(target, 'backdrop')
  ) {
    return 'modal';
  }

  // Fixed-positioned full-bleed → likely modal; small anchored → dropdown.
  if (styleContains(target, 'position:fixed') || styleContains(target, 'position: fixed')) {
    if (styleContains(target, 'inset:0') || styleContains(target, 'width:100')) {
      return 'modal';
    }
    return 'dropdown';
  }

  return 'unknown';
}
