# CRDT Doc Freeze Pattern — Implementation Brief
Date: 2026-05-28
Status: research; ready for build dispatch

---

## Detected stack

- **CRDT library: NOT Yjs — Codox co-editor (proprietary OT/binary protocol) — HIGH confidence.**
  Evidence: WebSocket connects to `wss://cu-prod-prod-eu-west-1-3-coeditor.clickup.com/coeditor/<pageId>?entityType=doc`. First sent frame is a JWT bearer token (base64-encoded). Received frames are a compact binary framing (opcode=2, prefix byte = message type 0x00/0x01/0x02, followed by varint length + content). Readable frames contain cursor awareness JSON (`{"user":{...},"cursor":{"anchor":{"tname":"2kyr6013-215"},...}}`). No Yjs sync messages (`\x00`/`\x01` sync message headers), no Y.Doc binary update format, no awareness protocol 0x01. JS bundles load `quill-lazy-styles-UHMVAMFJ.css`, `bubble-5KGX6ILM.css`, `snow-55DNWN2R.css`, `core-5BSWG2DG.css` — Quill CSS assets, zero y-prosemirror indicators. CSP allows `https://cdn1.codox.io`, `https://cdn1.stage.codox.io`. No Yjs/Automerge/ShareDB script src in any captured response.

- **Editor: Quill (ClickUp's own `cu-quill-rich-editor` Angular wrapper) — HIGH confidence.**
  Evidence: DOM states show `<div class="ql-editor" contenteditable="true" data-placeholder="Write, press 'space' for AI, '/' for commands">`. CSS includes `.ql-container`, `.ql-cursor`, `.ql-block`, `.ql-hidden`. Angular component tag is `<cu-quill-rich-editor>`. Quill delta format confirmed: `group.description` fields in REST responses carry `{"ops":[{"insert":"...","attributes":{"block-id":"..."}}]}`.

- **Mount selector:** `.ql-editor[contenteditable]` (inside `.cu-editor-content .ql-container`)

- **Doc body shape: Markdown string via the public v3 Docs API — HIGH confidence.**
  The internal `docs/v1` REST endpoint (`GET /docs/v1/view/<viewId>/page/<pageId>`) returns `"content": null` — all content flows through the Codox WebSocket and is never written into the REST response. However, the **public API** (`GET /v3/workspaces/{teamId}/docs/{docId}/pages`) returns `content` as a **plain Markdown string** (confirmed from `docs/research/clickup-export/2026-05-25T16-21-00-615Z/doc-pages.json`). The SW already intercepts and records `/docs/v1/team/<id>/docs/bulk`, page-list, and page metadata. Content body has a parallel capture path: the export script already fetches it via public API.

  Captured location: `docs/research/clickup-export/2026-05-25T16-21-00-615Z/doc-pages.json` — each entry: `{ docId, pages: [{ id, name, content: "<markdown string>", ... }] }`. Content is plain Markdown, not Quill Delta JSON, not ProseMirror JSON.

- **How content wires to editor:** App fetches `/docs/v1/codoxAccessToken?doc_id=view_doc:<pageId>:...` (captured, returns `{accessToken, access:"write", version:"1.0.2"}`), then opens the co-editor WebSocket, sends the JWT, and the Codox server pushes the full document state via binary frames. The Angular component mounts the Quill instance and Codox populates it. REST page response is metadata-only; `content` field is always null at the internal API layer.

---

## Canonical pattern

**"Codox-bypass via MutationObserver + Quill setContents from markdown-parsed captured content"**

The Codox WebSocket carries the live editor state. The replay clone already mocks WebSocket frames. The cleanest freeze is to intercept the editor mount (MutationObserver), prevent Codox from doing anything useful (404 the access-token endpoint or block the co-editor WS host at SW layer), and directly call `quillInstance.setContents(parsedDelta)` or `quillInstance.enable(false)` + inject HTML into the `.ql-editor` node.

Reference: ProseMirror issue #396 confirms `contenteditable="false"` is the read-only primitive (the same applies to Quill — `quill.enable(false)` sets `contenteditable="false"` on `.ql-editor` and disables all input). Yjs discuss.yjs.dev thread confirms snapshot restoration is API-driven (`Y.createDocFromSnapshot`) — not applicable here since ClickUp is not Yjs.

---

## Strategy A — boot-shim + SW intercept monkey-patch (cheapest, lowest risk)

**How it works:**

1. SW intercepts `GET /docs/v1/codoxAccessToken?doc_id=view_doc:<pageId>:...` and returns a synthetic 200 with a dummy non-expiring token (or a 401 to abort Codox init silently).
2. SW intercepts the Codox co-editor WebSocket upgrade (`wss://cu-prod-prod-eu-west-1-3-coeditor.clickup.com/coeditor/<pageId>`) — already covered by the WS mock shim; returns no frames or just the auth-ack (opcode `0x02 0x02` = ack, observed in captures).
3. Boot-shim injects a `MutationObserver` on `document.body` watching for `.ql-editor[contenteditable]` to appear.
4. On mount detection:
   - Fetch `/replay/doc-pages.json` (a build-time static file emitted alongside `view-templates.json`).
   - Look up the current `pageId` from `window.location.pathname` (pattern: `/v/dc/<docId>/<pageId>`).
   - Convert the captured Markdown to a minimal Quill Delta (or inject as HTML directly into `.ql-editor` innerHTML).
   - Disable the editor: call `quillInstance.enable(false)` if the Quill instance is reachable via Angular's DI, OR set `contenteditable="false"` and `pointer-events:none` directly on the node as a fallback.
5. Strip the loading/opacity style from `.cu-editor-content.loading` → `.loaded`.

**Codox WS auth-token intercept at SW layer:** The `codoxAccessToken` endpoint URL is deterministic (`/docs/v1/codoxAccessToken?doc_id=view_doc:<pageId>:<uuid>:<uuid>`). The SW already has a response for it from crawl capture. Serve the captured token unchanged — Codox will try to connect, send the token, and receive no meaningful frames. The editor mounts in a pending state. The MutationObserver fires, injects content, and disables `contenteditable`. Codox's auth-retry loop can be silenced by the SW returning synthetic "auth failed" frames on the co-editor socket (send `0x02 0x02` ack only, no content frames — the editor stays in a waiting state which the shim overrides).

**Quill instance access options (ordered by preference):**
1. Angular CDK exposes `__ngContext__` or `__ngElementData__` on component elements — walk upward from `.ql-editor` to find the `cu-quill-rich-editor` host, access its component instance's `editor` property.
2. `Quill.find(domNode)` — Quill's static API returns the Quill instance for any DOM node inside its root.
3. DOM-only fallback: set `contenteditable="false"` + inject HTML directly into `.ql-editor`.

**Pros:** purely additive; no bundle patching; SW already intercepts co-editor WS; uses captured Markdown (already in the export); zero regression risk to other views.

**Cons:** timing-sensitive (MutationObserver fires once; Angular change detection might re-enable the editor); Quill instance access via Angular context is fragile across ClickUp builds; Markdown → Quill Delta conversion is lossy for complex blocks (tables, embeds).

**Risks:** Angular re-renders may stomp the injected content if the Codox connection eventually resolves. Mitigation: also observe for `contenteditable` being re-set to `"true"` and re-disable.

---

## Strategy B — SW synthesises Codox binary "doc loaded" frames

**How it works:**

The SW intercepts the co-editor WebSocket and replays the captured binary frames from `websocket.jsonl`. The observed captures only contain cursor/awareness frames (no doc-content frames), because the doc had no content when crawled. To synthesise real content, the SW would need to fabricate the Codox binary content-delivery frame format.

The Codox binary protocol prefix analysis: `0x02 0x02` = auth ack; `0x01 <varint-len> 0x01 <msgpack-ish body>` = awareness update; large frames (`opcode=1`, 3558+ bytes, encrypted/compressed, first 8 bytes = `89 dead ca 97 a7 7b 1b`) are not decodable from captures alone — likely the initial document state in a proprietary compressed format.

**Pros:** highest fidelity to the real editor flow; toolbar/comments would work normally.

**Cons:** Codox binary protocol is opaque and non-standard (not OT-JSON, not Quill Delta, not Yjs); the large frames appear to be proprietary compressed blobs; reverse-engineering the content-delivery frame format requires significant effort with no guarantee of success without live server interaction or source access.

**Risks:** Very high. Even if the frame format was decoded, the content encoding may vary by doc version/schema version. Not recommended.

---

## Strategy C — replace the editor entirely with static rendering

**How it works:**

On the doc route, the SW intercepts the page HTML response and injects a `<div id="dr-parity-doc-freeze-render">` with the Markdown rendered to safe HTML (using a bundled markdown-it or marked parser). A boot-shim CSS rule hides `.cu-editor-content` and shows the injected div instead.

**Pros:** 100% reliable; no dependency on Quill internals or Codox timing; Markdown renders cleanly.

**Cons:** lowest fidelity — the ClickUp toolbar, comment badges, subpage outlines, cover image, and doc-page skeleton all disappear. Navigation away-from and back-to the doc page would work, but the actual editor frame is replaced. Still, for "doc content visible as read-only text" this is the nuclear option that always works.

**Risks:** Angular might fight the DOM replacement on re-render. Wrapping the injected div in the existing `.cu-editor-content` tree (hiding inner children rather than replacing the container) is safer.

---

## Recommended path

**Strategy A**, with DOM-only fallback (no Quill API access required).

Justification: the content is already captured as Markdown in the export. The SW already intercepts the co-editor WebSocket. The MutationObserver + `contenteditable="false"` + innerHTML injection is 15–20 lines of shim JS and requires no Codox protocol knowledge. The only non-trivial part is Markdown → safe HTML, which has battle-tested libraries (`marked`, `markdown-it`) that can be bundled inline as a 20KB self-contained string in the shim. Angular angular won't fight a `contenteditable=false` because Codox never delivers content anyway (WS returns no doc frames in the replay). The editor stays in its "loading" state, shim injects, disables, and the doc page looks correct.

---

## Implementation sketch (Strategy A)

### Files to touch

- `engine/targets/webapp/profiles/types.ts` — add `docFreeze?: { enabled: boolean; docPagesBuildPath: string }` to `WebappProfile`
- `engine/targets/webapp/profiles/clickup.ts` — enable `docFreeze` pointing to `docs/research/clickup-export/2026-05-25T16-21-00-615Z/doc-pages.json`
- `engine/targets/webapp/replay/freeze/doc-freezer-shim.ts` — NEW: exports `DOC_FREEZER_SHIM_SOURCE` string (analogous to `VIEW_SYNTH_HANDLER_SOURCE`)
- `engine/targets/webapp/replay/emit-sw.ts` — (a) import `DOC_FREEZER_SHIM_SOURCE`; (b) block co-editor WS host by returning auth-ack-only synthetic WS responses; (c) serve `doc-pages.json` from `/replay/doc-pages.json`
- `engine/targets/webapp/replay/index.ts` — copy `doc-pages.json` into the replay output's `/replay/` directory when `docFreeze.enabled`
- `engine/targets/webapp/replay/emit-boot-shim.ts` — inline `DOC_FREEZER_SHIM_SOURCE` when `docFreeze.enabled` (same pattern as ViewSynth)

### Pseudocode for the boot-shim (DOC_FREEZER_SHIM_SOURCE)

```js
// DOC-FREEZE SHIM — runs before the app bundle.
// Injects captured doc content as static read-only text when the Quill editor mounts.
// No Codox dependency, no WebSocket, no CRDT.

var DOC_PAGES = null;
var docPagesReady = (function() {
  return fetch('/replay/doc-pages.json', { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) { DOC_PAGES = data; })
    .catch(function() { DOC_PAGES = null; });
})();

// Extract pageId from /v/dc/<docId>/<pageId>
var DOC_PAGE_RE = /\/v\/dc\/[^/]+\/([^/?#]+)/;

function resolvePageContent(pageId) {
  if (!DOC_PAGES || !Array.isArray(DOC_PAGES)) return null;
  for (var i = 0; i < DOC_PAGES.length; i++) {
    var pages = DOC_PAGES[i].pages || [];
    for (var j = 0; j < pages.length; j++) {
      if (pages[j].id === pageId) return pages[j].content || null;
    }
  }
  return null;
}

// Minimal Markdown -> HTML (handles headings, bold, italic, lists, links, paragraphs)
function mdToHtml(md) {
  if (!md) return '<p></p>';
  return md
    .replace(/^#{1,6} (.+)$/gm, function(_, t, o, s) {
      var n = (s.slice(o - s.length + 1).match(/^(#+)/)||['',''])[1].length;
      return '<h'+n+' class="ql-block">'+t+'</h'+n+'>';
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^[*-] (.+)$/gm, '<li class="ql-block ql-indent-1">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>)+/g, function(m) { return '<ul>'+m+'</ul>'; })
    .replace(/\n{2,}/g, '</p><p class="ql-block">')
    .replace(/^(?!<)(.+)$/gm, '<p class="ql-block">$1</p>');
}

function freezeEditor(editorEl, pageId) {
  docPagesReady.then(function() {
    var content = resolvePageContent(pageId);
    if (content === null) return; // no content in export for this page

    // 1. Inject content
    editorEl.innerHTML = mdToHtml(content);

    // 2. Disable editing (Quill-agnostic)
    editorEl.setAttribute('contenteditable', 'false');
    editorEl.style.pointerEvents = 'none';

    // 3. Attempt Quill API disable (graceful if unavailable)
    try {
      var q = Quill && Quill.find && Quill.find(editorEl.closest('.ql-container'));
      if (q && q.enable) q.enable(false);
    } catch (e) {}

    // 4. Mark as loaded (strip the loading spinner)
    var wrapper = editorEl.closest('.cu-editor-content');
    if (wrapper) {
      wrapper.classList.remove('loading');
      wrapper.classList.add('loaded');
    }
  });
}

// Watch for doc route + editor mount
function onDocPageMount() {
  var m = DOC_PAGE_RE.exec(location.pathname);
  if (!m) return;
  var pageId = m[1];

  var obs = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j].nodeType === 1 && nodes[j].querySelector
          ? nodes[j].querySelector('.ql-editor[contenteditable]')
          : null;
        if (el) {
          obs.disconnect();
          freezeEditor(el, pageId);
          return;
        }
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// Also re-run on SPA navigation (popstate/pushstate)
(function() {
  var orig = history.pushState;
  history.pushState = function() {
    orig.apply(history, arguments);
    onDocPageMount();
  };
  window.addEventListener('popstate', onDocPageMount);
  if (DOC_PAGE_RE.test(location.pathname)) onDocPageMount();
})();
```

### SW additions (emit-sw.ts)

Add one intercept before the existing 404 fallback:

```js
// DOC-FREEZE: synthetic Codox co-editor WS frames (auth-ack only, no content).
// Forces the editor into a permanent "waiting for content" state.
// The boot-shim's MutationObserver fires and injects captured content instead.
// Intercept: wss://cu-prod-prod-eu-west-1-3-coeditor.clickup.com (handled by existing WS mock shim)
// Codox access-token: serve captured token verbatim (already in recordings).
```

The existing WS shim in `emit-boot-shim.ts` already handles WebSocket replay by URL. The `coeditor` WS connection is in `websocket.jsonl` for the doc crawl. It was captured with 713 frames (mostly cursor-awareness, no doc-content frames). The WS shim will replay exactly those frames — cursor positions and awareness only, no document data — so the Quill editor never receives content via Codox. This is the desired behaviour.

### Build-time: emit doc-pages.json

In `engine/targets/webapp/replay/index.ts` or the replay build entry:

```ts
if (profile.docFreeze?.enabled) {
  const src = resolve(profile.docFreeze.docPagesBuildPath);
  await fs.copyFile(src, join(outputDir, 'replay', 'doc-pages.json'));
}
```

### Verification approach

1. Serve replay with `npx serve` at localhost:7799.
2. Navigate to `/v/dc/2kyr6013-935/2kyr6013-215`.
3. Expect: `.ql-editor[contenteditable="false"]` with non-empty innerHTML within 3s of mount.
4. Expect: no network requests to `cu-prod-prod-eu-west-1-3-coeditor.clickup.com` that return meaningful content.
5. Playwright assertion: `await page.locator('.ql-editor[contenteditable="false"]').first().waitFor({ timeout: 10000 })` → PASS.
6. Screenshot shows rendered Markdown text in the doc body area.

This mirrors the `view-synth` PASS pattern: build with `profile.docFreeze.enabled=true` → serve → Playwright probe → assert selector + attribute.

---

## Browsertrix profiles relevance to Q1 (sidebar)

The Browsertrix profile system stores **session cookies only, not credentials**. It is confirmed applicable to the parked Phase 2 sidebar expander problem: the root cause was missing authenticated session state during capture (Angular sidebar tree was collapsed/virtualized and the profile-less crawl never reached the doc-subpage expanded sidebar). Browsertrix profiles would have preserved the session token across crawl restarts, but the ClickUp replay already solves this differently (persistent Playwright profile at `~/.config/playwright-clickup` + seeded storage-state). Browsertrix profiles are **confirmed useful as an alternative account-state mechanism** but are not the missing piece for this project's current flow. The sidebar expander issue was caused by SPA virtualization of the tree, not missing auth.

---

## Effort / impact estimate

| Strategy | Effort | Unlocks |
|---|---|---|
| A (recommended) | 2–3 days | All 10 doc-type views (`/v/dc/`) render with real content; doc freeze closes the largest visible gap after calendar/gantt; parity:score on doc pages |
| B | 10–15 days (protocol RE, high risk) | Marginally higher fidelity (toolbar live) — not worth it |
| C | 0.5 days | Content visible but editor chrome gone; use as fallback only |

Strategy A day-breakdown: 0.5d — emit `doc-pages.json` at build time + copy to `/replay/`; 0.5d — `DOC_FREEZER_SHIM_SOURCE` string + Markdown renderer; 0.5d — wire into `emit-boot-shim.ts` + `emit-sw.ts` + `types.ts` + `clickup.ts`; 0.5d — Playwright verification + parity:score run on doc routes.

---

## Open questions / risks

1. **Markdown fidelity.** The public API `content` field is Markdown; the internal editor uses Quill Delta. Complex blocks (embedded tasks, tables, slash-command outputs, ClickUp mentions) may not round-trip cleanly through Markdown. Mitigation: the shim renders best-effort; frozen doc fidelity is "text readable" not "pixel perfect editor", which is the explicit goal.

2. **Angular re-render stomp.** Angular may re-run change detection and call `Codox.setContent()` after the shim fires, overwriting the injected content. Mitigation: add a `MutationObserver` on the `.ql-editor` watching for `contenteditable` being restored to `"true"` and re-applying the freeze.

3. **SPA route navigation.** Navigating between doc pages without a full page reload will not retrigger the MutationObserver. Mitigation: the pushState hook in the shim re-initialises `onDocPageMount()` on navigation. A per-page observer is started fresh on each SPA transition.

4. **`doc-pages.json` staleness.** The export was captured on 2026-05-25; the Release Notes doc (`2kyr6013-935`) was newly created and has `content: null` in the internal API. The export ran against the public API which may not have returned content for that specific doc. The "Getting Started Guide" and "Team Docs" pages have rich content. Mitigation: re-run `npm run export:clickup` against the current workspace before the build to get fresh Markdown content.

5. **Only works for captured pageIds.** Pages not in the export JSON will render with no content (shim finds no match, leaves editor blank). This is acceptable — it is the same as the current behaviour.
