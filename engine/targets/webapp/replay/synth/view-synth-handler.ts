/**
 * View-synth handler — RUNTIME code for the generated sw.js.
 *
 * This module exports a single string: the JS source of `synthViewResponse`.
 * It is inlined verbatim into the Service Worker when `profile.viewSynth.enabled`
 * is true. The function is plain JS (no bundler), matching the rest of sw.js.
 *
 * Signature (inside sw.js):
 *   function synthViewResponse(url, request, templates): Response | null
 *
 * Logic:
 *   1. Confirm the request is GET /viz/v1/view/<id> (bare, no extra segments).
 *   2. Detect viewType from the Referer header:
 *        /v/(b|l|li|tl|c|cal|g|gantt|t|dc|cn|f|s|form|conv|doc|board)/<id>
 *      Falls back to null (no synth) when referer does not carry a type code.
 *      NB: most crawl-time referers were app root (https://app.clickup.com/)
 *      so the lookup succeeds primarily when the SPA navigates via a typed
 *      view URL (/v/b/<id>, /v/l/<id>, etc.) while the replay is running.
 *   3. Map typeCode → viewType integer using the same table as view-type-map.ts.
 *   4. Look up the template for that viewType in `templates` (loaded at boot).
 *   5. Clone the template JSON, replace every occurrence of exampleViewId with
 *      the requested viewId, return a 200 Response.
 *   6. On any failure / unknown type → return null (falls through to 404).
 *
 * Isolation guarantee: the synth ONLY fires when a VIZ_VIEW_RE path is
 * requested AND the template registry is non-empty AND a matching type is
 * found. In all other cases (non-ClickUp app, no templates loaded, unknown
 * type) it returns null immediately.
 */

/** The stringified JS source to be inlined into the generated sw.js. */
export const VIEW_SYNTH_HANDLER_SOURCE = `
// ---------------------------------------------------------------------------
// VIEW-SYNTH (additive, no-regression). Only fires when SYNTH_TEMPLATES is
// populated (ClickUp profile with viewSynth.enabled=true). Returns null for
// every other app and every path that is not a bare /viz/v1/view/<id> GET.
// Runs AFTER exact-match recordings so a captured response always wins.
// ---------------------------------------------------------------------------
var SYNTH_TEMPLATES = {};
var synthTemplatesReady = (async function() {
  try {
    var res = await fetch('/replay/view-templates.json', { cache: 'no-store' });
    if (res && res.ok) SYNTH_TEMPLATES = await res.json();
  } catch(err) {
    /* no synth templates: synthViewResponse returns null for every request */
  }
})();

/** ClickUp typeCode -> viewType integer. Mirrors view-type-map.ts buckets. */
var SYNTH_TYPE_MAP = {
  l: '1', li: '1',
  b: '2', board: '2',
  t: '3',
  c: '5', cal: '5', calendar: '5',
  m: '6',
  g: '9', gantt: '9', tl: '9',
  cn: '8', conv: '8', channel: '8',
  dc: '10', doc: '10',
  form: '11',
  f: null, s: null
};

var VIZ_VIEW_SYNTH_RE = /\\/viz\\/v1\\/view\\/([^/]+)$/;
var REFERER_TYPE_RE = /\\/v\\/([a-z]+)\\/[^/]/;

/**
 * Attempt to synthesise a GET /viz/v1/view/<viewId> response from the
 * loaded template registry. Returns a 200 Response on success, null on miss.
 * Must be called AFTER exact-match recordings (those always win).
 */
async function synthViewResponse(url, request, templates, clientId) {
  // Only GET bare /viz/v1/view/<id> — guard prevents leaking into other paths.
  if (request.method !== 'GET') return null;
  var pathMatch = VIZ_VIEW_SYNTH_RE.exec(url.pathname);
  if (!pathMatch) return null;

  // Templates must be loaded before we can synthesise.
  await synthTemplatesReady;
  var tmplMap = SYNTH_TEMPLATES;
  if (!tmplMap || Object.keys(tmplMap).length === 0) return null;

  var requestedViewId = pathMatch[1];

  // 1. Detect viewType from the navigating client's URL. The Referer header is
  // stripped to the bare origin on cross-origin requests (viz/v1/view goes to
  // frontdoor-prod-*.clickup.com), so the SPA route never reaches us via that
  // path. The client's own URL is local-origin and carries the full route
  // (e.g. /<workspaceId>/v/l/<viewId>) regardless of where the fetch is sent.
  var viewTypeKey = null;
  if (clientId) {
    try {
      var client = await self.clients.get(clientId);
      var clientUrl = (client && client.url) || '';
      var refMatch = REFERER_TYPE_RE.exec(clientUrl);
      if (refMatch) {
        var mapped = SYNTH_TYPE_MAP[refMatch[1]];
        if (mapped) viewTypeKey = mapped;
      }
    } catch(err) {
      /* client gone: fall through to null */
    }
  }

  // 2. No viewType detected → fall through to 404.
  if (!viewTypeKey) return null;

  // 3. Look up template for this viewType.
  var tmpl = tmplMap[viewTypeKey];
  if (!tmpl || !tmpl.template || !tmpl.exampleViewId) return null;

  // 4. Clone + parameterise: replace exampleViewId with requestedViewId.
  var bodyStr;
  try {
    bodyStr = JSON.stringify(tmpl.template);
    // Simple string-replace is safe: ClickUp viewIds are hash-shaped strings
    // that do not appear as substrings of unrelated field values.
    bodyStr = bodyStr.split(tmpl.exampleViewId).join(requestedViewId);
    // Validate the result is still valid JSON.
    JSON.parse(bodyStr);
  } catch(err) {
    return null;
  }

  return new Response(bodyStr, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'x-replay-source': 'synth-view',
      'x-synth-view-type': viewTypeKey,
    },
  });
}
// ---------------------------------------------------------------------------
// END VIEW-SYNTH
// ---------------------------------------------------------------------------
`;
