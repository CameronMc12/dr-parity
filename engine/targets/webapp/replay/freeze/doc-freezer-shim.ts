/**
 * Doc-freezer shim — RUNTIME JS inlined into the cloned page's boot shim.
 *
 * Exported as a string. The replay build appends this to the bootstrap shim
 * when `profile.docFreeze.enabled` is true. It runs BEFORE the app bundle
 * boots so its MutationObserver is registered in time to catch the Quill
 * editor mount.
 *
 * Strategy A from docs/V2.0/09-crdt-doc-freeze-pattern.md:
 *   1. Fetch the compact doc-pages index (`/replay/doc-pages.json`) once.
 *   2. Observe `document.body` for `.ql-editor[contenteditable]` mount.
 *   3. On mount: parse `/v/dc/<docId>(/<pageId>)?` from URL, resolve the
 *      captured markdown for that pageId (or the doc's first page when no
 *      pageId is in the URL), render to HTML, inject into `.ql-editor`,
 *      flip `contenteditable="false"`.
 *   4. Re-run on SPA navigation (popstate + pushState/replaceState patch).
 *   5. Idempotent — skip if the editor already carries our marker class.
 *
 * Failure modes are deliberately silent: a doc with no captured content
 * leaves the editor exactly as the bundle/replay produced it (the SPA hangs
 * waiting for Codox, but the SW Codox block returns empty responses so the
 * editor sits empty — no worse than today).
 */

import { MARKDOWN_TO_HTML_SOURCE } from './markdown-to-html';

/**
 * Build the doc-freezer shim source. Appended to the boot shim when
 * `docFreeze.enabled` is true.
 */
export function buildDocFreezerShim(): string {
  return `
/* dr-parity doc-freezer shim (additive, no-regression) */
(function () {
  'use strict';

  ${MARKDOWN_TO_HTML_SOURCE}

  var DOC_INDEX = null;
  var docIndexReady = (function () {
    return fetch('/replay/doc-pages.json', { cache: 'no-store' })
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { DOC_INDEX = data; })
      .catch(function () { DOC_INDEX = null; });
  })();

  /** Match /<workspaceId>/v/dc/<docId>(/<pageId>)? — pageId is optional. */
  var DOC_ROUTE_RE = /\\/v\\/dc\\/([^/?#]+)(?:\\/([^/?#]+))?/;
  /** Marker class set on the .ql-editor once we have frozen it. Idempotency guard. */
  var FROZEN_MARK = 'dr-parity-doc-frozen';

  function parseDocRoute() {
    var m = DOC_ROUTE_RE.exec(window.location.pathname);
    if (!m) return null;
    return { docId: m[1], pageId: m[2] || null };
  }

  function resolvePage(docId, pageId) {
    if (!DOC_INDEX || !DOC_INDEX[docId]) return null;
    var doc = DOC_INDEX[docId];
    if (!doc.pages || typeof doc.pages !== 'object') return null;

    // Explicit pageId takes priority.
    if (pageId && doc.pages[pageId]) return doc.pages[pageId];

    // No pageId in URL: fall back to the doc's first captured page so the
    // landing view of a multi-page doc still renders something.
    var keys = Object.keys(doc.pages);
    if (keys.length > 0) return doc.pages[keys[0]];
    return null;
  }

  /**
   * Inject the rendered markdown into the editor node and disable editing.
   * Idempotent — bails if the same editor element is already frozen.
   */
  function freezeEditor(editorEl, page) {
    if (!editorEl || !page) return false;
    if (editorEl.classList && editorEl.classList.contains(FROZEN_MARK)) return false;

    var html = __df_markdownToHtml(page.content || '');

    try {
      editorEl.innerHTML = html;
    } catch (e) {
      return false;
    }
    editorEl.setAttribute('contenteditable', 'false');
    editorEl.setAttribute('data-dr-parity-frozen', '1');
    if (editorEl.classList) editorEl.classList.add(FROZEN_MARK);

    // Reveal any parent Quill container hidden behind a 'loading' style.
    var wrapper = editorEl.closest && editorEl.closest('.cu-editor-content');
    if (wrapper) {
      if (wrapper.classList) {
        wrapper.classList.remove('loading');
        wrapper.classList.add('loaded');
      }
      if (wrapper.style && wrapper.style.display === 'none') wrapper.style.display = '';
    }
    var qlContainer = editorEl.closest && editorEl.closest('.ql-container');
    if (qlContainer && qlContainer.style && qlContainer.style.display === 'none') {
      qlContainer.style.display = '';
    }

    // Best-effort: ask Quill itself to disable, if its global is on window.
    try {
      var Quill = window.Quill;
      if (Quill && typeof Quill.find === 'function' && qlContainer) {
        var q = Quill.find(qlContainer);
        if (q && typeof q.enable === 'function') q.enable(false);
      }
    } catch (e) { /* Quill not exposed; the DOM-level disable is enough */ }

    return true;
  }

  /**
   * Search the current document for an .ql-editor and freeze it if the route
   * matches a captured doc page. Called on initial mount + every SPA nav.
   */
  function tryFreezeNow() {
    var route = parseDocRoute();
    if (!route) return;
    docIndexReady.then(function () {
      var page = resolvePage(route.docId, route.pageId);
      if (!page) return;
      var editors = document.querySelectorAll('.ql-editor[contenteditable]');
      for (var i = 0; i < editors.length; i++) freezeEditor(editors[i], page);
    });
  }

  /** Persistent observer: re-freezes whenever a new .ql-editor mounts. */
  var observer = null;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      var route = parseDocRoute();
      if (!route) return;
      var anyEditor = false;
      for (var i = 0; i < mutations.length && !anyEditor; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('ql-editor')) { anyEditor = true; break; }
          if (n.querySelector && n.querySelector('.ql-editor[contenteditable]')) { anyEditor = true; break; }
        }
      }
      if (!anyEditor) return;
      docIndexReady.then(function () {
        var page = resolvePage(route.docId, route.pageId);
        if (!page) return;
        var editors = document.querySelectorAll('.ql-editor[contenteditable]:not(.' + FROZEN_MARK + ')');
        for (var k = 0; k < editors.length; k++) freezeEditor(editors[k], page);
      });
    });
    var attach = function () { observer.observe(document.body, { childList: true, subtree: true }); };
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  /** Patch History API so SPA navigation re-runs the freezer. */
  function patchHistory() {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      var r = origPush.apply(this, arguments);
      setTimeout(tryFreezeNow, 0);
      return r;
    };
    history.replaceState = function () {
      var r = origReplace.apply(this, arguments);
      setTimeout(tryFreezeNow, 0);
      return r;
    };
    window.addEventListener('popstate', function () { setTimeout(tryFreezeNow, 0); });
  }

  startObserver();
  patchHistory();
  // Initial pass for a direct deep-link load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryFreezeNow, { once: true });
  } else {
    tryFreezeNow();
  }
})();
`;
}
