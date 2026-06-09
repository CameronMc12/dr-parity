# ClickUp Clone Cumulative State — 2026-05-28
HEAD: 0f1092c (fuzzy body matching)
Branch: prototype-mode (unpushed)
Build: /tmp/dr-parity-clone-final
Served: http://localhost:7050

## Commits in this session

| SHA | Summary |
|-----|---------|
| b369fee | feat(webapp): per-app profile system + hybrid-route-discoverer (ClickUp Phase 1) |
| f2c54ad | feat(webapp): view-template synth for ClickUp (replay enhancement) |
| 70bb916 | feat(webapp): doc freezer for ClickUp Codox-backed docs |
| 0f1092c | feat(webapp): fuzzy body matching for ClickUp POST endpoints |

## Build output

| Artifact | Size |
|----------|------|
| `index.html` | 4.2 MB |
| `sw.js` | 64 KB |
| `replay/view-templates.json` | 98 KB |
| `replay/doc-pages.json` | 18 KB |

Build stats: 155 recordings deduped, 125 assets localized, 5 view templates inferred, 10 docs / 12 pages frozen, 16,656 content bytes.

## Tour results

| # | URL | Title | DOM chars | x-replay-source counts | Outcome | Screenshot |
|---|-----|-------|-----------|------------------------|---------|------------|
| 1 | `/90152566819/home` | My Tasks (correct) | 5.8M | recording=119, empty=5, fuzzy=2 | looks-good | /tmp/clickup-clone-tour-1.png |
| 2 | `/v/l/2kyr6013-1115` (list, known-good) | Product Ideas & Prioritization (correct) | 6.3M | recording=121, empty=8, synth=1, fuzzy=3 | looks-good | /tmp/clickup-clone-tour-2.png |
| 3 | `/v/b/2kyr6013-835` (board) | Kanban Board (correct) | 5.6M | recording=119, empty=10, synth=1, fuzzy=5 | partial — board columns absent (only 9 task nodes) | /tmp/clickup-clone-tour-3.png |
| 4 | `/v/cal/2kyr6013-375` (calendar) | List (wrong — defaulted to list) | 6.2M | recording=116, empty=5, fuzzy=2 | partial — cal grid present but month grid absent; title wrong | /tmp/clickup-clone-tour-4.png |
| 5 | `/v/dc/2kyr6013-1595/2kyr6013-375` (doc) | List (wrong — never transitioned) | 6.2M | recording=102, empty=13, fuzzy=3 | broken — no .ql-editor mounted, doc-pages.json SW-blocked | /tmp/clickup-clone-tour-5.png |
| 6 | `/v/dc/2kyr6013-635/2kyr6013-115` (doc) | List (wrong) | 6.2M | recording=110, empty=17, fuzzy=3 | broken — same as #5 | /tmp/clickup-clone-tour-6.png |
| 7 | `/v/l/2kyr6013-9999` (uncaptured synth fallback) | Product Ideas (SPA defaulted to last list) | 6.3M | recording=119, empty=6, synth=1, fuzzy=3 | partial — view-synth fired (synth=1) but route did not navigate to the uncaptured view | /tmp/clickup-clone-tour-7.png |

**Totals across tour:** synth-view=3, fuzzy-body-match=21, codox-block=0, empty=64

## What works

- Shell + chrome: sidebar, workspace nav, top bar, spaces tree all visible across all 7 pages.
- Home route renders correct "My Tasks" landing with workspace identity.
- List view (known-good): correct title, 6.3M DOM, task data visible. List layout confirmed.
- Board view title resolves correctly ("Kanban Board"). SPA navigates to correct route.
- view-synth fires on routes with no exact recording (synth-view=1 each on visits 2, 3, 7).
- fuzzy-body-match fires consistently on POST endpoints across all visits (21 total hits).
- Build pipeline clean: 155 recordings, 5 synth templates, 10 docs frozen, 0 asset backfill failures.
- Service worker boots, intercepts correctly, recordings serve at expected volume (~110-121 per page).

## What's still broken / partial

- **doc-pages.json SW-blocked (critical):** The SW intercepts `fetch('/replay/doc-pages.json')` from the doc-freeze shim and returns an empty-200 body `{}` (x-replay-source: empty) because `/replay/*.json` paths are not on the SW's static allowlist. The 18KB frozen content never reaches the shim; `.ql-editor` never mounts on doc routes.

- **Calendar view does not render month grid:** `hasCalGrid=true` confirms the app reached the calendar component, but `hasMonth=false` and the title shows "List" — the SPA's internal calendar data request is missing a recording or the calendar component falls back to list layout when a key API returns empty.

- **Board view: board columns absent:** `hasBoardCols=false`, `hasTaskCards=false`. The SPA title resolves correctly to "Kanban Board" but the board rendering pipeline is missing a critical data endpoint — likely a column-order or view-settings call returning empty-200.

- **Doc route SPA navigation failure:** The app does not route to `/v/dc/...`; the page title stays as the last list view. The `viz/v1/view/<docId>` call likely returns empty-200 instead of a captured doc-view response, so the SPA never transitions.

- **codox-block=0 across all visits:** The Codox short-circuit in sw.js is correctly wired but never fires because the SPA does not reach the Codox auth/CDN handshake (it fails before doc content loads due to the routing failure and doc-pages SW block).

- **Sidebar: no month expansion:** Space tree visible but collapsed; no per-view sub-items visible for the calendar or doc spaces.

## Remaining tasks

- **#FIX-CRITICAL — SW static allowlist for replay data files:** Add `/replay/doc-pages.json` (and `/replay/view-templates.json` for parity) to the SW's same-origin static passthrough, bypassing the `handleApi` path so the doc-freeze shim receives real data. One-liner in `emit-sw.ts`: append `'/replay/'` to `LOCAL_ASSET_PREFIXES` or add an explicit passthrough before `handleApi`.

- **#8 schema-drift:** Calendar and board column data requests (column order, view settings) are likely returning empty-200 due to schema drift between crawl recordings and the live endpoints. Need to identify which `viz/v1/...` or `api/v3/...` calls are returning empty and either add synth coverage or a fuzzy match rule.

- **#9 boot-blocker:** Doc SPA routing: the `viz/v1/view/<docId>` lookup for a doc-type view is not being matched by a recording or synth. Need a doc-type synth template or a specific recording for doc views.

- **#5 sidebar expander (parked):** Sidebar space tree is visible but collapsed. Expand-on-nav logic is a lower priority once docs and calendar render.

## Verdict

**PARTIAL**

The shell, workspace chrome, home route, and list views render functionally (6.3M DOM, correct titles, real task data, fuzzy-body and synth-view firing). The four session's commits are all wired and active in the build. However two significant gaps remain: doc routes fail silently due to the SW blocking `/replay/doc-pages.json`, and calendar/board views do not render their primary content grids. Of 7 tour pages, 2 are unambiguously working (home, list), 1 is close (board — correct title, SPA navigated, missing grid data), 1 is marginal (calendar — correct component mount, wrong data), and 2 are broken (doc routes). The uncaptured synth fallback (7) shows view-synth activating correctly, which validates the feature even if the full nav path is blocked by the same data-routing gap.

## Recommended next session focus

The single highest-leverage fix is adding `/replay/` to the SW's `LOCAL_ASSET_PREFIXES` constant in `engine/targets/webapp/replay/emit-sw.ts`. This unblocks the doc-freeze shim in one line and should make doc routes render immediately with the 16,656 bytes of frozen content already in the build. After that, audit which `viz/v1/view/{docId}` and calendar column-data calls are returning empty-200 and add targeted synth templates or recordings — this is the path to getting all 7 tour pages to PASS.

---

## Codex handoff — ClickUp React shell parity and monorepo setup — 2026-05-28

This section records the work done after the Claude usage window ended, so the next Claude session can resume without re-discovering it.

### Monorepo setup added

The repo now has a pnpm/turbo monorepo scaffold:

- `pnpm-workspace.yaml`
- `turbo.json`
- `biome.json`
- `tsconfig.base.json`
- root `package.json` scripts for workspace dev/build/typecheck
- root `tsconfig.json` excludes for generated app/package scratch areas

New workspace packages/apps:

- `apps/web`: Next 15 app for the React ClickUp shell clone.
- `packages/design-system`: shared ClickUp CSS/tokens/sprite assets.
- `packages/ui`: small shared UI primitives package.

Important commands that passed:

```bash
npm run typecheck
pnpm --filter @parity/web exec tsc --noEmit
pnpm --filter @parity/web build
```

`next build` compiles successfully. It prints `ESLint must be installed in order to run during builds`, but exits successfully.

### Runtime/dev-server notes

If Next/Vite shows stale runtime errors such as `__webpack_modules__[moduleId] is not a function`, stop old dev servers and clear the Next build cache:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
kill <stale-node-pids>
find apps/web/.next -mindepth 1 -maxdepth 1 -exec rm -r {} +
pnpm --filter @parity/web dev
```

The sandbox used by Codex cannot bind local ports, so browser/screenshot parity could not be rerun from inside Codex. Run the harness locally with the oracle and React app running.

### Vite app import fix

The older `apps/clickup-react` Vite app was failing on `@/components/shell/AppShell`. Added `apps/clickup-react/vite.config.ts` with the `@` alias to `src`. `npm run build` in `apps/clickup-react` passed after that.

### Next route conflict fix

`apps/web` initially had both `/` and `/[[...route]]`, causing:

```text
You cannot define a route with the same specificity as a optional catch-all route ("/" and "/[[...route]]").
```

The root `page.tsx` was removed. `apps/web/src/app/[[...route]]/page.tsx` now redirects `/` to `/90152566819/home`.

### ClickUp shell parity correction

The first React sidebar pass incorrectly used separate `SpacesSidebar` and `DocsSidebar` for list/doc routes. The saved oracle screenshots in `tooling/parity-harness/output/2026-05-28T14-00-02` showed this was wrong:

- Home/list/inbox/doc routes keep the main `Home` sidebar.
- List routes highlight `All Tasks`.
- Inbox/notifications routes highlight `Inbox`.
- Doc routes expand the `Software Development` space tree inside the Home sidebar and highlight `Getting Started Guide`.

Current important files:

- `apps/web/src/components/ClickUpWorkspace.tsx`
- `apps/web/src/components/shell/sidebars/HomeSidebar.tsx`
- `apps/web/src/components/shell/Sidebar.tsx`
- `packages/design-system/src/clickup-globals.css`

Current behavior:

- `ClickUpWorkspace` keeps the shell icon/sidebar on `home` for app routes.
- `HomeSidebar` is now a client component using `usePathname()` to choose active state:
  - `/home` -> `My Tasks`
  - `/inbox` or `/notifications` -> `Inbox`
  - `/v/l/...` -> `All Tasks`
  - `/v/dc/...` -> expanded doc tree under `Software Development`, active `Getting Started Guide`
- `packages/design-system/src/clickup-globals.css` includes a measured `translateY(5px)` nudge for icon-bar body labels/links from the prior Claude measurements.

The previous `SpacesSidebar.tsx` and `DocsSidebar.tsx` still exist, but they are not the 1:1 shape for the main route shell. Treat them as experimental unless a route in the oracle explicitly opens the Spaces or Docs hub sidebar.

### Known limitation in current React shell state

The latest source builds and typechecks, but visual parity has not been re-scored after the final HomeSidebar route correction because Codex could not start local servers in the sandbox. The next session should:

```bash
pnpm --filter @parity/web dev
npx serve /private/tmp/dr-parity-clone-final -l 7050
cd tooling/parity-harness
npm run parity:shell
```

Then compare the new output against `tooling/parity-harness/output/2026-05-28T14-00-02`. The expected improvement is on list/doc/inbox route sidebar regions because the React app no longer swaps to the wrong sidebar component.
