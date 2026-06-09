# ClickUp React Clone Audit

**Target:** The active React clone emitted at `clones/clickup-react-2026-06-05/`

**Date of this audit:** 2026-06-08 (point-in-time synthesis)

---

## 1. Header / Scope / Snapshot Note

**Purpose:** This is an in-depth feature gap audit focused on making the ClickUp React clone *usable while tweaking*. The goal is to move from a beautiful but frozen visual reference into something the user can load daily, perform core task-management workflows in, and iteratively improve by hand on top of the emitted scaffold.

**Snapshot basis:** 
- Primary source: exhaustive analysis of the emitted clone at `clones/clickup-react-2026-06-05/` (9 page components, full asset mirror, ~200 MSW fixtures, static verbatim bodies, minimal simulated chrome).
- Full body of prior ClickUp research and clone-effort artifacts, including (but not limited to):
  - `docs/research/clickup-parity/build-out-gaps.md`
  - `docs/research/clickup-parity/98-percent-react-parity-workflow.md`
  - `docs/research/clone-gap-audit.md` (and `.json`)
  - `docs/research/clickup-parity/interaction-inventory.md` (and `.json`)
  - `docs/research/clickup-parity/mock-db/coverage.md`
  - `docs/research/clickup-export/BACKEND_CONTRACT.md` (and `.json`)
  - `docs/research/clickup-parity/surface-map/*` (routes.md, actions.md, endpoints.md, INDEX.md)
  - `docs/V2.0/10-cumulative-clickup-clone-state.md`
  - `docs/research/clickup-parity/seed/` and related export artifacts
  - Per-view DOM captures under `docs/research/clickup-parity/{list,board,gantt,calendar,timeline,table,doc,dashboard,mindmap,whiteboard,workload,activity,...}/`
  - `docs/research/clickup-parity/interactions/` (per-surface control inventories)
  - Broader V2.0 series and architecture notes.

**Important:** Parallel clone work is ongoing in another terminal/session. This document is a frozen point-in-time audit. Revisit, append, and update sections as the clone evolves (e.g., after adding writable state, wiring a new view, or expanding fixtures). No code changes, builds, captures, or mutations were performed during creation of this audit. All analysis is read-only synthesis.

The clone was produced via the React target path of the dr-parity pipeline (static HTML→JSX slices or verbatim shells + MSW from network + post-hydration sync). It is **not** the parallel functional `apps/web` effort or the older replay-merged oracle.

---

## 2. Current State of This Clone (Executive Summary)

**What it is:** A pixel-perfect, high-fidelity static snapshot SPA. It consists of:
- A global shell (`AppLayout.tsx`) providing the persistent ClickUp chrome (sidebar with hierarchy, top/global action bar, search, etc.) plus a `[data-dr-parity-outlet]` portal for route content.
- 8 content "pages" (plus My Work) that render verbatim captured HTML bodies via `dangerouslySetInnerHTML` (or equivalent large embedded strings). All follow identical boilerplate structure.
- Hardcoded routes tied to one specific captured workspace (`90152566819`) and specific view IDs (e.g. board `2kyr6013-2735`, list `901523751540`, doc `2kyr6013-2715/2kyr6013-715`).
- MSW (Mock Service Worker) providing ~200 read-only JSON fixtures covering 158 endpoints (159 handler registrations observed). Many are body-keyed (especially `post-graphql-gateway-*` and genericView paths) to return the exact captured responses.
- Minimal simulated micro-interactions (tab active states, search modal open/close + Escape, sidebar nav item active toggling).
- Full mirrored assets under `public/_ext/` (CDN-captured CSS/JS/images/fonts) + static rescue CSS.
- Post-hydration sync for captured animation libraries and deferred scripts.
- Pure local React state (`useState`/`useRef`/`useEffect` only). No global stores (Zustand, Redux, etc.), no React-driven row data, no mutations, no optimistic updates.
- Router with same-origin `<a>` hijacking (with view-type alias fallback) for SPA feel within the captured graph.

**Strengths (why this is already valuable as a scaffold):**
- **Visual and structural fidelity:** Extremely high. Matches the exact first-paint + tour-exercised state of the captured ClickUp instance at the pixel and DOM level (including Angular-scoped attributes, custom `cu-*` elements, complex CSS cascade that html-to-jsx would have broken).
- **Asset completeness:** Every referenced external resource from the capture is localized.
- **Data surface in fixtures:** Broad coverage of hierarchy (sidebar tree, personal lists, views), 43+ custom fields, users/profiles, view metadata for the exercised views, some comments, dashboards (counts + one full), docs (partial), chat rooms/settings, goals stub, entitlements, etc. Good foundation for seeding.
- **Navigation shell:** The hijack + outlet pattern plus active-state simulations give a convincing "live app" feel for moving between the 8 captured surfaces without full reloads.
- **MSW foundation:** Read fixtures + body-branching already in place (no need to reverse-engineer contracts from scratch). `API_SPEC.md` in the clone root documents every observed endpoint.
- **Post-hydration and rescue:** Animations and third-party libs that rely on global scripts/CSS often "just work" after mount.
- **Encouraging base for tweaking:** As noted by the user, "well enough for me to start using it and tweaking." The verbatim approach deliberately trades immediate deep interactivity for pixel-perfect inspection and a clean, editable React + Vite + MSW starting point.

**Fundamental nature:** This is **not** a functional, data-driven, or interactive task manager. It is a literal static snapshot of the first paint plus whatever the capture tour exercised. Core workflows (CRUD across views, hierarchy management, live filtering, DnD that persists, task detail editing, comments that save, real view config, etc.) are not functional — they are frozen pixels and inert event targets.

**Quick at-a-glance table: Implemented vs Missing (core workflow readiness)**

| Domain                  | Implemented in Clone                                      | Missing / Inert                                                                 |
|-------------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------|
| Global shell + nav      | Full chrome, sidebar hierarchy (static), topbar, 3 micro-simulations, SPA hijack nav | No real workspace/list switching, no context menus, no create-from-chrome that persists |
| Routes / views          | 8 specific captured views + My Work (verbatim bodies)     | All other views (Mind Map, Whiteboard, Workload, Activity, Form, Embed, Chat, Dashboards hub, Goals, full Docs hub, Settings, Inbox, etc.); no dynamic view switching/config |
| Task data & rows        | Visual rows/status pills/assignees/etc. baked into HTML   | No live task arrays, no virtualization, no grouping/filtering/sort that mutates data |
| Task CRUD               | Visual "Create" buttons, kebabs, status pills             | Zero mutations; no create, edit, status change, assign, due date, custom field edit, delete |
| Views & interactions    | Static boards (columns visible), calendars (grid visible), Gantt bars, etc.; tab states | No DnD (classes present but inert), no working filters, no real add-group, no column config, no row clicks opening editable modals |
| Data & state            | MSW read fixtures (~200 files)                            | No writable in-memory DB, no optimistic updates, no React state for tasks/views, no sync between routes |
| Docs                    | One captured doc page (verbatim rich content)             | No docs hub, no page tree/outline, no editing, no multi-page switching, no Codox collab |
| Communication           | Some comment fixtures present; visual threads             | No posting comments, no inbox surface, no chat sending, no notifications |
| Search / filters        | Visual search modal (opens/closes)                        | No actual search results, no filter chips that reduce rows, no saved views |
| Real-time / collab      | None (0 WS connections captured or replayed)              | No presence, no live updates, no CRDT, no mock-socket usage |
| Custom fields / hierarchy | 43+ CF defs in fixtures; sidebar tree visual            | No CF editing/creation, no rollups/relations/formulas in UI, no hierarchy drag/reorg |
| Dashboards / Goals / etc. | Stubs in fixtures (counts, one dashboard)               | No hubs, no widgets, no goal progress, no creation |
| Settings / Admin        | None beyond chrome visuals                                | Full settings surface missing (modal vs inline, many sections absent) |

**Verdict from synthesis (aligned with prior analyses):** "Excellent for visual/parity inspection of the exact captured state. Not a functional, data-driven, or interactive task manager. Core workflows (CRUD across views, hierarchy management) are not functional." "Pixel- and structure-faithful static snapshot clone ... with supporting mocks."

This clone excels at "what did the original look like on this exact workspace/view at capture time?" It is a superb reference and visual anchor while the user hand-tweaks toward daily-driver usability.

---

## 3. Missing Features — Prioritized for Daily Usability (PRIMARY FOCUS)

**Intro:** The gap between "beautiful frozen snapshot I can look at and navigate" and "something I can start using daily and tweak as I go" is almost entirely in **data-driven behavior, mutability, and live interactions**. The emitted clone already delivers the hard part (visuals, assets, shell structure, broad read surface). The remaining work is mostly additive wiring on top of the scaffold: introducing local (or seeded) state, making the captured HTML fragments data-driven where needed (or keeping verbatim chrome and replacing only the dynamic panes), implementing write paths in MSW (or a thin mock layer), and adding the minimal React behaviors that make the 164-control inventory come alive for the highest-frequency daily actions.

Prioritization uses the P0/P1 framing from the full ClickUp feature requirements model (Report D synthesis), mapped specifically against what this emitted clone currently provides (static HTML + read mocks + 8 hardcoded routes for one workspace). Focus ruthlessly on absolute blockers for basic task management workflows first.

### Hierarchy & Nav (P0 for orientation and context)

- **Specific missing capabilities:** No functional workspace picker, no real list/folder creation or reordering, no "Add List" or "Add Folder" that persists in sidebar, no tray/favorites management, no view-type switching that actually loads different data or re-renders rows (only visual tab states simulated in some places). Sidebar tree is pure captured HTML; clicks on non-hijacked items do nothing or fall back. Hierarchy fixtures exist (tree, personal list hierarchy, views, tray) but are read-only snapshots.
- **Why it blocks daily use:** You cannot context-switch between your actual spaces/lists, create a new project area, or reorganize work. Every session starts with the same frozen 90152566819 tree.
- **Evidence from clone:** `clones/clickup-react-2026-06-05/src/pages/AppLayout.tsx` (the massive `__SHELL_HTML` + simulated nav item clicks only toggle `.active` classes; no data mutation); `clones/clickup-react-2026-06-05/src/routes.ts` (hardcoded 8 paths only); `Page90152566819VLLi901523751540PageContent.tsx` etc. (verbatim bodies); `src/fixtures/` (get-hierarchy-v3-experience-sidebar-workspaces-*.json, get-hierarchy-v1-*-*.json, get-hierarchy-v3-experience-workspaces-*.json — all static); no writable handlers in `src/mocks/handlers.ts`.
- **Cross-ref to research:** `docs/research/clickup-parity/build-out-gaps.md` (sidebar/workspace context in parallel functional work); `docs/research/clone-gap-audit.md` (early crawler challenges with 55 viewIds, virtual sidebar, limited early visits); `docs/research/clickup-parity/surface-map/routes.md` and `actions.md` (hundreds of route defs and action surfaces); `docs/research/clickup-export/BACKEND_CONTRACT.md` (hierarchy reads dominant).
- **Rough effort/complexity note:** Medium. Hierarchy fixtures are rich; a thin in-memory tree + MSW write handlers + React sidebar component (replacing or augmenting the verbatim shell slice) would unlock navigation. The shell is aggressive verbatim, so incremental approach (keep chrome HTML, overlay or portal dynamic lists) is likely needed.

### Task Model & CRUD + Custom Fields (Highest P0 daily blocker)

- **Specific missing capabilities:** 
  - No task creation at all (Create task buttons are visual only; no overlay or form that submits and adds a row).
  - No editing of any task field (name, description, status, priority, due, assignee, custom fields).
  - Status pills, priority icons, assignee avatars, subtask counts, labels — all frozen pixels. Clicking does nothing.
  - No delete, no archive, no bulk actions.
  - Custom fields: 43+ definitions captured in fixtures (drop_down, etc., with options, colors, taskStatuses), but no UI to set values on tasks, no rollups/relations/formulas rendered or editable, no CF manager.
  - Task arrays in many fixtures are empty or minimal because the actual rows live in the baked HTML of the Page*Content files.
- **Why it blocks daily use:** This is the core loop of any task manager. Without create/edit/status change/assignee/CF updates, you cannot "do your work" in the app. Every other feature (views, filters, comments) is secondary until this works.
- **Evidence from clone:** All 8 `*PageContent.tsx` files contain identical boilerplate + static captured task rows (no React lists or keys driven by state); `AppLayout.tsx` (only 3 simulated behaviors, none for task rows or create); `handlers.ts` (pure read fixtures; even POSTs like graphql are body-keyed returns of captured data, no side-effect writes); fixtures include `get-customfields-v1-team-90152566819-fields-0.json` (43+), `get-viz-v1-view-*.json` for the views, but task data lives outside the mocks in the DOM snapshot; `API_SPEC.md` confirms 0 WebSocket and mostly GET + read POSTs.
- **Cross-ref to research:** `docs/research/clickup-parity/98-percent-react-parity-workflow.md` (explicit callout of "No real task create/edit that mutates lists (MSW is read-only fixtures or body-branch; no optimistic updates or store sync)"); `docs/research/clone-gap-audit.md` (per-id viz/genericView coverage gaps directly impact task data); `docs/research/clickup-parity/interaction-inventory.md` (Create task, status changes, row interactions are among the 164 controls); `docs/research/clickup-parity/mock-db/coverage.md` (tasks 15 total in one seed, many fixture-filled because rows not in DOM there); `docs/research/clickup-export/BACKEND_CONTRACT.md` (READs easy via export/seed; SIMPLE_WRITE and COMPLEX_LOGIC for mutations).
- **Rough effort/complexity note:** Highest. Requires introducing a live task model (local state or mock-db), making at least one view (List or Board) data-driven (or surgically replacing the task table/kanban body while keeping surrounding chrome), wiring MSW POST/PUT paths that mutate and return consistent shapes, optimistic UI, and re-rendering. The verbatim nature means either (a) keeping HTML for static parts and React for rows, or (b) full component extraction for the dynamic surface. Start narrow: List view create + status change only.

### Views & Interactions (P0 for the 7 exercised surfaces; P1 for full set)

- **Specific missing capabilities:** 
  - Board: Columns visible, cards visible, but no DnD (reorder within column or across), no "Add Task" per column that works, no group by / subtasks / sort / filter that actually changes data (toolbar is pixels), no sizing that persists.
  - List: Frozen rows; no inline editing, no drag-to-reorder, no "Add Task" at top or bottom that appends, no real closed/ assignee / customize toggles that filter.
  - Calendar: Grid visible (but date mismatch risks from capture); no drag events to reschedule, no unscheduled rail interactions, no create on cell.
  - Gantt/Timeline/Grid (Table): Bars/rows visible with dates; no drag/resize of bars, no column show/hide that works, no export, no real add-row.
  - All views share the problem: interaction classes (e.g. draggable) are present from capture, but no backing behavior or data sync.
  - View config (grouping, sorting, filters, columns, row height) is static.
  - Only 3 micro-behaviors across the entire app (tabs in some views, search modal, sidebar active).
- **Why it blocks daily use:** You cannot manipulate your work visually (the primary power of board/gantt/calendar). Switching "views" only changes the frozen picture; it does not let you work differently on the same data.
- **Evidence from clone:** `Page90152566819VB2kyr60132735PageContent.tsx` (Board verbatim), `Page90152566819VC2kyr60132755PageContent.tsx` (Calendar), `Page90152566819VG2kyr60132775PageContent.tsx` (Gantt), `Page90152566819VTl2kyr60132795PageContent.tsx` (Timeline), `Page90152566819VGr2kyr60132815PageContent.tsx` (Grid), `Page90152566819VLLi901523751540PageContent.tsx` (List); `AppLayout.tsx` (simulated tabs only for `[role="tab"]` elements that were captured active; no view-type data reload); handlers only serve the captured view bodies.
- **Cross-ref to research:** `docs/research/clickup-parity/interaction-inventory.md` (164 controls total; list highest density with 17+ clicks, right-clicks on rows, keyboard; board/gantt/calendar have dedicated DnD and toolbar interactions inventoried; 13 surfaces); `docs/research/clickup-parity/interactions/{board,calendar,gantt,list,...}/` (screenshots + txt of per-control expectations); `docs/research/clickup-parity/98-percent-react-parity-workflow.md` ("DnD classes present but no behavior"); `docs/research/clone-gap-audit.md` (early coverage limited to 8/55 viewIds); Report C pipeline limits (webapp target strong for visuals + basic overlay wiring; weak for full DnD behavior, Gantt logic, canvas — "only states captured").
- **Rough effort/complexity note:** High per view. Board and List are highest daily value. Pipeline already captured interaction states; the gap is emitting/running harnesses that turn states into behavior (see future section). For hand work: add local state for cards/rows, implement minimal DnD (react-dnd or HTML5) that mutates the model and re-renders, wire toolbar clicks to filter the model. Keep verbatim shell chrome.

### Data & State (Foundational P0)

- **Specific missing capabilities:** Purely local component state only. No centralized store or mock DB that all routes share. Task/comment/doc data lives in the captured HTML strings, not queryable/mutable fixtures for most surfaces. MSW is read-only (even "write" POSTs return pre-captured bodies keyed by request shape; no actual mutation side effects). No optimistic updates, no invalidation on "write", no persistence across reloads (beyond dev MSW).
- **Why it blocks daily use:** Without a live model, every interaction is one-way visual. Changes cannot propagate (e.g. status change on board should update list and calendar; create should appear everywhere).
- **Evidence from clone:** `src/main.tsx`, `router.tsx`, page components (only useState/useEffect for the 3 simulations and outlet); `src/mocks/handlers.ts` (all handlers are `http.get` / body-matched `http.post` returning imported JSON fixtures; no in-memory db or patch logic visible); `src/fixtures/` (200 JSON files, many empty task arrays or snapshot-only); `API_SPEC.md` ("WebSocket connections: 0").
- **Cross-ref to research:** `docs/research/clickup-parity/98-percent-react-parity-workflow.md` (verbatim + read-only mocks as the core limitation); `docs/research/clickup-export/BACKEND_CONTRACT.md` (READ easy; many COMPLEX_LOGIC for realtime/automations/permissions/search); `docs/research/clickup-parity/mock-db/coverage.md` (seed approach used elsewhere with 213 tasks etc. in latest exports; export feeder + view synth + doc freeze as bridges); `docs/research/clone-gap-audit.md` (105/186 endpoints zero-captured at one point; per-id needed for lists/docs).
- **Rough effort/complexity note:** Medium-high foundational. Introduce a simple mock-db (in-memory or persisted to localStorage) seeded from the rich fixtures + export data. Make handlers that matter (task create/update, view data) delegate to it. Then make the highest-value PageContent data-driven (or extract a React task list component that the verbatim shell can coexist with). The parallel apps/web effort already explored Zustand + seeded export + view synth + mock-db patterns.

### Filters, Search, Sort, Customize (P0 daily comfort)

- **Specific missing capabilities:** Search modal opens and closes (Escape works), but produces no results and does not filter anything. All filter/sort/group/customize controls in toolbars are inert captured HTML. No saved views, no quick filters, no "Closed" toggle that actually hides rows.
- **Why it blocks daily use:** Finding and focusing work is constant. Without working search + filters you fall back to scrolling frozen lists.
- **Evidence from clone:** `AppLayout.tsx` (search modal simulation only toggles display + data attr; no results pane or row filtering logic); page content files (full toolbar markup present but no attached handlers beyond the 3 global sims); no search-specific fixtures wired to dynamic results.
- **Cross-ref to research:** `docs/research/clickup-parity/interaction-inventory.md` (Search ⌘K, Ask AI, filter pills, customize are heavily inventoried clicks/keyboard); `docs/research/clickup-parity/build-out-gaps.md` and `surface-map/actions.md` (global chrome actions dominate the 164).
- **Rough effort/complexity note:** Medium. Once a live task model exists, wire the existing search input to a fuzzy filter over the model and re-render the affected pane. Many toolbar controls can start as no-ops or simple local state toggles that filter the current view's data.

### Communication (Comments, Inbox, Chat, Notifications) (P1)

- **Specific missing capabilities:** Comments fixtures exist for certain views/docs (some non-empty), but no UI to post a new comment, resolve thread, or @mention. No Inbox surface at all (partial in parallel work). Chat rooms visible in fixtures but no sending. Notifications badge may show but no real list or clearing.
- **Why it blocks daily use:** Collaboration and follow-up are daily. Commenting on a task or doc is core.
- **Evidence from clone:** Fixtures like `get-comment-service-v3-workspaces-90152566819-comments-view-2kyr6013-495-0.json`, `get-comments-v1-assignedcomment-*.json`, doc comments (empty in some); visual comment threads in captured doc/list bodies; no write handlers or input fields wired in the Content pages; `AppLayout.tsx` has no comment-specific simulation.
- **Cross-ref to research:** `docs/research/clickup-parity/build-out-gaps.md` (Inbox partial in apps/web); `docs/research/clickup-export/BACKEND_CONTRACT.md` (comments as READ + SIMPLE_WRITE); interaction inventory (right-clicks and clicks on comment surfaces).
- **Rough effort/complexity note:** Medium. Add comment POST handlers that append to an in-memory thread and re-render (or mutate the DOM slice if keeping verbatim). Inbox and chat are lower until core tasks work.

### Docs (Hub + Editor + Pages) (P1, high daily value for many users)

- **Specific missing capabilities:** Only one captured doc (Handbook?) at a deep route (`/v/dc/...`). No Docs hub (All Docs / My Docs / Shared / etc. rail, templates row, table of docs with location/tags/dates). No page tree/outline sidebar inside the doc. No editing (slash menu, blocks, cover/icon, rich collab). Page switching between the 3 pages not exposed. Comments on doc exist in fixtures but inert.
- **Why it blocks daily use:** Many teams live in ClickUp Docs. Without a hub you cannot discover or create docs; without editing you cannot maintain them.
- **Evidence from clone:** Only `Page90152566819VDc2kyr601327152kyr6013715PageContent.tsx` (verbatim single doc body); fixtures include `get-docs-v1-*.json` (document, pages, genericlinks, codox token, counts) but limited and read-only; no docs-hub route or component; `routes.ts` has only the one doc deep-link.
- **Cross-ref to research:** `docs/research/clickup-parity/build-out-gaps.md` (Docs hub MISSING in parallel work; single-doc PARTIAL; page-tree + editing called out); `docs/V2.0/09-crdt-doc-freeze-pattern.md` and `10-cumulative-clickup-clone-state.md` (doc freezer pattern used in replay); `docs/research/clickup-parity/98-percent-react-parity-workflow.md` (docs frequently broken or empty in early clones); `docs/research/clickup-parity/doc/` (per-capture DOM/screenshots).
- **Rough effort/complexity note:** High for full rich editor + collab. Start with docs hub list (use seeded `docs.json` + `doc-pages.json` from exports) + ability to "open" the existing captured doc. Editing is a bigger lift (rich text or bridge to external).

### Dashboards, Goals, Whiteboards, Inbox, Settings, and Broader Surfaces (P1/P2)

- Dashboards: One dashboard fixture (`get-dashboard-2kyr6013-1035-0.json`) + counts; no hub, no widget canvas that updates, no creation.
- Goals: Stub fixture; no surface, no progress rings, no +NEW GOAL.
- Whiteboards/Mindmap/Activity/Workload/Embed/Form/Chat-view: Per-view DOM captures exist in research but zero routes or content pages in this clone.
- Inbox: Visual structure in some chrome but empty or mismatched; no real messages.
- Settings: None (parallel work had PARTIAL inline panel; oracle is modal with many missing sections: Custom Field Manager, Automations, AI, etc.).
- Why blocks: These are the "rest of the app." Once core task CRUD + primary views work, these become the next daily drivers for many users.
- Evidence: Absence from `routes.ts` and `pages/` (only 8 content pages); fixtures have stubs/counts; research explicitly calls them MISSING or PARTIAL in `build-out-gaps.md`, `clone-gap-audit.md`, V2.0/10.
- Effort: Varies — dashboards/widgets medium once model exists; settings large; whiteboards/canvas high (drawing + collab).

### Real-time & Collab (Highest complexity, P2 for basic daily but game-changer)

- Zero WebSocket connections captured or replayed (`API_SPEC.md`: "WebSocket connections: 0"; `mock-socket` dep present in package but 0 usage).
- No presence, live cursors, simultaneous editing, live comment streams, task updates from other "users".
- Blocks advanced daily use and any multi-person feel.
- Evidence: Capture pipeline + API_SPEC; Report C (realtime beyond frame replay is a known pipeline weak area).
- Cross-ref: `docs/research/clickup-export/BACKEND_CONTRACT.md`, `docs/V2.0/09-crdt-doc-freeze-pattern.md`, `docs/research/clickup-parity/chat/`.
- Effort: High (requires mock-socket or similar replay + optimistic + conflict resolution modeling). Not for initial daily driver.

### Search/Hotkeys/Filters/Attachments/Embeds/Perf (P0/P1 polish)

- Command palette / global hotkeys beyond basic Escape on search: missing or inert.
- Attachments: Visual in captured tasks/docs; no upload or preview flows wired.
- Embeds: Similar.
- Perf/scale: Clone is small captured workspace; no virtualization (rows are DOM), no partial loads, no large-list handling.
- Cross-ref: interaction-inventory (keyboard 18 total), surface-map.

**Minimal Usable Daily Driver Checklist**

Items that, once implemented, would let the user actually run their real work inside the clone (prioritized order):

1. **Live task model** (in-memory or localStorage-backed) seeded from fixtures + any export data. Shared across routes.
2. **List view** (or Board as alternative first): data-driven rows (replace or augment the static HTML table/kanban body), working "Create task" (opens simple form or inline, persists via MSW write, appears in list).
3. **Basic mutations that re-render**: Change status (click pill or dropdown → updates model + UI in current view and ideally across views), edit title inline or in a minimal task detail slide-in, assign (at least self), set due date.
4. **Working filters/search on the live model**: Search modal actually filters the current view's rows; toolbar "Closed"/assignee/group toggles filter/sort the data.
5. **Minimal DnD on at least one view** (Board columns or List reorder) that updates the model and persists visually.
6. **Task detail** (click row → opens a modal or pane with the captured visual structure + editable fields for the above mutations).
7. **Comments on tasks** (post new comment via input in detail or list; appears in thread; uses existing comment fixtures shape).
8. **View switching that feels live** (clicking view tabs in sidebar or global actually loads the same underlying task model into the target view representation — List vs Board vs Calendar — even if config is minimal at first).
9. **Basic hierarchy affordance** (at least one "Add List" or "New Task in list" from sidebar that creates and selects it).
10. **Persistence + reload safety** (changes survive dev reload; MSW or model can be reset to seed).

Once the above are done (even crudely), the clone crosses the threshold from "reference I look at" to "tool I can use daily and keep tweaking." Everything else (full custom fields, advanced views, docs hub, realtime, automations, full 164 controls, dashboards, settings depth) is high-value follow-on.

---

## 4. Future / Absolute Improvements (Game-Changers for the Platform)

After the must-haves above are in place for this specific clone, these are the higher-P2/P3 items plus architectural wins that turn a "good daily driver scaffold" into a full platform replacement or powerful reverse-engineering lab. Grouped for planning.

### Core Productivity Power Features
- Full custom field power: All types rendered and editable (including formulas, rollups, relations, progress, automatic, etc.); CF manager UI for creating/editing field defs at workspace level; values drive filtering, grouping, dashboards, and reports.
- Advanced views to full fidelity: Mind Map (full interactive), Whiteboard (canvas drawing + objects + collab), Workload, Activity feed with real filters, Form builder + submissions, Embed views, Chat-view surfaces.
- Hierarchy depth: Full drag-reorg of spaces/folders/lists/tasks, permissions-aware sharing, templates, archiving, bulk moves.
- Time tracking full (entries, reports, billable, approvals) + Goals (with progress, milestones, folders, archiving) + reporting.
- Attachments/embeds rich: Upload, preview, link tasks/docs, rich link unfurling inside descriptions/comments.
- View config depth: Per-view saved configs, personal vs shared views, custom columns, row heights, swimlanes, etc. that persist.

### Collaboration & Realtime
- Full realtime collab: WebSocket (or mock-socket) replay + optimistic updates + presence (avatars, cursors, "user X is editing"), conflict resolution.
- CRDT or equivalent for rich docs + whiteboard + comments (live multi-user editing without locks).
- Inbox / notifications / @mentions with real clearing, snooze, follow-up, and cross-surface propagation.
- Guest / public share links, form embeds that accept real submissions (with ACL).

### Intelligence (AI / Automations / Forms)
- Visual automations builder + execution engine (triggers, actions, conditions, filters; history).
- AI features: Ask AI surface that actually calls (mocked) intelligence, AI agents, notetaker, meeting bot, content generation inside docs/tasks, recent prompts.
- Forms: Full builder, submissions, routing, automations on submit.
- AI usage / entitlements surfacing and limits.

### Polish & Scale
- Performance at real scale: Virtualization for thousands of tasks/rows, partial/paginated loads, incremental sync, optimistic + background reconciliation.
- Offline + sync: Service worker that queues writes, conflict UI, background refresh.
- Mobile / responsive parity + touch-optimized interactions (the capture was desktop-heavy).
- Command palette depth (⌘K everywhere, with actions, search, navigation, recent, AI).
- Full hotkey coverage (the 18 keyboard interactions in the inventory).
- Settings / Admin depth: Real modal (vs inline), all sections (General, Custom Field Manager, Automations Manager, AI Notetaker, Spaces, Work Schedule, Imports/Exports, ClickUp API, Email, App Center, Audit Logs, Trash, Billing, Security, 2FA, Theme/Appearance, Roles/Permissions, Teams), real logout/upgrade.
- Multi-workspace + real auth flows + guest/pending invites (current clone is single hardcoded workspace).

### Extensibility & Ecosystem
- Export / import roundtrips (tasks, docs, views, custom fields, automations) so the clone can be a real daily driver with backup/restore.
- Public forms + rich embeds that third parties can interact with.
- API surface exposure (the ClickUp API settings + tokens) so power users can script against their own clone.
- Template center + marketplace-like flows.

### Pipeline-Level Future Improvements (Benefits This Clone + All Future Work)
These are not changes to the emitted clone itself but enhancements to dr-parity that would make ClickUp-like (and other) clones dramatically better and faster to bring to daily-usable state:
- Deeper inference: 1-hop toggles are good; extend to multi-hop state machines, form submissions, and full interaction graphs from DOM diff + network + rrweb traces.
- rrweb / fiber archaeology + component archaeology: Move beyond verbatim bodies toward synthesized React components that still match pixel-perfect but are editable and data-driven by construction.
- Better DnD / canvas harnesses: Capture not just states but the actual drag sequences, pointer paths, and resulting mutations so the emitter can generate working `useDrag` / Konva / etc. code instead of requiring hand implementation.
- Live contract inference: While crawling, synthesize writable MSW handlers + in-memory model shapes automatically (instead of read-only fixtures).
- Unified functional + visual dual output: Option to emit both the verbatim high-fidelity shell (for parity inspection) *and* a parallel data-driven React implementation (seeded from the same fixtures/export) in one run, with a parity harness that diffs screenshots + behavior.
- View synth + doc freeze + mock-db feeder as first-class reusable artifacts: Make the "export feeder + view synth + doc freeze" patterns (already used to enrich data) automatic and per-capture.
- Exhaustive coverage tooling: Guided per-id capture modes, blocklist-aware deep crawls, and automatic "replay until N% of 55 view types succeed" loops.
- Animation / third-party lib salvage that is more robust and less rescue-CSS dependent.
- Multi-route + same-origin link following in a single capture pass (currently multi-page cloning needs separate captures).

These pipeline advances directly accelerate the hand-tweaking phase for this clone and every future one.

---

## 5. Cross-References & Sources

Key research docs and clone files (with brief relevance). Use these as the living reference set while tweaking.

**Clone under audit (read-only source of truth for current state):**
- `clones/clickup-react-2026-06-05/src/pages/AppLayout.tsx` — global shell, outlet portal, the 3 simulated micro-behaviors, aggressive `<a>` hijacking, embedded `__SHELL_HTML`.
- `clones/clickup-react-2026-06-05/src/pages/Page*.tsx` (9 files: AppLayout + 8 *Content) — identical boilerplate + verbatim captured bodies for My Work + List/VLLi, Board/VB, Calendar/VC, Gantt/VG, Timeline/VTl, Grid/VGr, Doc/VDc.
- `clones/clickup-react-2026-06-05/src/routes.ts` — the 8 hardcoded routes + workspace IDs.
- `clones/clickup-react-2026-06-05/src/mocks/handlers.ts` — ~159 MSW handlers (auto-generated).
- `clones/clickup-react-2026-06-05/src/fixtures/` — 200 JSON files (read-only, body-keyed for many).
- `clones/clickup-react-2026-06-05/API_SPEC.md` — 158 endpoints, 206 calls, 0 WebSockets, per-endpoint samples.
- `clones/clickup-react-2026-06-05/package.json`, `vite.config.ts`, `README.md` — tech stack and run instructions.
- `clones/clickup-react-2026-06-05/public/_ext/` — full mirrored assets.
- `clones/clickup-react-2026-06-05/index.html` — SPA shell.

**Research & prior ClickUp effort (for context, gaps, and evolution):**
- `docs/research/clickup-parity/build-out-gaps.md` — prioritized gaps from parallel functional clone (Dashboards, Goals, Docs hub, Settings, Doc improvements, Inbox, Calendar); excellent for "what else the broader effort identified as remaining."
- `docs/research/clickup-parity/98-percent-react-parity-workflow.md` — philosophy, limitations of verbatim + read-only, dual-output thinking, coverage-driven capture.
- `docs/research/clone-gap-audit.md` (and `.json`) — concrete render scoreboard (14/37 destinations), root cause (missing per-id viz/genericView), gap inventory by impact.
- `docs/research/clickup-parity/interaction-inventory.md` (and `.json`) — 164 controls across 13 surfaces; list highest; global chrome heavy. The definitive "what must eventually work" checklist.
- `docs/research/clickup-parity/interactions/{board,calendar,gantt,list,...}/` — per-control screenshots and expectations.
- `docs/research/clickup-parity/mock-db/coverage.md` — entity counts from seed (tasks, custom fields 43, docs/pages, etc.); shows what a richer seeded approach looks like.
- `docs/research/clickup-export/BACKEND_CONTRACT.md` (and `.json`) — READ vs SIMPLE_WRITE vs COMPLEX_LOGIC classification; 118+ endpoints; guidance on what is "easy" to mock vs requires real logic.
- `docs/research/clickup-parity/surface-map/{INDEX.md,routes.md,actions.md,endpoints.md}` — 450 route defs, 27 observed nav patterns; action surfaces; full endpoint map from bundle + runtime.
- `docs/V2.0/10-cumulative-clickup-clone-state.md` (and surrounding V2.0 series, especially 09-crdt-doc-freeze, 05a-reconciled-plan, 08-clickup-failure-attribution) — historical cumulative state, doc freezer, pipeline lessons.
- `docs/research/clickup-parity/seed/` and `docs/research/clickup-export/*/ (tasks.json, custom-fields.json, tree.json, docs.json, doc-pages.json, etc.)` — richer export data that can seed the clone beyond pure capture fixtures.
- Per-view captures under `docs/research/clickup-parity/{list,board,...}/` and `docs/research/captures/` — DOM, screenshots, viewports for oracle comparison.
- `docs/research/clickup-parity/chat/`, `dashboard/`, `doc/`, `whiteboard/`, etc. — specific surface deep dives.
- `docs/research/INSPECTION_GUIDE.md`, `docs/CLONE-RUN-GUIDE.md`, `docs/ROADMAP.md` — operational and high-level context.
- `docs/blocklists/clickup.txt` — crawler blocklist (useful if re-capturing for more coverage).
- `docs/parity-issues/INDEX.md` and `docs/architecture/` — known issues and backend blueprints.

**How to evolve this audit:**
- Append new sections or update tables under each domain as you implement (e.g., after "Minimal Daily Driver Checklist item 2 is done", mark it complete with date and notes).
- Add a "Session Log" subsection at the bottom if desired (or keep that in your personal notes).
- When coverage or fixtures expand, update the Appendix tables.
- Re-run targeted reads of the clone files after significant hand edits to refresh the "Evidence from clone" bullets.
- Cross-link new artifacts you create (e.g., a `docs/clickup-react-clone/TASK-MODEL.md` or seed file) back into the relevant domain.

---

## 6. Appendix (Quick Reference Tables)

### Current Routes vs Full ClickUp Route Surface

**In this clone (`clones/clickup-react-2026-06-05/src/routes.ts`):**
- `/90152566819/my-work`
- `/90152566819/v/l/li/901523751540` (List)
- `/90152566819/v/b/2kyr6013-2735` (Board)
- `/90152566819/v/c/2kyr6013-2755` (Calendar)
- `/90152566819/v/g/2kyr6013-2775` (Gantt)
- `/90152566819/v/tl/2kyr6013-2795` (Timeline)
- `/90152566819/v/gr/2kyr6013-2815` (Grid)
- `/90152566819/v/dc/2kyr6013-2715/2kyr6013-715` (Doc)

Plus the layout shell. All tied to workspace 90152566819. My Work reuses list-like content.

**Full ClickUp surface (from research):**
- Bundle route definitions: **450**
- Observed navigation patterns during crawls: **27**
- Real-world surfaces exercised in deep captures: 13+ (List, Board, Calendar, Gantt, Timeline, Table/Grid, Doc, Dashboard, Mind Map, Whiteboard, Workload, Activity, Form, Embed, Chat, Inbox, Goals, Settings, Teams, AI surfaces, etc.)
- Many more view types per list (the clone captured 7 specific view IDs; a typical workspace has many more + personal "My Work" variants).
- Hubs and chrome surfaces (Dashboards, Goals, Docs hub, full Settings modal, Inbox, etc.) are separate from per-view routes.

The clone covers a useful "core 8" slice of one workspace. Expanding to more view IDs, the docs hub, dashboards hub, and settings is the natural next route surface work.

### Fixture Coverage Summary (High Level from the ~200 Files + API_SPEC)

- **Endpoints covered:** 158 (API_SPEC); 159 handler registrations in `handlers.ts`.
- **Total fixtures:** 200 JSON files under `src/fixtures/`.
- **Strong coverage areas (from fixture names + API_SPEC samples + research cross-ref):**
  - Hierarchy: sidebar tree, workspaces, views, personal list hierarchy, tray, categories/subcategories, project features (multiple get-hierarchy-*).
  - Custom fields: 43+ (`get-customfields-v1-team-90152566819-fields-0.json` + taskStatuses + v2/field).
  - Users / profiles / members / roles / permissions.
  - View data: `get-viz-v1-view-*.json` for the 7 captured views + my-tasks static widget; some genericView/GraphQL POSTs body-keyed.
  - Dashboards: counts (multiple), one full dashboard (`2kyr6013-1035`), location overview.
  - Docs: document, pages (limited), generic links (back/external), counts, codox access token, one doc comments.
  - Chat: rooms delta, settings, canonical bulk.
  - Comments: assigned, view-specific, doc-specific, last-read, search, parents bulk, scheduled.
  - Goals: stub (`get-goals-v1-team-90152566819-goal-0.json`).
  - Time/scheduling: time entries (current/recent/tags), workweek schedules, holidays.
  - Automation / AI / entitlements: agents, triggers usage, workflow counts, AI usage, recent prompts, plans, billing rules.
  - Notifications, approvals, clips, emojis, baselines, growth/onboarding configs, etc.
  - Many POSTs for search/bulk (body-keyed to return captured).
- **Weak / snapshot-only areas:**
  - Task arrays frequently empty or minimal in fixtures (rows live in the baked HTML of the PageContent files).
  - No rich task properties populated for most rows.
  - 0 WebSocket / realtime fixtures or handlers.
  - Many per-id or per-list resources only captured for the exercised views (see clone-gap-audit for the 105/186 zero-captured historical stat).
  - Write paths exist only as shape-matched readers, not mutators.
- **Research contrast:** The `docs/research/clickup-parity/mock-db/coverage.md` (from a seed/export effort) shows a different richer snapshot (e.g. 15 tasks, 43 customFields, 1 goal, 1 doc + 3 pages). The react clone fixtures are capture-derived and heavier on config/hierarchy than on live task rows. Export data + seed manifests are the bridge used in other efforts to make data rich.

### Interaction Simulation vs Full 164-Control Inventory

**In this clone:** Only 3 simulated micro-behaviors (all in `AppLayout.tsx` post-mount effect):
1. Tab active state toggling (`[role="tab"]` elements; adds/removes `active` + `aria-selected` + mangles `_active` class variants).
2. Search modal: open on toggle click, close on backdrop or Escape (sets `display` + `data-dr-parity-search-open` attr; no actual search execution or results).
3. Sidebar nav items (`cu-simple-bar .cu-simple-bar__item`): click sets `active` + `cu-simple-bar__item_active` on one, removes from others.

Everything else is frozen captured markup:
- All DnD affordances (draggable classes, handles).
- Status pills, kebabs, create buttons, filter/sort/group toolbars.
- Row clicks, context menus (right-click inventory is large).
- Task detail, modals beyond search, forms, column add, etc.
- Most keyboard (beyond Escape on search) and hover states.

**Full inventory (`docs/research/clickup-parity/interaction-inventory.md`):**
- **Totals:** 164 distinct controls (82 click, 61 right-click, 18 keyboard, 3 hover).
- **By surface (distinct controls; list highest):**
  - List: highest (Report B cites 29; inventory sample showed ~20 + keyboard/hover; heavy on row interactions, create, global chrome).
  - Board, Gantt, Timeline, Calendar, Table/Grid: 6–10 each (DnD, toolbars, add-group/task).
  - Docs, Inbox, My Tasks, Dashboards, Goals, Profile, Overview: 4–11 each.
  - Global chrome dominates many rows (workspace picker, Search ⌘K, Ask AI, Create task, Track Time, Create Doc/Whiteboard, Record Clip, dropdowns).
- Right-clicks are heavily represented (context menus on rows, sidebar items, etc.).
- The 3 simulations in the clone cover only a tiny sliver of the global chrome "active state" maintenance. The bulk of the 164 (especially anything that should mutate data or change view content) remain visual-only.

This gap is expected and by design for a first-paint + tour verbatim clone. The inventory is the long-term "must make work" map.

---

**End of audit.** Keep this document open while tweaking. Append updates as you go. The scaffold is strong; the gaps are clear and prioritized. You have everything needed to turn it into a daily driver incrementally.
