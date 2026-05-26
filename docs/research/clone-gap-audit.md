# Clone Gap Audit — app.clickup.com replay-merged

- **Clone served:** `http://localhost:7900` (SPA mode, dir `docs/research/crawl/app.clickup.com/replay-merged`)
- **Owned backend:** `http://localhost:8787`
- **Workspace:** `90152566819` (Cameron Mc's Workspace) — 2 spaces, 24 lists, 10 docs
- **Driver:** Playwright 1.58.2 (repo `node_modules`), headless, 1440x900, SW-controller wait + reload + 8.5s settle
- **Method:** real ids enumerated from the ClickUp public API; each destination classified by `viz/v1/view` HTTP status + landing-scaffold detection + body text

## Render Scoreboard

**14 of 37 destinations render real content.** (38% pass)

| Class | RENDERS | BLANK | UNAVAILABLE |
|---|---|---|---|
| nav-section | 12 | 1 | 0 |
| view-type | 2 | 10 | 7 |
| dashboard-route | 0 | 1 | 0 |
| docs | 0 | 0 | 4 |
| **Total** | **14** | **12** | **11** |

- RENDERS = real target content present (view pane populated, not the default landing).
- BLANK = shell boots but shows the generic `Cameron Mc's Workspace / Ask AI` landing scaffold instead of the target list/view (empty-200 fallback).
- UNAVAILABLE = `page is unavailable / this link is invalid`; the view-data request 404'd.

## Root Cause (single, unified)

The replay SW (`replay-manifest.json`: `unrecordedMode: empty-200`, `recordingCount: 275`) holds **only 2 recorded `viz/v1/view/{id}` responses**:

- `2kyr6013-375` (Calendar, list 901523542898) -> renders
- `2kyr6013-835` (Kanban Board, list 901523543266) -> renders

Everything else fails by one of two mechanisms:

1. **UNAVAILABLE (hard 404):** the SPA requests `viz/v1/view/{viewId}` for the route's view; it is not recorded, the SW returns 404, and ClickUp's client renders the "page is unavailable / this link is invalid" error. Affects: all `list`, the non-recorded `board`/`calendar`/`gantt`, all `timeline`, and **all docs** (doc deep-links also fire `viz/v1/view/{docId}` and 404).
2. **BLANK (empty-200 landing):** view types whose data comes through a different path (`view/v1/genericView` POST, or table/dashboard/form/conversation/clickboard data services) get the `empty-200` fallback. The shell boots with the global view-tab scaffold but no list context, so it shows the default workspace landing. Affects: all `table`, `dashboard`, `form`, `conversation`, `clickboard`, plus the recorded dashboard `2kyr6013-975` route.

Net: only the 2 specific recorded views render their pane. The reason Cameron hits "page unavailable" everywhere is that **per-view data was never recorded for the other 22 lists / their ~17 other view types / all 10 docs.**

## Gap Inventory — ranked by impact

### GAP 1 — List/Board/Calendar/Gantt/Timeline views: 404 on `viz/v1/view` (UNAVAILABLE) — HIGHEST IMPACT
The default and most-clicked destinations. Every list's primary view dies.

- Failing endpoint (per view): `GET https://frontdoor-prod-eu-west-1-3.clickup.com/viz/v1/view/{viewId}` -> **404**
- Examples:
  - `/90152566819/v/l/2kyr6013-1115` (List "Active") -> 404 `/viz/v1/view/2kyr6013-1115`
  - `/90152566819/v/l/2kyr6013-1095` (List "Completed") -> 404 `/viz/v1/view/2kyr6013-1095`
  - `/90152566819/v/c/2kyr6013-275` (Calendar) -> 404 `/viz/v1/view/2kyr6013-275`
  - `/90152566819/v/g/2kyr6013-435` (Gantt) -> 404 `/viz/v1/view/2kyr6013-435`
  - `/90152566819/v/g/2kyr6013-335` (Gantt) -> 404 `/viz/v1/view/2kyr6013-335`
  - `/90152566819/v/b/2kyr6013-2235` (Board "Priorities") -> 404 `/viz/v1/view/2kyr6013-2235`
  - `/90152566819/v/tl/2kyr6013-2155` (Timeline) -> 404 `/viz/v1/view/2kyr6013-2155`
- Working counter-examples (recorded): `/v/c/2kyr6013-375`, `/v/b/2kyr6013-835`.
- Per view-type counts (sampled 2/type): list 0/2 render, board 1/2, calendar 1/2, gantt 0/2, timeline 0/1.

### GAP 2 — Docs deep-links: 404 on `viz/v1/view`, no doc content endpoint (UNAVAILABLE) — HIGH IMPACT
All 10 docs. Opening any doc by id fails.

- Failing endpoint: `GET .../viz/v1/view/{docId}` -> **404** (doc render path is not wired; the doc-content services `docs/v1/...` / `docs/v1/team/.../docs/bulk` exist as recordings but the deep-link route never reaches them).
- Examples: `/90152566819/docs/2kyr6013-1275` (Product Brief), `-1595` (Getting Started Guide), `-1795` (Team Docs), `-2035` (Untitled) — all 404.
- Note: the Docs **hub** (`/90152566819/docs`) renders the doc list fine. Only individual doc bodies fail.

### GAP 3 — Table/Dashboard/Form/Conversation/Clickboard views: empty-200 landing (BLANK) — HIGH IMPACT
Shell + view-tab scaffold render, but the target list never loads; user sees the default workspace landing.

- Mechanism: `viz/v1/view` served empty-200 (or data flows through `POST view/v1/genericView` / `task-v3/.../tasks/bulk`, which are body-keyed and not matched). No 4xx is logged; the tell is the `Cameron Mc's Workspace / Ask AI` landing scaffold.
- Examples:
  - `/90152566819/v/t/2kyr6013-355` and `/v/t/2kyr6013-255` (Table)
  - `/90152566819/v/ds/2kyr6013-795`, `/v/ds/2kyr6013-1775` (Dashboard)
  - `/90152566819/v/ds/2kyr6013-975` (recorded dashboard route — still BLANK; render path not hydrating despite `dashboard/2kyr6013-975` being recorded)
  - `/90152566819/v/f/2kyr6013-1055`, `/v/f/2kyr6013-1755` (Form)
  - `/90152566819/v/cv/6-901523546362-8`, `/v/cv/6-901523547043-8` (Conversation)
  - `/90152566819/v/cb/2kyr6013-1715`, `/v/cb/2kyr6013-1235` (Clickboard)
- Per view-type counts: table 0/2 render, dashboard 0/2, form 0/2, conversation 0/2, clickboard 0/2.

### GAP 4 — Timesheets nav: BLANK — LOW IMPACT
- `/90152566819/time/timesheets` -> txt=62, no content pane. No 4xx logged (scheduling endpoints `scheduling/v1/team/.../time_entries/*` are recorded but the timesheets view itself does not hydrate).

### Working nav (12/13 render): Home, Inbox, Docs hub, Dashboards hub, Whiteboards, Chat, Planner, AI, Goals, Pulse/More, Settings.
(`Everything/Spaces` boots to the landing scaffold; counted as a render but is effectively empty.)

## Prioritised Capture Targets (what to crawl from live ClickUp to close each gap)

Capture must record the **per-view data endpoints** for each real view id, not just the bootstrap. The SW keys on `method + pathPattern + origin`, so each id needs its own recorded response.

1. **GAP 1 — record `GET viz/v1/view/{viewId}` for every list view.** Crawl each of the 24 lists and visit each of its views (list/board/calendar/gantt/timeline). Priority order: the default `list` view of every list first (most-hit), then board, calendar, gantt, timeline. This single endpoint fixes the largest UNAVAILABLE bucket.
2. **GAP 2 — record the doc render chain for all 10 docs.** Visit each doc deep-link live and capture whatever the doc route fetches (`docs/v1/...` page/subpage content + `docs/v1/team/90152566819/docs/bulk`/`search`), and confirm the correct deep-link route so it stops firing `viz/v1/view/{docId}`.
3. **GAP 3 — record the non-list view data paths.** For table/dashboard/form/conversation/clickboard, capture `POST view/v1/genericView`, `POST task-v3/experience/.../tasks/bulk`, `POST task-v3/.../tasks/history`, and the dashboard chain (`dashboard/{id}`, `automation/dashboard/{id}/workflow`) per real view id. Body-keyed POSTs must be recorded with their exact request bodies so the SW can match.
4. **GAP 3 (dashboard) — fix `/v/ds/{id}` hydration.** `dashboard/2kyr6013-975` is already recorded yet the route is BLANK; re-capture the dashboard route end-to-end (including `cards/v2/.../canvases` and widget data) and verify the path letter `ds`.
5. **GAP 4 — record the Timesheets view payload** (`scheduling/v1/team/90152566819/time_entries/*` plus whatever the timesheet grid fetches on first paint).

### Capture-loop guidance
- Crawl with a logged-in profile (`--mode=cdp` or `--mode=persistent`) so `viz/v1/view` returns real data instead of 404.
- Visit at least one view of **every type per list** to harvest all `viz/v1/view/{id}` ids; the audit shows the SW will 404 any id it has not seen.
- Re-merge into `replay-merged` and re-run this audit; target is `viz/v1/view` 200 for all 24 lists' default views + 10 docs rendering + the 5 non-list view types populating.

## Reproduce
```
node /tmp/cuaudit/audit2.cjs        # corrected classifier (viz-status + landing detection)
# raw machine output: docs/research/clone-gap-audit.json
```
