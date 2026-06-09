# ClickUp Crawl Failure — Multi-Causal Attribution

Date: 2026-05-28
Analyst: diagnostic subagent (read-only)
Source crawl: `docs/research/crawl/app.clickup.com/replay-merged` (merged 2026-05-26, 11 source crawls 2026-05-25 / 2026-05-26)
Cross-check crawl: `docs/research/crawl/app.clickup.com/run3v-merged` (merged 2026-05-27, 6 source crawls)
Source gap audit: `docs/research/clone-gap-audit.{md,json}` (2026-05-26)

## Inventory

### Primary analysis target — `replay-merged` (built site behind the failing clone)

The artefact named in `clone-gap-audit.md`. Built from 11 merged source crawls:

| Source crawl dir | startUrl | states | uniqUrls | reachedLimit | duration (s) | NW size |
|---|---|---|---|---|---|---|
| 2026-05-26T07-52-05-095Z | `/90152566819/home` | 16 | 3 | queue-empty | 433 | 2.0G |
| 2026-05-26T07-59-43-130Z | `/90152566819/docs` | 19 | 2 | queue-empty | 409 | 2.2G |
| 2026-05-26T08-06-50-744Z | `/v/li/901523543274` | 16 | 2 | queue-empty | 434 | 2.0G |
| 2026-05-26T08-14-22-272Z | `/v/b/901523543266` | 2 | 2 | queue-empty | 24 | 127M |
| 2026-05-26T08-15-44-070Z | `/t/86c9yhmww` | 14 | 2 | queue-empty | 419 | 1.8G |
| 2026-05-26T08-23-01-411Z | `/v/c/901523543274` | 2 | 2 | queue-empty | 26 | 120M |
| 2026-05-25T16-33-12-057Z | `/v/li/901523543284` | 6 | 1 | queue-empty | 180 | 766M |
| 2026-05-26T08-51-31-741Z | `/v/b/2kyr6013-835` | 12 | 1 | queue-empty | 310 | 1.3G |
| 2026-05-26T08-57-03-314Z | `/v/c/2kyr6013-375` | 13 | 2 | queue-empty | 339 | 1.6G |
| 2026-05-26T12-02-41-066Z | `/v/dc/2kyr6013-1595` | 8 | 1 | queue-empty | 256 | 1.1G |
| 2026-05-26T12-08-18-344Z | `/v/dc/2kyr6013-1275` | 8 | 1 | queue-empty | 244 | 977M |

Each crawl has: `graph.json`, `network.jsonl`, `summary.json`, `storage-state.json`, `websocket.jsonl`, `states/` (per-state `dom.html` + `dom-raw.html` + `aria.txt` + `meta.json` + `screenshot.png`). No `dom-snapshots.jsonl`, no `trace.zip`, no `recordings/` dir (those belong to the `capture` pipeline, not the crawler).

Merged into `replay-merged/replay/recordings.json` (316 deduped recordings, 2.5MB) + `replay-manifest.json` (assetCount 439, backfilledCount 972, wsConnectionCount 2, wsFrameCount 963).

### Cross-check target — `run3v-merged` (2026-05-27, multi-view fresh run)

66 nodes / 60 edges / 7 unique URLs / 5 unique viewIds visited across 6 seeded crawls. Same failure pattern.

### Hard numbers

- viewIds visited across all 11 source crawls (`replay-merged`): **8** (`2kyr6013-1155, 1275, 1415, 1595, 375, 415, 835, 975`)
- viewIds with a 200 response in merged recordings: **7** (`-1155, -1275, -1415, -1595, -375, -835, -975` plus `-415`)
- viewIds REFERENCED ANYWHERE in any captured response body: **55** (`-35, -55, -75, -95, -115, -135, ..., -2035, -1775, etc.`)
- viewIds discovered but never visited: **48 of 55 = 87.3%**

## Per-Factor Attribution

### Factor 1 — AUTH EXPIRY → ~0% contribution | confidence: HIGH

Scanned every source crawl's `network.jsonl` for 4xx auth codes.

- Total 401 responses across the largest source crawl (`2026-05-26T12-08-18-344Z`, 977M network.jsonl, 2873 response lines): **9** (0.3%)
- Total 403 responses: 0
- All 9 × 401s are the SAME URL: `https://frontdoor-prod-eu-west-1-3.clickup.com/tasks/v1/task/86/memberHierarchy` with body `{"err":"You do not have access to this task","ECODE":"ACCESS_083"}`
- Other 10 source crawls (sampled first 50 000 jsonl lines each): **0 × 401, 0 × 403**
- Storage-state size per crawl: ~7.5–9.2 MB (cookies + IDB + localStorage — fully populated)
- Crawler boot includes `verifyAuthenticated()` (crawler.ts:59-80) that checks for redirect to `/login` and visible password fields; all 11 crawls passed (no `reachedLimit: 'fatal-error'`)

**Verdict:** Auth was healthy throughout. The 9 × 401s are scoped permission errors on one specific deleted/foreign task, not session expiry. Auth is NOT a contributing cause.

### Factor 2 — DEDUP COLLAPSE → ~0% contribution | confidence: HIGH

Canonical key (`engine/targets/webapp/crawler/canonical-key.ts`):

```
key = normalizeRouteUrl(url) + '::' + serialiseSignature(sig) + '::' + domHash
```

`normalizeRouteUrl` (url-normalize.ts) strips only `utm_*`, `fbclid`, `gclid`, `_`, plus hex-blob values + unix-timestamp values. **Path + viewId-bearing path segments + content-affecting params (`tab`, `view`, `filter`) are KEPT.** The signature includes dialogs + active tabs + drawers + panels.

**Empirical test:** map each visited URL to its canonical route prefix:

```
Source crawl uniqUrls / uniqRoutes per startUrl:
  /home          16 nodes  -> 3 routes (home, my-work-ish overlay routes)
  /docs          19 nodes  -> 2 routes
  /v/li/901523543274  16 nodes -> 2 routes
  ... etc
```

uniqUrls == uniqRoutes for every crawl. The canonical key does NOT collapse distinct viewIds onto each other (because the viewId is part of the pathname, which is preserved verbatim). Run3v-merged 2026-05-27: 7 distinct URLs preserved across 66 nodes, all with distinct viewIds.

**Verdict:** Dedup is doing what it claims — overlay states share a URL but get distinct keys via signature; distinct viewId URLs are kept distinct. Dedup is NOT collapsing viewIds. Not a contributing cause.

### Factor 3 — VIRTUAL SCROLL / SIDEBAR EXPANSION → ~40% contribution | confidence: HIGH

The "ClickUp sidebar tree" is not a virtual scroller — it is an **accordion-collapsed tree** (Workspace → Spaces → Folders → Lists → Views) where each non-leaf is hidden behind `aria-expanded="false"`.

Evidence from `2026-05-26T07-52-05-095Z/states/state-0001/dom.html`:

| Indicator | Count |
|---|---|
| `aria-expanded="false"` | **27** |
| `aria-expanded="true"` | 2 |
| `<a href="/v/...">` in sidebar | only 5–9 across all 16 states |
| `<cu-sidebar*>` distinct elements per state | 7 (always the same chrome) |
| Distinct sidebar-rendered viewIds across all 16 states (union) | 30 (and 30 of those are in state-0016 `/hubs/dashboards`, embedded as `data-test-id` not `<a href>`) |

The crawler's `interactive-discovery.ts` only collects elements matching `button:not([disabled]), a[href], [role="button"], [role="menuitem"], [role="tab"], [role="link"], [tabindex]:not([tabindex="-1"]), input, select, summary, [data-toggle], [data-modal]`. Sidebar disclosure triangles in ClickUp's Angular CDK tree are `<button>` elements but they are inside the collapsed `aria-expanded="false"` parent → **not visible in viewport** → filtered out by `interactive-discovery.ts:64-67` (rect.width <= 0 check fails for hidden children, but immediate-child collapsed nodes pass the visibility check yet do not expose their descendants).

Even when the crawler clicks one disclosure (visible at depth 0), it only reveals the NEXT level's collapsed children; reaching the leaf views requires N×levels of recursive expansion that nothing in `crawler.ts` ever does. There is no "tree-aware expander" pass. The `chrome-warmup.ts` hovers but does not click disclosure triangles.

**Verdict:** Single largest contributor along with API discovery. The collapsed sidebar tree gates 90%+ of in-app viewIds from ever being reachable via the crawler's discovery surface. Confirmed by the memory note: "the sidebar tree is collapsed/virtualized → only reached home/my-work/inbox."

### Factor 4 — DEPTH BUDGET → ~0% contribution | confidence: HIGH

- Default `maxDepth=6, maxTime=600s, maxStates=500` (scripts/crawl-webapp.ts:87-89)
- Inline overlay recursion bounded by `MAX_INPLACE_EXPLORE_DEPTH=4` and `DEFAULT_ROUTE_INTERACTION_LIMIT=60` per route (crawler.ts:45-51)

**Empirical:** EVERY single source crawl ended with `reachedLimit: 'queue-empty'`. Not `max-states`, not `max-time`. The largest crawl spent 433s and stopped at 16 states. Depths reached per crawl: `[0,1,2,3]` or `[0,1,2]` — depths are well under the 6-cap.

The frontier was EMPTY when each crawl stopped, not budget-exhausted.

**Verdict:** Depth budget is not the limit. Raising max-depth/max-time/max-states would do nothing because the queue empties. Not a contributing cause.

### Factor 5 — API DISCOVERY GAP → ~60% contribution | confidence: HIGH

The crawler discovers next-URL candidates from **DOM only** (`nav-discovery.ts` walks `nav/aside/header/[role=navigation] a[href]` + text-pattern fallback against ~14 SaaS labels). It NEVER reads JSON response bodies to learn new view URLs.

But ClickUp's own SPA learns the workspace's view inventory from these JSON endpoints (verified in `replay-merged/replay/recordings.json`):

| Endpoint | Status | viewIds in body |
|---|---|---|
| `GET /hierarchy/v3/experience/sidebar/workspaces/90152566819/views` | 200, 2.5KB | **7 viewIds** (`-75, -635, -715, -935, -1595, -1795, -2035`) |
| `GET /hierarchy/v3/experience/sidebar/workspaces/90152566819/tree` | 200, 5.5KB | 38 listIds (each list owns many views) |
| `GET /hierarchy/v1/project/901511060890/category` | 200, 87KB | 28 listIds |
| `GET /viz/v1/subcategory/901523542894/views` | 200, 9.3KB | enumerates per-list views (board/list/calendar/timeline/etc) with `id: "6-901523542894-1"` shapes |

The crawler never opens any of these as URLs (they're API responses, not navigable routes), and never extracts the discovered IDs to synthesise navigable routes like `/v/l/<id>`, `/v/b/<id>`, `/v/c/<id>`, `/v/g/<id>`, `/v/tl/<id>`.

**Quantitative gap:**

- viewIds REFERENCED anywhere in captured responses: **55**
- viewIds the crawler actually visited (across all 11 merged crawls): **8** (and only because Cameron hand-seeded each as a `startUrl`)
- Coverage: **8/55 = 14.5%**

If the crawler had read `/hierarchy/v3/.../views` + `/viz/v1/subcategory/{listId}/views` responses and synthesised the per-list-per-view-type route URLs from `viz/v1/subcategory/<listId>/views` (which holds the canonical `parent.id = listId` + `id = "<type>-<listId>-<seq>"` per view), it would have discovered all 55 (or close to it) and enqueued them as new routes — turning the manual 11-seed workaround into a single-seed automatic crawl.

**Verdict:** Largest single contributor. This is the **mechanism that explains why every workaround has been a manual per-view seed crawl**.

## Ranked Attribution

The two top factors are highly correlated (both encode "the crawler only sees what is in static DOM links + visible clicks"), so the % split is a Shapley-style approximation, not a clean partition.

1. **API DISCOVERY GAP — ~60%** — evidence: 47/55 viewIds were enumerated in API response bodies (`/hierarchy/v3/.../views`, `/viz/v1/subcategory/<id>/views`) the crawler captured but never parsed, so 85% of the workspace's view surface is invisible to the BFS frontier.
2. **VIRTUAL SCROLL / COLLAPSED SIDEBAR — ~40%** — evidence: 27 × `aria-expanded="false"` vs 2 × `aria-expanded="true"` in every captured sidebar DOM; only 5–9 `<a href="/v/...">` links per state vs the workspace's 24 lists × 5–6 view types ≈ 130 views. The disclosure triangles are buttons but their descendant view links never materialise in DOM until expansion runs.
3. **AUTH EXPIRY — ~0%** — only 9 of 2873 responses were 401, all scoped to one permission error on a foreign task.
4. **DEDUP COLLAPSE — ~0%** — canonical key preserves viewIds; uniqUrls == uniqRoutes per crawl.
5. **DEPTH BUDGET — ~0%** — every crawl hit `queue-empty`, never the depth/time/state caps.

**Single most likely top contributor:** API DISCOVERY GAP, very narrowly ahead of SIDEBAR EXPANSION. Both must be fixed because they cover different failure modes: API-discovery fixes the "I know views exist but cannot reach them" gap; sidebar expansion fixes the "I am in the app shell but the navigation surface is hidden" gap. API-discovery is the higher-leverage one because a single fix unlocks ALL the per-list × per-view-type combinations from one bootstrap response.

## What Needs A Fresh (Small) Crawl

Nothing critical. The existing artefacts are sufficient to attribute the failure with high confidence. Two small validation crawls would only sharpen the % split, not change the ranking:

- **Single-seed crawl with a tree-expander pass** (Factor 3 isolation) — would show how many viewIds become visible in DOM after recursive sidebar expansion. Cheap (one 5-min crawl, seed `/90152566819/home`, run an instrumented `expandSidebar()` step before discovery). Would convert today's "looks like ~30 viewIds in DOM with hub-pages helping" into a precise number.
- **Single-seed crawl with a route-from-API-response pass** (Factor 5 isolation) — would show how many viewIds the crawler reaches when it parses `/hierarchy/v3/.../views` + `/viz/v1/subcategory/<id>/views` and enqueues synthesised `/v/<typeCode>/<id>` URLs. Cheap (one 10-min crawl). Would confirm the 55-discovered → enqueue path works.

Neither blocks shipping the fix. Both can be done in the same single-seed run that ships the patterns below.

## Recommended First Pattern To Build

**hybrid-route-discoverer** — a crawler pass that (a) parses captured JSON response bodies for the small set of ClickUp view-enumeration endpoints (`/hierarchy/v3/experience/sidebar/workspaces/<wsId>/views`, `/viz/v1/subcategory/<listId>/views`, `/hierarchy/v1/project/<listId>/category`), (b) synthesises navigable route URLs from the discovered `view_id` + `view_entity_type`/`type` codes (Angular's view-type → URL-segment map already lives in `engine/targets/webapp/shell-split/view-type-map.ts` and can be inverted), (c) enqueues them with `PRIORITY_NEW_ROUTE = 100` in the existing priority queue. Defer `virtual-scroll-expander` to a second pass: a `chrome-warmup`-style routine that walks `[aria-expanded="false"]` disclosures inside `aside / [role="navigation"]` and clicks them with an `aria-expanded="true"` post-condition check, bounded by a `MAX_TREE_EXPAND_CLICKS` budget.

Justification: API-discovery is the higher-leverage fix because **one parsed bootstrap response unlocks the entire workspace view inventory in one shot** (the `/hierarchy/v3/.../views` response already enumerated 7 doc views from the first authenticated request) — whereas sidebar expansion requires N × O(spaces × folders × lists) sequential clicks per crawl session. API-discovery is also strictly additive to the existing crawler (one new pass in `crawler.ts`, one new file `engine/targets/webapp/crawler/route-from-api.ts`, no change to dedup/queue/canonical-key) and inherits the no-regression bar. The sidebar-expander remains the recommended Phase-2 follow-up to close the residual gap.

## Confidence Level Of This Report

**HIGH** — backed by:

- 11 complete source crawls with full `network.jsonl` + 7-9 MB `storage-state.json` each
- 316 deduped recordings in `replay-merged/replay/recordings.json` with parseable JSON bodies
- The 2026-05-26 `clone-gap-audit.md` is consistent with the numbers here (audit said "only 2 specific recorded views render their pane" referring to the SW-hit count for SPA-fired `viz/v1/view/<id>` requests; the recordings file actually contains 7, but the SPA only auto-fires 2 of those without explicit user navigation, which is the gap the audit was measuring)
- The cross-check `run3v-merged` (2026-05-27) shows IDENTICAL pattern (6 seeded crawls → 5 unique viewIds visited), proving the failure mode is structural to the crawler, not a one-off

**What would raise it to "very high":** running the two cheap validation crawls described above to convert the Shapley approximation (60/40) into a measured split, and confirming the synthesised route URLs from API responses actually resolve to 200s in a single-seed run.
