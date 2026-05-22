<!-- AUTO-GENERATED from AGENTS.md — do not edit directly.
     Run `bash scripts/sync-agent-rules.sh` to regenerate. -->

# Dr Parity. 1:1 Website Cloning Engine

## What This Is
A dedicated engine for reverse-engineering any website or web app into a pixel-perfect cloned codebase. Dr Parity uses an automated Playwright CLI extraction pipeline. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run for anomalies during capture. No browser MCP is used anywhere.

## Engine Pipeline
The `/clone-website` skill orchestrates a multi-phase pipeline:
1. **Capture**. Playwright CLI launches Chromium, navigates the target, records HAR plus trace plus video, and runs a programmatic scroll and hover tour to wake lazy content and animations.
2. **Parse**. The captured HAR or manual network log is parsed into per-document HTML, deduplicated styles, scripts, and assets.
3. **Clone**. A static 1:1 snapshot is produced by rewriting every captured URL to a local clone-relative path.
4. **Build**. Target adapters (`astro`, `react`, `webapp`) slice the captured DOM into framework code via deterministic emitters under `engine/targets/`.
5. **Verify**. The verify subsystem (`engine/verify/`) drives a parity gate by screenshotting clone vs original and reporting diffs.

## Tech Stack
- **Language:** TypeScript strict mode, executed via `tsx`.
- **Extraction:** Playwright CLI (`@playwright/test`), Chromium only.
- **Target emitters:** custom emitters under `engine/targets/astro`, `engine/targets/react`, `engine/targets/webapp`, plus the shared slicer under `engine/targets/shared/`.
- **Verify:** `engine/verify/` (screenshots, diff, report).
- **No app framework in this repo.** Dr Parity emits cloned codebases as output. The repo itself is a CLI engine, not a Next.js or Astro app.

## Commands

The real entry points are npm scripts wired in `package.json`. The pipeline scripts below are the ones that actually run today.

- `npm run capture -- <url>`. Capture a target with Playwright. Modes: `launch` (default), `cdp`, `persistent`.
- `npm run parse:har -- <capture-dir>`. Parse the captured HAR or manual network log.
- `npm run parse:trace -- <capture-dir>`. Unzip the Playwright trace and emit DOM snapshots.
- `npm run clone -- <capture-dir>`. Rewrite the captured HTML and CSS into a self-contained static clone.
- `npm run clone-site -- <url>`. End-to-end orchestrator. Runs capture, parse:har, parse:trace, and clone in one pass.
- `npm run clone-urls -- --target=react --clone-dir=<dir>:/route`. Multi-route emit into a target framework.
- `npm run build:astro -- --clone-dir=<dir>`. Astro target build.
- `npm run build:react -- --clone-dir=<dir>`. React target build.
- `npm run build:webapp -- --crawl-dir=<dir>`. Webapp target build (uses crawl output).
- `npm run verify:parity`. Run the parity verifier.
- `npm run typecheck`. `tsc --noEmit` across the repo.

## Code Style
- TypeScript strict mode, no `any`.
- Named exports. PascalCase for components, camelCase for utilities.
- 2-space indentation.
- Many small files over few large files.

## Design Principles
- **Pixel-perfect emulation.** Match the target's spacing, colors, typography, and animations exactly.
- **No personal aesthetic changes during emulation.** Match 1:1 first.
- **Real content.** Use actual text and assets from the target, not placeholders.
- **Beauty-first.** Every pixel matters.

## Project Structure

```
engine/
  extract/          # Playwright CLI browser strategies (launch / cdp / persistent),
                    # viewports, recording options, network recorder, tour pass.
  analyze/          # Topology, design tokens, component tree.
  targets/          # Target adapters and emitters.
    shared/         # Slicer and shared types used by every target.
    astro/          # Astro emitter.
    react/          # React emitter.
    webapp/         # Webapp emitter, crawler, inference.
    html-mirror/    # Static HTML mirror target.
  orchestrator/     # Phase runner and post-build hooks.
  clone/            # Static HTML / CSS / asset rewriters used by the clone step.
  verify/           # Screenshots, diff, report, parity gate.
  scope-styles/     # Style scoping and media-preserve.
  generate/         # Component generation utilities.
  qa/               # Legacy QA helpers. Slated for cleanup in V2.0.
scripts/            # CLI entry points wired into package.json.
docs/
  research/         # Inspection output (per-host captures, design tokens, layout).
  V2.0/             # V2.0 audit, action plan, observations.
  blocklists/       # Per-app crawler blocklists.
clones/             # Gitignored scratch space for clone output.
```

## MOST IMPORTANT NOTES
- When launching Claude Code agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving any merge conflicts smartly since you are basically serving the orchestrator role and have full context to our goals, work given, work achieved, and desired outcomes.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- After editing `.claude/skills/clone-website/SKILL.md`, run `node scripts/sync-skills.mjs` to regenerate the skill for all platforms.

# Website Inspection Guide

## How to Reverse-Engineer Any Website

This guide outlines what to capture when inspecting a target website via the Playwright CLI capture pipeline or browser DevTools. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run and notes anomalies as they appear. No browser MCP is used.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Every distinct page at desktop, tablet, and mobile widths
- [ ] Dark mode variants (if applicable)
- [ ] Light mode variants (if applicable)
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Loading and skeleton states
- [ ] Empty states
- [ ] Error states

### Design Tokens to Extract
- [ ] **Colors.** Background, text (primary, secondary, muted), accent, border, hover, error, success, warning.
- [ ] **Typography.** Font family, sizes (h1 through h6, body, caption, label), weights, line heights, letter spacing.
- [ ] **Spacing.** Padding and margin patterns. Look for a scale (4px, 8px, 12px, 16px, 24px, 32px, and so on).
- [ ] **Border radius.** Buttons, cards, avatars, inputs.
- [ ] **Shadows and elevation.** Card shadows, dropdown shadows, modal overlay.
- [ ] **Breakpoints.** When does the layout shift? Inspect with DevTools responsive mode.
- [ ] **Icons.** Which icon library? Custom SVGs? Sizes?
- [ ] **Avatars.** Sizes, shapes, fallback behavior.
- [ ] **Buttons.** All variants (primary, secondary, ghost, icon only, danger).
- [ ] **Inputs.** Text fields, textareas, selects, checkboxes, toggles.

## Phase 2: Component Inventory

For each distinct UI component, document:
1. **Name.** What would you call this component?
2. **Structure.** What HTML elements or child components does it contain?
3. **Variants.** Does it have different sizes, colors, or states?
4. **States.** Default, hover, active, disabled, loading, error, empty.
5. **Responsive behavior.** How does it change at different breakpoints?
6. **Interactions.** Click, hover, focus, keyboard navigation.
7. **Animations.** Transitions, entrance and exit animations, micro interactions.

### Common Components to Look For
- Navigation (top bar, sidebar, bottom bar)
- Cards and list items
- Buttons and links
- Forms and inputs
- Modals and dialogs
- Dropdowns and menus
- Tabs and segmented controls
- Avatars and user badges
- Loading skeletons
- Toast notifications
- Tooltips and popovers

## Phase 3: Layout Architecture

- [ ] **Grid system.** CSS Grid? Flexbox? Fixed widths?
- [ ] **Column layout.** How many columns at each breakpoint?
- [ ] **Max width.** Main content area maximum width.
- [ ] **Sticky elements.** Header, sidebar, floating buttons.
- [ ] **Z index layers.** Navigation, modals, tooltips, overlays.
- [ ] **Scroll behavior.** Infinite scroll, pagination, virtual scrolling.

## Phase 4: Technical Stack Analysis

- [ ] **Framework.** React? Vue? Angular? Check `__NEXT_DATA__`, `__NUXT__`, `ng-version`.
- [ ] **CSS approach.** Tailwind (utility classes), CSS Modules, Styled Components, Emotion, vanilla CSS.
- [ ] **State management.** Redux (check DevTools), React Query, Zustand, Pinia.
- [ ] **API patterns.** REST or GraphQL. Check the network tab for `/graphql` requests.
- [ ] **Font loading.** Google Fonts, self hosted, system fonts.
- [ ] **Image strategy.** CDN, lazy loading, srcset, WebP or AVIF.
- [ ] **Animation library.** Framer Motion, GSAP, CSS transitions only.

## Phase 5: Documentation Output

After inspection, create these files in `docs/research/`:
1. `DESIGN_TOKENS.md`. All extracted colors, typography, spacing.
2. `COMPONENT_INVENTORY.md`. Every component with structure notes.
3. `LAYOUT_ARCHITECTURE.md`. Page layouts, grid system, responsive behavior.
4. `INTERACTION_PATTERNS.md`. Animations, transitions, hover states.
5. `TECH_STACK_ANALYSIS.md`. What the site uses and our chosen equivalents.
