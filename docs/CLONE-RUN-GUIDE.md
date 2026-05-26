# ClickUp Offline Clone — Run Guide

A self-hosted, offline clone of your ClickUp workspace: ClickUp's real UI bundle running
locally against an **owned backend** (CQRS + local SQLite) seeded from your real data.
No login, no "you're offline" block, task writes persist locally.

## Prerequisites
- Node 25+ (uses built-in `node:sqlite`), repo deps installed (`npm install`).
- Built clone corpus at `docs/research/crawl/app.clickup.com/replay-merged` (already built).

## Start it (two processes)

```bash
# 1. Seed + run the owned backend (serves your real workspace data + accepts writes)
npm run backend:seed          # one-time per data refresh -> .runs/backend/events.db
npm run backend               # serves on http://localhost:8787  (keep running)

# 2. Serve the clone UI (SPA mode is required)
npx serve -s docs/research/crawl/app.clickup.com/replay-merged -l 7900   # keep running
```

Then open in a **fresh / incognito** window, **refresh once**, wait ~30–60s for the
service worker to take over and the app to boot.

## Working pages (open these)
| Page | URL |
|---|---|
| Home / My Tasks | http://localhost:7900/90152566819/home |
| Docs hub | http://localhost:7900/90152566819/docs |
| List | http://localhost:7900/90152566819/v/li/901523543274 |
| Board (Kanban) | http://localhost:7900/90152566819/v/b/2kyr6013-835 |
| Gantt | http://localhost:7900/90152566819/v/g/2kyr6013-115 |
| Table | http://localhost:7900/90152566819/v/t/2kyr6013-155 |
| Task detail | http://localhost:7900/t/86c9yhmww |

## What works vs in-progress
- ✅ Renders real data, no offline banner, **task create/edit/status writes persist** (owned backend).
- ⏳ Doc *body* paint (content loads into the DOM; a coeditor visibility flip is pending).
- ⏳ Calendar grids, dashboards, forms, conversations.
- ⏳ Routing to every per-list view (view-ID injection into the hierarchy tree).

## How it's built (pipeline)
1. **Capture** — Playwright crawls your authed ClickUp; records DOM + network (`npm run crawl:webapp`).
2. **Merge** — union recordings across crawls, dedup by request fingerprint (`build:replay --merge-dirs`).
3. **Owned backend** — `scripts/backend-server.ts`: CQRS event store (`node:sqlite`) seeded from
   your API export; serves the internal API shapes + accepts write commands.
4. **Replay** — `build:replay` emits a static site + a service worker that forwards internal API
   calls to the owned backend (`--backend`), falling back to recordings.
5. **Verify** — `npm run parity:track` scores visual/DOM/API/state/transition parity.

## Refresh your data
Re-run the API export + re-seed:
```bash
npm run export:clickup        # needs .clickup.env (your token) — gitignored
npm run backend:seed
```

## Key dirs
- Owned backend: `engine/targets/webapp/backend/`
- Replay emitter: `engine/targets/webapp/replay/`
- Parity harness: `engine/verify/parity/`
- Architecture: `docs/architecture/parity-backend-blueprint.md`
- Gap inventory: `docs/research/clone-gap-audit.md`
</content>
