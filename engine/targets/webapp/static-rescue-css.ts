/**
 * Static-render layout rescue.
 *
 * The webapp target emits a JS-stripped React clone. SPA layout containers
 * normally take their height from runtime JS (flex/grid sizing, resize
 * observers, virtualized scroll wrappers). With that JS stripped, those
 * containers collapse to `height:0; overflow:hidden` and CLIP every captured
 * row even though the rows are present in the DOM. This stylesheet, injected
 * as the LAST child of `<head>`, undoes that collapse so captured content is
 * visible in the static render.
 *
 * Cascade: it must come after the app's own stylesheets to win, and it uses
 * `!important` for the same reason. It is a single, clearly-marked, removable
 * block.
 *
 * SAFETY: this does NOT globally force `overflow:visible` on every scroller —
 * doing so would break the app shell / sidebar scroll. Rules are limited to
 * proven ClickUp `cu-dashboard*` collapse containers plus a couple of
 * conservative generic rules (root height + named outlet/body-wrapper
 * substrings) that target content outlets, not navigation chrome.
 */

const STYLE_ID = 'dr-parity-static-rescue';

const RESCUE_CSS = `
/* dr-parity static-render layout rescue — single removable block */
html, body { height: 100% !important; }

/* React root + app root chain must be able to take height so children that
   depend on a sized ancestor don't collapse to zero. Conservative: only
   min-height, never overflow. */
#root { min-height: 100vh !important; }

/* ClickUp: proven-safe collapse containers. JS normally sizes these; without
   it they hit height:0/overflow:hidden and clip the captured rows. */
.cu-dashboard__router-outlet,
.cu-dashboard__router-outlet-container,
.cu-dashboard-table,
.dashboard-router-outlet,
.cu-dashboard-table__scroll,
.cu-dashboard-table__body-wrapper {
  height: auto !important;
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
  flex: 0 0 auto !important;
}

/* Generic SPA static-render collapse patterns. These substrings name content
   OUTLETS and virtualized BODY WRAPPERS — not sidebars/navs — so un-collapsing
   them reveals clipped content without forcing the shell's own scrollers open. */
[class*="router-outlet"],
[class*="__body-wrapper"] {
  height: auto !important;
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
}
`.trim();

/** Markup for the rescue stylesheet, to be appended as the last head child. */
export function staticRescueStyleTag(): string {
  return `<style id="${STYLE_ID}">\n${RESCUE_CSS}\n</style>`;
}

export { STYLE_ID as STATIC_RESCUE_STYLE_ID };
