/**
 * Verbatim body emission for the WEBAPP target.
 *
 * The React/Astro targets convert captured HTML to JSX via `htmlToJsx`, which
 * camelCases / hyphen-strips attribute names (`class` -> `className`,
 * `_ngcontent-ng-c123` -> `_ngcontentngc123`). That is correct for those
 * targets but FATAL for framework-scoped CSS such as Angular's
 * ViewEncapsulation.Emulated, where the captured `<style>` rules are scoped
 * with hyphenated `[_ngcontent-ng-cXXX]` / `[_nghost-ng-cXXX]` selectors. Once
 * the attribute names are mangled the scoped rules no longer match and the
 * entire app renders unstyled.
 *
 * This module keeps the captured body markup VERBATIM. It uses cheerio (never
 * regex) to neutralise `<script>` tags and to tag interaction targets with a
 * stable `data-dr-parity-*` marker, then serialises the result back to a raw
 * HTML string. The webapp page component embeds that string through
 * `dangerouslySetInnerHTML`, so every attribute reaches the live DOM exactly as
 * captured and the scoped CSS matches. It is fully isolated from `htmlToJsx`.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import type { StateToggle } from '../inference/types';
import type { ToggleNames } from './name-deriver';
import { buildSidebarStyleTag } from './interaction-layer';

export const TRIGGER_MARKER_ATTR = 'data-dr-parity-trigger';
export const CLOSE_MARKER_ATTR = 'data-dr-parity-close';

/** One trigger that opens an overlay: marker id -> setter call. */
export interface TriggerWiring {
  /** Stable id stamped into the body via `data-dr-parity-trigger`. */
  markerId: string;
  /** Setter to invoke on click, e.g. `setComposeModalOpen`. */
  setter: string;
}

/** One overlay's verbatim HTML plus its render/dismiss wiring. */
export interface OverlayWiring {
  stateVar: string;
  setter: string;
  refName: string | null;
  /** Verbatim overlay HTML (scripts neutralised, close button marked). */
  html: string;
  /** Marker id stamped onto the close button, if any. */
  closeMarkerId: string | null;
}

export interface VerbatimBodyResult {
  /** Verbatim base-body HTML with scripts stripped and triggers marked. */
  bodyHtml: string;
  triggers: TriggerWiring[];
  unmatched: string[];
}

function safeSelector(selector: string): string | null {
  const trimmed = selector.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('text=') || trimmed.includes(':contains(')) return null;
  return trimmed;
}

/**
 * Neutralise markup that must not survive into the embedded body:
 *
 *   - `<script>`  re-executes (analytics, bootstrappers, framework hydration)
 *                 and crashes the clone.
 *   - `<base>`    rewrites every relative URL to the captured origin, which
 *                 breaks the locally served, asset-rewritten references.
 *
 * Captured inline `<style>` is intentionally KEPT — it carries the scoped CSS
 * the clone depends on. `<title>` / `<meta>` are inert inside the body.
 */
function neutraliseEmbedded($: any): void {
  $('script').remove();
  $('base').remove();
}

/**
 * Captured-open overlay containers that must NOT show on base-body load.
 * The base-state capture sometimes freezes a modal/backdrop open; rendering it
 * verbatim covers the underlying page. These selectors target clear modal /
 * backdrop / overlay containers only — page chrome (sidebar, top bar, main
 * content) never matches.
 */
const OPEN_OVERLAY_SELECTORS = [
  'dialog.modal',
  '.modal-backdrop',
  '.cdk-overlay-backdrop',
  '.cdk-overlay-container',
] as const;

const FIXED_Z_INDEX_THRESHOLD = 100;
const MODAL_HINT_RE = /(^|[\s_-])(modal|backdrop|overlay|dialog|drawer|sheet)([\s_-]|$)/i;

const HIDE_RULE = 'display: none !important;';

function hideElement($el: any): void {
  $el.attr('hidden', '');
  const existing = ($el.attr('style') ?? '').trim();
  if (existing.includes(HIDE_RULE)) return;
  const sep = existing.length > 0 && !existing.endsWith(';') ? '; ' : existing.length > 0 ? ' ' : '';
  $el.attr('style', `${existing}${sep}${HIDE_RULE}`);
}

/** Read a `position: fixed` + numeric `z-index` from an inline style string. */
function fixedHighZIndex(style: string): boolean {
  if (!/position\s*:\s*fixed/i.test(style)) return false;
  const match = /z-index\s*:\s*(\d+)/i.exec(style);
  if (!match) return false;
  return Number(match[1]) >= FIXED_Z_INDEX_THRESHOLD;
}

/**
 * Neutralise captured-open modals / backdrops in the BASE body so the inbox
 * shows by default. Trigger-gated overlay states are emitted separately and are
 * untouched, so clicking a trigger still opens the real overlay.
 *
 * Three passes, all conservative:
 *   1. Every `<dialog>` loses `open` and is hidden (top-layer modals).
 *   2. Known modal / backdrop / overlay container classes are hidden.
 *   3. `.ReactModalPortal` is hidden only when it has rendered children.
 *   4. `position:fixed` + high `z-index` elements are hidden only when their
 *      class/id also looks like a modal/backdrop/overlay (avoids real chrome).
 */
function neutraliseOpenOverlays($: any): void {
  $('dialog').each((_i: number, el: any) => {
    const $el = $(el);
    $el.removeAttr('open');
    hideElement($el);
  });

  for (const sel of OPEN_OVERLAY_SELECTORS) {
    $(sel).each((_i: number, el: any) => hideElement($(el)));
  }

  $('.ReactModalPortal').each((_i: number, el: any) => {
    const $el = $(el);
    if ($el.children().length > 0) hideElement($el);
  });

  $('[style]').each((_i: number, el: any) => {
    const $el = $(el);
    const style = $el.attr('style') ?? '';
    if (!fixedHighZIndex(style)) return;
    const idClass = `${$el.attr('id') ?? ''} ${$el.attr('class') ?? ''}`;
    if (MODAL_HINT_RE.test(idClass)) hideElement($el);
  });
}

/**
 * Build the verbatim base-body HTML and the trigger wiring list.
 *
 * Triggers are matched by their captured CSS selector (cheerio, never regex)
 * and tagged with a stable `data-dr-parity-trigger="N"` marker. The runtime
 * effect in the component shell binds a click listener to each marked element
 * and calls the corresponding setter — equivalent behaviour to a React
 * `onClick`, but compatible with `dangerouslySetInnerHTML`.
 */
export function buildVerbatimBody(
  baseHtml: string,
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): VerbatimBodyResult {
  const $ = cheerio.load(baseHtml, null, false);
  neutraliseEmbedded($);
  neutraliseOpenOverlays($);

  // Restore captured chrome (e.g. a collapsed sidebar rail whose width is
  // normally set by runtime JS we do not run) via a single emitted style tag.
  // Prepended so it loads before the captured markup; targets stable structure.
  $.root().prepend(buildSidebarStyleTag());

  const triggers: TriggerWiring[] = [];
  const unmatched: string[] = [];

  pairs.forEach(({ toggle, names }, idx) => {
    const sel = safeSelector(toggle.triggerSelector);
    if (!sel) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    let target: any;
    try {
      target = $(sel).first();
    } catch {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    if (!target || target.length === 0) {
      unmatched.push(toggle.triggerSelector);
      return;
    }
    const markerId = String(idx);
    target.attr(TRIGGER_MARKER_ATTR, markerId);
    triggers.push({ markerId, setter: names.setter });
  });

  return { bodyHtml: $.html(), triggers, unmatched };
}

/**
 * Build verbatim overlay HTML for each toggle: scripts stripped, close button
 * marked with `data-dr-parity-close="N"` so the runtime effect can bind its
 * dismiss handler.
 */
export function buildVerbatimOverlays(
  pairs: { toggle: StateToggle; names: ToggleNames }[],
): OverlayWiring[] {
  return pairs.map(({ toggle, names }, idx) => {
    const useRef =
      toggle.dismissStrategy === 'click-outside' || toggle.dismissStrategy === 'unknown';

    const $ = cheerio.load(toggle.appearedRoot.outerHTML, null, false);
    neutraliseEmbedded($);

    let closeMarkerId: string | null = null;
    const wantsCloseButton =
      (toggle.dismissStrategy === 'explicit-close-button' ||
        toggle.dismissStrategy === 'unknown') &&
      Boolean(toggle.closeButtonSelector);

    if (wantsCloseButton && toggle.closeButtonSelector) {
      const target = findCloseButton($, toggle.closeButtonSelector);
      if (target && target.length > 0) {
        closeMarkerId = String(idx);
        target.attr(CLOSE_MARKER_ATTR, closeMarkerId);
      }
    }

    return {
      stateVar: names.stateVar,
      setter: names.setter,
      refName: useRef ? names.refName : null,
      html: $.html(),
      closeMarkerId,
    };
  });
}

function findCloseButton($: any, closeButtonSelector: string): any {
  try {
    if (closeButtonSelector.includes(':contains(')) {
      const textMatch = /:contains\("([^"]+)"\)/.exec(closeButtonSelector);
      const text = textMatch?.[1] ?? '';
      return $('button, a[role="button"]')
        .filter((_i: number, el: any) => $(el).text().trim() === text)
        .first();
    }
    return $(closeButtonSelector).first();
  } catch {
    return null;
  }
}
