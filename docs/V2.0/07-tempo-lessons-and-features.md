# Dr Parity — Lessons & Features from the Tempo Clone

Captured from cloning **app.withtempo.ai** (an authenticated Vite+React SaaS with a Django `/api/v1`
backend, a node-graph canvas editor, and an autonomous AI ad-generation cycle) into a fully functional
offline clone + a real local backend. This is the hardest target the `webapp`/`replay` target has hit,
and it surfaced concrete engine bugs, reusable techniques, and a feature backlog.

Status legend: ✅ fixed/added this session · 🔭 proposed feature · ⚠️ process lesson.

---

## 1. Engine bugs fixed this session (fold into the baseline + regression-test)

| # | Bug | File | Fix | Why it matters |
|---|-----|------|-----|----------------|
| 1 | **Text-asset truncation cap** — `LEGACY_TRUNCATION_CAP = 50000` silently dropped ANY text body ≥50 KB | `engine/targets/webapp/emit-assets-from-crawl.ts` | replaced size cap with a real truncation check (`Buffer.byteLength(body) < bodySize`) | ✅ The #1 parity killer: a 762 KB theme CSS (1,057 `:root` vars + fonts) was dropped → clone rendered unstyled. A blanket size cap on *complete* bodies is always wrong. |
| 2 | **Head CSS link not localized** — webapp/react target never rewrote `<head>` `<link href>` to the `_ext` path (only replay did) | `engine/targets/shared/extract-head.ts` + `webapp/build.ts` | added `rewriteHeadAssetLinks()` | ✅ React emit linked a CSS file it didn't ship. |
| 3 | **SW null-body Response** — `new Response(body,{status:204\|304})` throws ("null body status cannot have body") | `engine/targets/webapp/replay/emit-sw.ts` | null-body-status guard (101/204/205/304 → null body) | ✅ One 204 with an empty-string body broke every project canvas via a rejected FetchEvent. |
| 4 | **No-body 304 shadows real bytes** — `seen.add(url)` fired before the body-null check | `emit-assets-from-crawl.ts` | move `seen.add` after the null guard | ✅ A cached 304 permanently shadowed the bodied 200 → images/CSS never localized. |
| 5 | **Recordings dedupe kept first, not richest** — `null` `/api/v1/user/` shadowed the real authed user → login redirect | `engine/targets/webapp/replay/build-recordings.ts` | keep richest body per key (reuse merge-crawls `bodyRichness`) | ✅ Replay booted to a login page despite valid auth. |
| 6 | **Merge fingerprint over-collapses** — distinct per-id GETs collapsed to one; batch-read POSTs lost | `engine/targets/webapp/replay/merge-crawls.ts` | per-id path-param in fingerprint; batch-read POSTs (`-by-ids`/`bulk`/`search`/`port-status`) keyed by body | ✅ 5 distinct canvases merged to 1; products-by-ids returned wrong list. |
| 7 | **Cross-origin CDN images unserved** — SW only handled same-origin; SAS-signed blob URLs fell through to live network (403 on expiry) | `emit-sw.ts` | `handleCrossOriginStatic` + SAS-query-strip before `_ext` lookup | ✅ Ad/creative images (Azure `draperfiles`) now serve from local copies regardless of signature. |
| 8 | **ENAMETOOLONG** — WS/asset fixture filenames built from URLs with long JWT query strings exceeded 255 bytes | `emit-realtime/build-fixtures.ts` (+ replay slug) | cap slug at 120 chars + sha1 suffix | ✅ Build crashed on an Ably realtime URL. |
| 9 | **MSW `as unknown` cast** — 797 `TS2345`; `HttpResponse.json` needs `JsonBodyType` | `emit-mocks/build-handlers.ts` + `branch-by-body.ts` | cast to MSW `JsonBodyType` | ✅ React emit wouldn't `tsc`/build. |
| 10 | **Original app bundle booted in emitted index.html** — captured `<script src=…index.js>` + modulepreload survived | `emit.ts` `stripAppBundleRefs` | strip `script[src]` + modulepreload from captured head | ✅ The real SPA tried to boot over the emitted one; Rollup couldn't resolve it. |
| 11 | **Hardcoded per-route cap** — `ROUTE_INTERACTION_LIMIT = 60` capped coverage | `crawler.ts` + `scripts/crawl-webapp.ts` | `--route-budget=<n>` CLI flag (default 60) | ✅ Couldn't get exhaustive modal/overlay coverage. |
| 12 | **Cold deep-link 404** — first uncontrolled paint hit origin before SW claimed | `emit-sw.ts` (`skipWaiting`+`clients.claim`) + `emit-boot-shim.ts` | deterministic SW register + guarded reload | ✅ `/projects/{id}/canvas` cold-loads now mount. |

All twelve are **global** (any webapp/replay clone can hit them), additive, and `tsc`-clean. Each
deserves a regression-corpus entry (see V2.0 plan).

---

## 2. New capabilities added this session (generalize → first-class features)

- ✅ **Stateful canvas mock in the SW** (`emit-sw.ts handleCanvas`): an in-memory graph store seeded
  from the recorded canvas GET, handling node/edge/group CRUD + a mocked generate/poll lifecycle so
  the editor is *interactive* offline, not just read-replay. → **🔭 Generalize to a typed
  stateful-mock layer for any entity CRUD** (not just canvas), driven by the recorded data model.
- ✅ **Replay → real-backend handoff** (`emit-sw.ts` backend-first routing + `--backend=<url>`):
  forwards all `/api/v1` to a live backend, recordings as fallback, offline mode unchanged. We then
  hand-built a TS+SQLite backend implementing the recorded contract. → **🔭 Productize: a
  backend-scaffold generator** that emits a typed Express+SQLite server (models + reads + CRUD +
  job/poll engine + provider seams) directly from the recordings + extracted data model. This is the
  biggest force-multiplier: it turns any replay into a functional, mutable app.
- ✅ **Hardened destructive/publish blocklist** (`docs/blocklists/tempo.txt`): never click
  publish/approve/spend during an authenticated crawl. → **🔭 Ship a default SaaS-safety blocklist**
  baked into the crawler (publish/pay/delete/approve/disconnect), opt-out per target.

---

## 3. Techniques & process lessons (workflow, not code)

- ⚠️ **Run the parity gate — it's not optional.** Styling shipped broken because `parity:score` was
  skipped; the truncation bug would have been caught on the first emit. → **🔭 Wire parity:score
  into the emit pipeline as a gate** (warn/fail on per-route regression). Score **per interaction-state**
  (modals/overlays), not just route landings — 45 states is the honest number, 10 route-landings hides
  the modal gaps.
- ⚠️ **Authenticated crawl auth.** The crawler can't attach to a logged-in Chrome on `:9222`
  (`launchPersistentContext` owns its own profile). macOS-encrypted on-disk cookies don't transfer to
  a Playwright-launched Chrome. The working path: extract `storageState` via `connectOverCDP` from the
  user's logged-in session → seed a fresh persistent profile via `addCookies` + `addInitScript`
  (localStorage) → crawl. Persistent cookies (e.g. Django `sessionid` 14d) survive disk. → **🔭 Build a
  `login`/`seed-from-cdp` helper** (the error path already says "run npm run login" — implement it).
- ⚠️ **`--full-js` disk blowup.** The recorder re-records the full JS bundle on EVERY navigation
  (cache disabled for real bodies) → 6 GB for 132 states; a deep crawl would fill the disk. → **🔭
  Dedupe asset bodies in the recorder** (store each unique body once by content hash, reference by
  hash). Massive disk + speed win; also de-noises the recordings. **Highest-value efficiency feature.**
- ⚠️ **Crawl breadth vs depth.** Raising `--route-budget` made the crawler pour budget into overlay
  *depth* on the first few routes, not route *breadth*. The fix was **merging multiple crawls**
  (a broad sweep + a deep sweep) via `--merge-dirs`. → **🔭 Make crawl-merge a first-class step** with
  a budget that balances breadth/depth, or run breadth+depth passes and always merge.
- ⚠️ **Schema capture needs the app, not raw fetch.** Many endpoints only fire behind SPA tab clicks
  and require an app-attached auth header (a bare cookie-GET 401s). Drive the UI to capture; or call
  the app's own `fetch` in page context.
- ⚠️ **Sandbox = safe contract capture.** Because the replay SW intercepts all `/api/v1`, you can
  trigger even publish/destructive actions in the *clone* to capture their outgoing request SHAPE with
  zero real-world effect (nothing leaves the SW). → **🔭 A "capture outgoing contracts in sandbox"
  mode** for risk-free reverse-engineering of write/publish endpoints.
- ⚠️ **Some things are genuinely server-side.** LLM prompts, image/video model identities, and
  server-internal triggers (Tempo's video gen is a 401 `intern/` route) are NOT client-recoverable.
  Confirm-then-stop (exhaustive djb2 flag brute-force, prompt-inspector probe) beats guessing — but
  budget it; we spent several passes confirming negatives.

---

## 4. Feature backlog for Dr Parity (prioritized)

**P0 — biggest leverage**
1. 🔭 **Recorder asset-body dedup by content hash** — kills the `--full-js` multi-GB blowup; faster, smaller, cleaner recordings.
2. 🔭 **Parity gate in the emit pipeline** — auto-run `parity:score` after emit; regression guard. Per-interaction-state scoring.
3. 🔭 **Backend-scaffold generator** — emit a typed Express+SQLite backend (models, reads, CRUD, job/poll engine, sandboxed publish, pluggable LLM/image/video provider seams) from the recordings + an auto-extracted data model. Turns replay → functional app. (We hand-built this for Tempo; it's a repeatable pattern.)

**P1 — broadens what replay can clone**
4. 🔭 **Generalized stateful-mock layer** — entity-CRUD store in the SW (canvas store generalized).
5. 🔭 **Auth helper** (`seed-from-cdp` / `login`) for authenticated SaaS targets.
6. 🔭 **API contract + data-model extractor** — auto-derive endpoint contract + entity schemas from recordings (we wrote `AGENT_AD_GENERATION.md` / `AI_PIPELINE_STRUCTURE.md` by hand).
7. 🔭 **Crawl-merge as a first-class step** (breadth+depth) + balanced budget.

**P2 — robustness & safety defaults**
8. 🔭 **Default SaaS-safety blocklist** (publish/pay/delete/approve/disconnect) baked in.
9. 🔭 **Sandbox contract-capture mode** for write/publish endpoints.
10. 🔭 **SW robustness defaults** — fold the null-body guard, first-load `clients.claim`, SAS-strip, richest-body dedupe, cross-origin static handler into the template + cover with target tests.
11. 🔭 **Audit & remove all text-asset size caps** (general principle after bug #1).

---

## 5. Target-specific vs engine-wide

- **Engine-wide** (any clone benefits): bugs #1–#10, #12; P0.1, P0.2, P2.8–11.
- **Webapp/replay-specific**: the stateful-mock + backend-handoff + backend-scaffold (P0.3, P1.4) and
  authenticated-SaaS crawling (P1.5, route-budget #11, crawl-merge P1.7). These move `webapp`/`replay`
  from "pixel-accurate read-only mirror" toward "functional, mutable app clone" — the direction the
  Tempo target proved is achievable.

## 6. The headline takeaway
A real-bundle **replay + recorded backend + an auto-generated typed backend behind the same SW seam**
produces a clone that is not just visually 1:1 but *functionally* 1:1 (stateful CRUD, generation
job lifecycle, a closeable autonomous loop) — with real models left as one-interface swaps. The two
features that make this repeatable for the next target are the **backend-scaffold generator** (P0.3)
and the **parity gate** (P0.2). Build those next.
