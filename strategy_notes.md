# DR Parity: ClickUp Clone Architecture & Strategy (Locked)

This document serves as the ground-truth blueprint for achieving 1:1 parity when cloning ClickUp. It incorporates the architectural constraints of an Angular Shell + React Island (`cu-react-app`), Rolldown bundler, and Redux state management.

---

## The 4-Phase Pipeline

### Phase 1: Static Surface Map & Unbundling (Wakaru)
**Tool:** `pionxzh/wakaru`
Because ClickUp uses Rolldown (Vite's Rust bundler), standard decompilers fail. 
- Run Wakaru to unpack the ES modules.
- **Goal:** We are not just extracting logic; we are extracting the **Static Surface Map**. We need the exact routing table, API endpoint strings, and Redux action constants. This provides a definitive list of pages and actions to drive the crawler in Phase 3, eliminating guesswork.

### Phase 2: The Data Blueprint (Redux + Network Interception)
**Constraint:** ClickUp uses Redux (`useSelector`), meaning React Fiber `memoizedProps` do not hold the actual data models.
- **Network Intercept:** Script Playwright to listen to `**/api/v2/**` and `**/api/v3/**`, capturing all responses into a `mock_db.json`.
- **Redux State:** Tap into `window.__REDUX_DEVTOOLS_EXTENSION__` or the store instance to dump `getState()` per view. This provides the hydrated entity shapes the UI actually renders from.

### Phase 3: Exhaustive State Discovery (Seeded Workspace)
To get true parity, the crawler cannot just "left-click". ClickUp relies on keyboard shortcuts, right-clicks, and drag-and-drop.
- **Environment:** Run against a **Dedicated Seeded Workspace** with known spaces/lists/tasks/comments so states are reproducible without destroying real data.
- **Harness:** Run an exhaustive BFS script capturing `click`, `contextmenu` (right-click), `hover`, and keyboard shortcuts. 
- **Safeguards:** Implement aggressive throttling and a checkpoint/resume system to avoid rate limits and crashes.
- **Isolation Pattern:**
  - `/shell/`: Capture the Topbar and Sidebar *once* using Playwright locators.
  - `/views/`: Hide the shell (`display: none`) before capturing the List/Board views to prevent duplicated UI code.
  - `/shared-modals/`: Capture modals using dynamic naming based on `aria-label` or `innerText`.

### Phase 4: Exact-Structure React + Real CSS (Synthesis)
**Constraint:** "Clean React" and "100% Pixel Parity" cannot coexist when using an enterprise 5MB CSS file. The CSS cascade relies on exact wrapper `<div>` ancestry.
- **The Decision:** We abandon Tailwind approximations. We will use **Exact-Structure React**.
- **Execution:** We will use ClickUp's *real* stylesheets. The Vision LLM must generate React components that perfectly mirror the original, dense, messy DOM structure and real class names (`class="cu-task-row"`).
- **Baseline Rule:** The initial reference capture (`state-0001`) must be a **Targeted Clean Recapture**. The crawler must run a "Sanity Reset" to explicitly close all chat panels, tooltips, and sidebars before capturing the baseline, to prevent garbage UI leaking into the final code.
