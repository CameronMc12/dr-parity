/**
 * Split one captured base DOM into a verbatim SHELL (app chrome rendered once)
 * and the per-route CONTENT region (the inner HTML of the detected outlet).
 *
 * Reuses the same neutralisation rules as emit-stateful/verbatim-body.ts so the
 * embedded markup behaves identically: scripts/base removed, captured-open
 * overlays hidden, sidebar width restored. The only structural change is that
 * the outlet element's children are replaced by a single marker node
 * `<div data-dr-parity-outlet></div>`; the layout component renders a React
 * Router <Outlet/> into that node via a portal after mount.
 */

import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { buildSidebarStyleTag } from '../emit-stateful/interaction-layer';

export const OUTLET_MARKER_ATTR = 'data-dr-parity-outlet';

const FIXED_Z_INDEX_THRESHOLD = 100;
const MODAL_HINT_RE = /(^|[\s_-])(modal|backdrop|overlay|dialog|drawer|sheet)([\s_-]|$)/i;
const HIDE_RULE = 'display: none !important;';

const OPEN_OVERLAY_SELECTORS = [
  'dialog.modal',
  '.modal-backdrop',
  '.cdk-overlay-backdrop',
  '.cdk-overlay-container',
] as const;

function hideElement($el: any): void {
  $el.attr('hidden', '');
  const existing = ($el.attr('style') ?? '').trim();
  if (existing.includes(HIDE_RULE)) return;
  const sep =
    existing.length > 0 && !existing.endsWith(';') ? '; ' : existing.length > 0 ? ' ' : '';
  $el.attr('style', `${existing}${sep}${HIDE_RULE}`);
}

function fixedHighZIndex(style: string): boolean {
  if (!/position\s*:\s*fixed/i.test(style)) return false;
  const match = /z-index\s*:\s*(\d+)/i.exec(style);
  if (!match) return false;
  return Number(match[1]) >= FIXED_Z_INDEX_THRESHOLD;
}

/** Strip scripts/base — they re-execute and break the locally served clone. */
function neutraliseEmbedded($: any): void {
  $('script').remove();
  $('base').remove();
}

/** Hide captured-open modals/backdrops so the route renders, not a frozen overlay. */
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

export interface ShellResult {
  /** Verbatim shell HTML with an outlet marker where route content mounts. */
  shellHtml: string;
}

/**
 * Build the verbatim SHELL from a base DOM. The outlet element (resolved by
 * `outletSelector`) keeps its own tag/attrs but its children are replaced by a
 * single `<div data-dr-parity-outlet></div>` placeholder.
 */
export function buildShellHtml(baseHtml: string, outletSelector: string): ShellResult {
  const $ = cheerio.load(baseHtml, null, false);
  neutraliseEmbedded($);
  neutraliseOpenOverlays($);
  $.root().prepend(buildSidebarStyleTag());

  const outlet = $(outletSelector).first();
  if (outlet.length === 0) {
    throw new Error(`Outlet selector not found in shell base DOM: ${outletSelector}`);
  }
  outlet.empty();
  outlet.append(`<div ${OUTLET_MARKER_ATTR}="1"></div>`);

  return { shellHtml: $.html() };
}

export interface ContentResult {
  /** Verbatim inner HTML of the outlet for one route (scripts neutralised). */
  contentHtml: string;
}

/**
 * Extract one route's CONTENT: the inner HTML of the outlet element, scripts
 * removed. This is what the route's content component embeds verbatim.
 */
export function buildContentHtml(baseHtml: string, outletSelector: string): ContentResult {
  const $ = cheerio.load(baseHtml, null, false);
  neutraliseEmbedded($);
  neutraliseOpenOverlays($);

  const outlet = $(outletSelector).first();
  if (outlet.length === 0) {
    throw new Error(`Outlet selector not found in route DOM: ${outletSelector}`);
  }
  return { contentHtml: outlet.html() ?? '' };
}
