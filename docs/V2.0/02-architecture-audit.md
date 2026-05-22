# Dr Parity V2.0 — Architecture Audit

> Read-only mapping of the repo as of `prototype-mode` branch, 2026-05-22.
> Agent 2 of 4. Scope: folder structure, what's active vs legacy, split-identity tensions, target abstraction consistency.

---

## TL;DR

Dr Parity is no longer a Next.js app. It is a **TypeScript CLI engine** (Node 24 + tsx + Playwright) that ingests a URL and emits a self-contained static or framework project into `clones/`. The runtime dependency tree contains **zero Next.js, React, Tailwind, or shadcn/ui packages** (see `package.json` lines 76-99). Yet the *documentation, Dockerfiles, README, AGENTS.md, GEMINI.md, and every `clone-website` skill file across `.claude/`, `.cursor/`, `.amazonq/`, etc.* still describe the project as "a Next.js + shadcn/ui scaffold that gets cloned into."

This is the central split-identity problem. Almost every architectural tension in the repo descends from it.

Counts:
- ~58 root-level files (configs, docs, dotfiles)
- 254 `.ts` files under `engine/`
- 56 scripts under `scripts/`
- 14 top-level engine subsystems
- 4 framework targets emitted (`astro`, `react`, `webapp`, `html-mirror`) under `engine/targets/`
- 9+ AI tool integration folders (`.claude`, `.cursor`, `.codex`, `.amazonq`, `.augment`, `.continue`, `.opencode`, `.gemini`, `.windsurf`, `.github/skills`, `.aider.conf.yml`, `.clinerules`, `.windsurfrules`)

---

## 1. Annotated Repo Tree

Legend:
- ACTIVE = referenced by `package.json` scripts or imported by something that is
- LEGACY = artefact of the old Next.js identity, no longer used
- DORMANT = code exists, no caller found in current pipeline, may have been mid-implementation
- UNCLEAR = needs Cameron's input
- TRANSIENT = working scratch / regenerable output

```
dr-parity/
|
|-- AGENTS.md                            UNCLEAR    Claims Next.js 16 + shadcn/ui, contradicts package.json
|-- CLAUDE.md (-> AGENTS.md)             ACTIVE     Synced from AGENTS.md
|-- GEMINI.md (-> AGENTS.md)             ACTIVE     Synced from AGENTS.md
|-- README.md                            LEGACY     Claims "Next.js-based cloning engine" - false
|-- CHANGELOG.md                         ACTIVE     Last entry 2026-03-29 (predates a lot of engine work)
|-- LICENSE                              ACTIVE     MIT
|-- package.json                         ACTIVE     43 npm scripts, all `tsx scripts/*.ts`. No `next`, no `react`, no `tailwind`
|-- tsconfig.json                        ACTIVE     Strict, `@engine/*` path alias, excludes `clones/`
|-- playwright.config.ts                 DORMANT    Default config but NO `playwright test` script in package.json
|-- dr-parity-primitives.config.ts       ACTIVE     Imported by extract-primitives flow
|-- .nvmrc                               ACTIVE     Node baseline
|-- .gitignore                           ACTIVE     Critical: excludes clones/, .next/, src dirs, captures/
|-- .gitattributes                       ACTIVE
|-- features.md                          ACTIVE-ish Brand extraction spec doc - looks like a reference, not code
|-- docs/suggestededits.md               ACTIVE     Running discovery log
|-- docs/ROADMAP.md                      STALE      Says "26 engine files, 11062 lines" - actual is 254 files
|
|-- Dockerfile                           LEGACY     Multi-stage Next.js standalone build, references `next build`
|-- Dockerfile.dev                       LEGACY     `npm run dev` (which doesn't exist in package.json)
|-- docker-compose.yml                   LEGACY     `NEXT_TELEMETRY_DISABLED`, healthcheck hits :3000
|-- .dockerignore                        LEGACY     Tied to the dead Docker setup
|
|-- .github/
|   |-- workflows/ci.yml                 BROKEN     Calls `npm run lint` and `npm run build` - neither exists in package.json
|   |-- copilot-instructions.md          ACTIVE     Synced from AGENTS.md
|   |-- copilot-setup-steps.yml          UNCLEAR
|   |-- PULL_REQUEST_TEMPLATE.md         ACTIVE
|   |-- ISSUE_TEMPLATE/                  ACTIVE     bug_report, feature_request, config
|   `-- skills/clone-website/SKILL.md    LEGACY     Says "Next.js + shadcn/ui + Tailwind v4 scaffold must already be in place"
|
|-- src/                                 ABSENT     Listed in AGENTS.md and README.md but DOES NOT EXIST on disk. Dead reference.
|-- public/                              ABSENT     Same - referenced in docs, does not exist
|
|-- engine/                              ACTIVE     The real product. 254 TypeScript files.
|   |
|   |-- types/                           ACTIVE     Shared engine-wide types (extraction, component, diff)
|   |-- utils/progress.ts                ACTIVE     Shared progress reporter
|   |
|   |-- extract/                         ACTIVE     Phase 1 of pipeline
|   |   |-- browser/                     ACTIVE     `cdp-attach.ts`, `viewports.ts` - mode strategy + viewport list
|   |   |-- capture/                     ACTIVE     `tour.ts`, `recording.ts`, `network-recorder.ts`, `lazy-load-pass.ts`
|   |   |-- playwright/                  MIXED      `page-scanner`, `font-extractor`, `animation-detector`, `asset-collector`, `interaction-mapper`, `stylesheet-scraper` - imported only by `scripts/extract.ts` and `scripts/extract-multi.ts`, neither of which is in package.json
|   |   |-- chrome-mcp/                  EMPTY      Only `.gitkeep` - documented in skills but never implemented
|   |   |-- cache.ts                     UNCLEAR    No imports found from active scripts
|   |   |-- checkpoint.ts                UNCLEAR    No imports found from active scripts
|   |   |-- merge.ts                     DORMANT    Imported only by extract-multi.ts (non-pipeline)
|   |   |-- multi-page.ts                DORMANT    Imported only by extract-multi.ts (non-pipeline)
|   |   `-- site-crawler.ts              ACTIVE     Imported by clone-site.ts (this IS the multi-page entry)
|   |
|   |-- analyze/                         MIXED      Phase 2 of pipeline
|   |   |-- topology.ts                  ACTIVE     Used by generate-astro, generate-prototype
|   |   |-- design-tokens.ts             ACTIVE     Used by generate-astro, generate-prototype
|   |   |-- component-tree.ts            ACTIVE     Used by generate-astro, generate-prototype
|   |   |-- behavior-model.ts            DORMANT    No import found from any script
|   |   `-- css/                         ACTIVE     parser, colors, typography, spacing - used by extract-css.ts
|   |
|   |-- generate/                        MIXED      Phase 3 of pipeline
|   |   |-- prototype/                   ACTIVE     `scripts/generate-prototype.ts` entry, has __fixtures__
|   |   |-- astro/                       ACTIVE     `scripts/generate-astro.ts` entry, has __fixtures__
|   |   |-- component-gen.ts             DORMANT    Old API, no script imports it
|   |   |-- page-assembler.ts            DORMANT    Old API
|   |   |-- foundation.ts                DORMANT    Old API
|   |   |-- builder-prompts.ts           DORMANT    Old API
|   |   `-- templates/                   DORMANT    Old API
|   |
|   |-- clone/                           ACTIVE     Static 1:1 snapshot rewriter (css-rewriter, asset-copier, url-map, html-rewriter)
|   |
|   |-- qa/                              DORMANT    Phase 4/5 of pipeline
|   |   |-- screenshotter.ts             DORMANT    Imported only by scripts/qa.ts (not in package.json)
|   |   |-- pixel-diff.ts                DORMANT    Same
|   |   |-- section-comparator.ts        DORMANT    Imported only by scripts/qa-sections.ts (not in package.json)
|   |   |-- fix-loop.ts                  DORMANT
|   |   |-- hover-tester.ts              DORMANT
|   |   |-- dom-comparator.ts            DORMANT
|   |   |-- content-masker.ts            DORMANT
|   |   |-- asset-waiter.ts              DORMANT
|   |   `-- parity-check.ts              DORMANT
|   |
|   |-- verify/                          ACTIVE     Replacement for qa/ - `scripts/verify-parity.ts`, viewport-by-viewport diff
|   |   `-- ports.ts, screenshots.ts, diff.ts, report.ts, render.ts, types.ts
|   |
|   |-- tests/                           ACTIVE     `multi-viewport-parity.spec.ts`, `multi-viewport-parity-react.spec.ts` (npm scripts test:parity:*)
|   |   `-- out/                         TRANSIENT  Diff artifacts checked into git? (see RISK below)
|   |
|   |-- targets/                         ACTIVE     The framework adapter system - cleanest part of the engine
|   |   |-- types.ts                     ACTIVE     `TargetAdapter` contract (build, buildMulti)
|   |   |-- shared/                      ACTIVE     find-landmarks, slice-body, extract-head, asset-copy, paths, slug
|   |   |-- astro/                       ACTIVE     Implements TargetAdapter (build + buildMulti)
|   |   |-- react/                       ACTIVE     Implements TargetAdapter (build + buildMulti)
|   |   |-- webapp/                      ACTIVE     Implements TargetAdapter (build only, multi documented as Phase 2)
|   |   |   |-- crawler/                 ACTIVE     blocklist, route-budget, signature-scan, state-capture, nav/interactive-discovery
|   |   |   |-- inference/               ACTIVE     classify-toggle, detect-dismiss, dom-diff, build-groups
|   |   |   |-- detect-libs/             ACTIVE     Pattern-matches Swiper, dnd-kit, headlessui, etc.
|   |   |   |-- emit-libs/               ACTIVE     .tsx.tpl wrappers per library
|   |   |   |-- emit-mocks/              ACTIVE     MSW handler generation
|   |   |   |-- emit-realtime/           ACTIVE     WebSocket fixture emission
|   |   |   |-- emit-stateful/           ACTIVE     React state hook injection
|   |   |   |-- emit-assets/             ACTIVE     Asset extraction from trace
|   |   |   |-- form-capture/            ACTIVE     Used by scripts/capture-form-states.ts
|   |   |   `-- scaffold/                ACTIVE     package.json, vite.config, tsconfig, msw-setup, router-stub templates
|   |   `-- html-mirror/                 ACTIVE     `scripts/build-html-mirror.ts` - the 4th target, NOT yet a `TargetAdapter`
|   |
|   |-- orchestrator/                    ACTIVE     `phases.ts`, `run-phase.ts`, `snapshot.ts`, `report.ts` + post-build/{emit-only,post-emit-multi}
|   |-- iconify/                         ACTIVE     discover, normalise, emit, name - SVG -> icon component pipeline
|   |-- animations/                      ACTIVE     parser, classify, detect, emit
|   |-- tokens/                          ACTIVE     Design-token pipeline (validate, name, emit-css, emit-ts, emit-map)
|   |-- primitives/                      ACTIVE     Component primitive mapping (Button, Heading, etc.) via dr-parity-primitives.config.ts
|   |-- scope-styles/                    ACTIVE     index-rules, index-components, assign, substitute, emit, media-preserve
|   |-- refactor/                        ACTIVE     walk, swap-icons, swap-primitives, frontmatter, prettify, load-maps, post-process
|   |-- library/                         ACTIVE     extract-library entry (Krevio component library extraction)
|   `-- playbook/                        ACTIVE     generate-edit-playbook
|
|-- scripts/                             MIXED      56 CLI files, 43 wired into package.json
|   |
|   |-- ACTIVE (in package.json):
|   |   capture.ts                       ACTIVE     `npm run capture`
|   |   parse-har.ts                     ACTIVE     `npm run parse:har`
|   |   parse-trace.ts                   ACTIVE     `npm run parse:trace`
|   |   clone.ts                         ACTIVE     `npm run clone`
|   |   clone-site.ts                    ACTIVE     `npm run clone-site` (multi-page orchestrator)
|   |   clone-urls.ts                    ACTIVE     `npm run clone-urls` / `build:react:multi` / `build:astro:multi`
|   |   clone-page.ts                    ACTIVE     `npm run clone-page`
|   |   run-clone.ts                     ACTIVE     `npm run clone-end-to-end`
|   |   build.ts                         ACTIVE     `npm run build:astro|react|webapp` - dispatches via TargetAdapter
|   |   build-astro.ts                   UNCLEAR    Separate from build.ts? Two ways to build astro
|   |   crawl-webapp.ts                  ACTIVE     `npm run crawl:webapp`
|   |   capture-form-states.ts           ACTIVE     `npm run capture:forms`
|   |   complete-assets.ts               ACTIVE     `npm run complete:assets`
|   |   extract-css.ts                   ACTIVE     `npm run extract:css`
|   |   extract-primitives.ts            ACTIVE     `npm run extract:primitives`
|   |   extract-tokens.ts                ACTIVE     `npm run extract:tokens`
|   |   extract-animations.ts            ACTIVE     `npm run extract:animations`
|   |   extract-library.ts               ACTIVE     `npm run extract:library`
|   |   generate-prototype.ts            ACTIVE     `npm run generate:prototype`
|   |   generate-astro.ts                ACTIVE     `npm run generate:astro`
|   |   generate-edit-playbook.ts        ACTIVE     `npm run generate:edit-playbook`
|   |   check-html-rewriter.ts           ACTIVE     `npm run check:html-rewriter`
|   |   check-astro-emit.ts              ACTIVE     `npm run check:astro-emit`
|   |   check-refactor.ts                ACTIVE     `npm run check:refactor`
|   |   check-scope-styles.ts            ACTIVE     `npm run check:scope-styles`
|   |   check-prettify.ts                ACTIVE     `npm run check:prettify`
|   |   iconify-svgs.ts                  ACTIVE     `npm run iconify:svgs`
|   |   verify-parity.ts                 ACTIVE     `npm run verify:parity`
|   |   scope-styles.ts                  ACTIVE     `npm run scope:styles`
|   |   centralize-content.ts            ACTIVE     `npm run centralize:content`
|   |   refactor-sections.ts             ACTIVE     `npm run refactor:sections`
|   |   rebuild-pro.ts                   ACTIVE     `npm run rebuild-pro`
|   |   audit-capture.ts                 ACTIVE     `npm run audit:shell|plan|execute|capture`
|   |   sync-skills.mjs                  ACTIVE     Tooling - sync skills across AI integrations
|   |   sync-agent-rules.sh              ACTIVE     Tooling - sync AGENTS.md to platform files
|   |
|   |-- DORMANT (no package.json entry, no import found):
|   |   extract.ts                       DORMANT    Old Phase-1 entry. Referenced only by clone-website skill docs and ROADMAP
|   |   extract-multi.ts                 DORMANT    Same
|   |   qa.ts                            DORMANT    Old QA entry. Replaced by verify-parity.ts
|   |   qa-sections.ts                   DORMANT    Same
|   |   download-assets.mjs              DORMANT    Old Next.js-era asset downloader
|   |   build-html-mirror.ts             ACTIVE-ish Imports engine/targets/html-mirror but no npm script (manual `tsx` run)
|   |
|   |-- ONE-OFF / TARGET-SPECIFIC (probable):
|   |   seo-backfill.mts                 ONE-OFF    Hardcoded path `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY`
|   |   login-omni.ts                    ONE-OFF    Omnisocials-specific login profile setup
|   |   auth-verify.ts                   ONE-OFF    Defaults to app.omnisocials.com
|   |   inspect-live.ts                  ONE-OFF    Hardcoded localhost:5173 + Krevio-specific selectors
|   |   inspect-selector-resolution.ts   ONE-OFF    Likely Krevio-debug
|   |   verify-clone.ts                  ONE-OFF
|   |   verify-interactions.ts           ONE-OFF
|   |   verify-key-clicks.ts             ONE-OFF
|   |   verify-key-clicks-v2.ts          ONE-OFF    v2 of above - dead v1?
|   |   verify-posts-menu.ts             ONE-OFF    Omnisocials posts menu
|   |   verify-tabs-and-toasts.ts        ONE-OFF
|   |   verify-toast.ts                  ONE-OFF
|   |   recapture-routes.ts              UNCLEAR    Looks reusable but no npm script
|   |   emit-only.ts                     UNCLEAR    Thin wrapper, called by rebuild-pro?
|   |
|   `-- .gitkeep                         ACTIVE
|
|-- docs/                                MIXED
|   |-- ROADMAP.md                       STALE      Stats reference 26 engine files (now 254)
|   |-- suggestededits.md                ACTIVE     Discovery log
|   |-- research/                        TRANSIENT  All .gitignored except INSPECTION_GUIDE.md
|   |   |-- INSPECTION_GUIDE.md          ACTIVE     Referenced from AGENTS.md via `@`
|   |   |-- captures/                    TRANSIENT  Capture pipeline output dir (gitignored)
|   |   |-- enerblock/                   TRANSIENT  Old per-site capture (gitignored)
|   |   `-- example-test/                TRANSIENT  Old example capture (gitignored)
|   |-- design-references/.gitkeep       LEGACY     From Next.js scaffold era
|   |-- animations/.gitkeep              LEGACY     From Next.js scaffold era
|   |-- docs/research/prompts/           BUG        `docs/docs/` - clearly a path bug. Should be `docs/research/prompts/`. Gitignored anyway
|   `-- blocklists/                      ACTIVE     `omnisocials.txt`, `omnisocials-phase1.txt` - per-app crawler blocklists
|
|-- clones/                              TRANSIENT  Working scratch space (gitignored except .gitkeep)
|   `-- app.omnisocials.com-*/           TRANSIENT  ~7000+ files including a nested node_modules. Should have been moved out
|
|-- .claude/                             ACTIVE
|   |-- skills/clone-website/SKILL.md    LEGACY     Says `npm run build` (doesn't exist) and "Next.js + shadcn/ui + Tailwind v4 scaffold must already be in place"
|   |-- skills/playwright-cli/           ACTIVE     Cameron's global Playwright skill (gitignored)
|   |-- commands/clone-website.md        ACTIVE     Generated by sync-skills
|   |-- settings.local.json              GITIGNORED
|   `-- .DS_Store                        NOISE
|
|-- AI tool integrations:
|   .amazonq/cli-agents/clone-website.json       ACTIVE     Generated
|   .amazonq/rules/project.md                    ACTIVE     Generated
|   .augment/commands/clone-website.md           ACTIVE     Generated
|   .continue/rules/project.md                   ACTIVE     Generated
|   .continue/commands/clone-website.md          ACTIVE     Generated
|   .codex/skills/clone-website/SKILL.md         ACTIVE     Generated
|   .cursor/commands/clone-website.md            ACTIVE     Generated
|   .cursor/rules/project.mdc                    ACTIVE     Generated
|   .gemini/commands/clone-website.toml          ACTIVE     Generated
|   .opencode/commands/clone-website.md          ACTIVE     Generated
|   .windsurf/workflows/clone-website.md         ACTIVE     Generated
|   .aider.conf.yml                              UNCLEAR
|   .clinerules                                  UNCLEAR
|   .windsurfrules                               UNCLEAR
|
`-- (mentioned in brief, NOT FOUND on disk):
    auto-probe.mjs                       ABSENT
    full-diag.mjs                        ABSENT
    test-login.mjs                       ABSENT
    bugs.md                              ABSENT
    NEXT.md                              ABSENT
    SMOKE_TEST_DIFF.txt                  ABSENT
```

---

## 2. The Three Biggest Split-Identity Problems

### 2.1 The "we are a Next.js app" lie that nothing enforces

**Symptom**: AGENTS.md (line 21), README.md (lines 7, 33), `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `.github/workflows/ci.yml`, and every `clone-website` skill across `.claude/`, `.cursor/`, `.amazonq/`, `.augment/`, `.continue/`, `.opencode/`, `.codex/`, `.windsurf/`, `.gemini/`, `.github/skills/` all describe the project as "Next.js 16 + React 19 + shadcn/ui + Tailwind v4."

**Reality**: `package.json` has zero of those packages. The only runtime dep is `postcss`. Dev deps are Playwright + cheerio + babel + pixelmatch + tsx. The CI calls `npm run lint` and `npm run build` — **neither exists in package.json**. The Dockerfile runs `next build`. `src/` and `public/` are documented as project folders but **do not exist on disk**.

**Why it matters**: Every new contributor (human or LLM agent) reads AGENTS.md, expects `src/app/`, finds nothing, and either invents one or routes work into the wrong place. The skill files instruct agents to "verify the Next.js + shadcn/ui scaffold is in place" before doing anything — an instruction that can never succeed.

**Files implicated**:
- `AGENTS.md` lines 21-25, 47-72
- `README.md` lines 7, 31-37, 41-49
- `Dockerfile` (entire file)
- `Dockerfile.dev` (entire file)
- `docker-compose.yml` (entire file)
- `.github/workflows/ci.yml` lines 30-37
- All `*/clone-website*` files across 9 AI tool integration folders
- `.gitignore` lines 7-9, 12-18 (still references `.next/`, `clone-prototype/`, `clone-astro/`)

### 2.2 Two parallel pipelines: "capture-and-emit" (real) vs "extract-analyze-generate" (legacy)

**Symptom**: There are two distinct, non-overlapping pipelines in the codebase, each with its own set of files.

| Concept | Old pipeline (legacy) | New pipeline (real) |
|---|---|---|
| Phase 1 entry | `scripts/extract.ts`, `scripts/extract-multi.ts` | `scripts/capture.ts` |
| Phase 1 engine | `engine/extract/playwright/*` (page-scanner, animation-detector, asset-collector, font-extractor, interaction-mapper, stylesheet-scraper) | `engine/extract/browser/*`, `engine/extract/capture/*`, `engine/extract/site-crawler.ts` |
| Phase 2 | `engine/analyze/` (topology, design-tokens, component-tree, behavior-model) | `engine/clone/*` + per-target `engine/targets/<x>/inference/` |
| Phase 3 | `engine/generate/` (component-gen, page-assembler, foundation, builder-prompts, templates) | `engine/generate/prototype/`, `engine/generate/astro/`, `engine/targets/<x>/emit*` |
| Phase 4 (QA) | `engine/qa/*` (screenshotter, pixel-diff, fix-loop, section-comparator, hover-tester) called by `scripts/qa.ts`, `scripts/qa-sections.ts` | `engine/verify/*` called by `scripts/verify-parity.ts` |
| Multi-page | `engine/extract/multi-page.ts`, `merge.ts` | `engine/extract/site-crawler.ts` |

The old pipeline is referenced by AGENTS.md, every skill file, ROADMAP.md, and the README. It compiles. It has no `package.json` script. Nobody calls it. The new pipeline is the one `clone-site` / `run-clone` / `build` actually run.

**Why it matters**: A new contributor following the docs (or `/clone-website` skill) will hit "extract -> analyze -> generate -> QA -> iterate" steps that map to dead code. The actual pipeline is "capture -> parse:har -> parse:trace -> clone -> build:<target> -> verify:parity".

### 2.3 `src/` and `public/` are documented project folders but only exist *inside* generated clones

**Symptom**: `AGENTS.md` lines 47-72 and `README.md` lines 41-49 describe `src/app/`, `src/components/`, `src/lib/`, `public/images/`, `public/videos/`, `public/seo/` as part of the project structure. None of these directories exist on disk in the repo root (verified via Glob).

`src/` does live inside *each* generated clone (e.g. `clones/app.omnisocials.com-*/src/`). Those are emitted by the target adapters, not part of the engine.

**Why it matters**: The docs conflate "the engine repo" with "what the engine emits." An agent reading AGENTS.md may try to write components into `<repo>/src/components/` when the engine actually emits them into `<clones>/<host>/src/components/`. This is the "seed app vs cloning engine" confusion mentioned in the brief, but in stronger form: the seed app doesn't exist at all anymore.

---

## 3. Obvious Deletes for V2.0

| Path | Reason |
|---|---|
| `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `.dockerignore` | All assume `next build` / `npm run dev`. No Next.js in repo. No service to dockerise — the engine is a CLI. |
| `.github/workflows/ci.yml` (current contents) | Calls `npm run lint` and `npm run build` which do not exist. Must be rewritten for `npm run typecheck` only. |
| `scripts/extract.ts`, `scripts/extract-multi.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`, `scripts/download-assets.mjs` | Legacy phase-1 / phase-4 entries with no `npm run` mapping and no callers. Replaced by `capture` / `verify-parity`. |
| `engine/qa/*` (entire folder, except possibly `parity-check.ts`) | Replaced by `engine/verify/`. Every file imported only by the dormant `scripts/qa*.ts`. |
| `engine/generate/component-gen.ts`, `page-assembler.ts`, `foundation.ts`, `builder-prompts.ts`, `templates/` | Old generation API. No script imports them. Replaced by `engine/generate/prototype/` and `engine/generate/astro/`. |
| `engine/analyze/behavior-model.ts` | No imports from active scripts. Behavior modelling now lives per-target under `engine/targets/<x>/inference/`. |
| `engine/extract/multi-page.ts`, `engine/extract/merge.ts`, `engine/extract/cache.ts`, `engine/extract/checkpoint.ts` | Only consumed by the dormant `extract-multi.ts`. |
| `engine/extract/chrome-mcp/` | Only contains `.gitkeep`. Documented in skills as "Chrome MCP visual intelligence" but never implemented. |
| `engine/extract/playwright/` (entire folder) | Imported only by `scripts/extract.ts` and `scripts/extract-multi.ts`, both dormant. Functionality replaced by `engine/extract/capture/`. **VERIFY** by Cameron — some font/asset extraction logic may still be reused. |
| `docs/docs/research/prompts/` | Path bug (`docs/docs/`). Gitignored. Move to `docs/research/prompts/` or delete entirely. |
| `docs/design-references/.gitkeep`, `docs/animations/.gitkeep` | Empty folders from the Next.js scaffold era. |
| `scripts/seo-backfill.mts` | Hardcoded user-specific path `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY`. One-off backfill, work is done. |
| `scripts/inspect-live.ts`, `inspect-selector-resolution.ts`, `login-omni.ts`, `auth-verify.ts`, `verify-clone.ts`, `verify-interactions.ts`, `verify-key-clicks.ts`, `verify-key-clicks-v2.ts`, `verify-posts-menu.ts`, `verify-tabs-and-toasts.ts`, `verify-toast.ts` | All omnisocials or Krevio specific. Hardcoded URLs, hardcoded selectors. Belong in `docs/blocklists/`-style per-app folders, not in shared `scripts/`. |
| README.md | Rewrite from scratch. The current one is 100% wrong about the tech stack. |

Conservative replacements (don't delete, rewrite):
- `AGENTS.md` — strip Next.js claims, document the real CLI pipeline
- `docs/ROADMAP.md` — counts are 10x off
- All `*/clone-website*` skill files — regenerate from a corrected SKILL.md via `sync-skills.mjs`

---

## 4. Files / Folders That Need Cameron's Input (Ambiguous)

| Path | Question |
|---|---|
| `engine/extract/playwright/*` | Is any of this still in use, or is it 100% superseded by `engine/extract/capture/` and `engine/extract/browser/`? `font-extractor`, `animation-detector`, and `asset-collector` look like they have logic worth porting. |
| `scripts/build-astro.ts` vs `scripts/build.ts --target=astro` | Two entry points to the same thing. Is `build-astro.ts` legacy, or does it differ? |
| `scripts/recapture-routes.ts` | Imports from `engine/targets/webapp/crawler`, reusable-looking, but no `npm run` entry. Add a script or delete? |
| `scripts/emit-only.ts` | Thin CLI wrapper around `engine/orchestrator/post-build/emit-only.ts`. Is this still the failure-recovery path, or is it covered by `rebuild-pro`? |
| `playwright.config.ts` | Default config, no `playwright test` script in package.json. Used implicitly by tsx? Or dead? |
| `engine/tests/out/` | Looks like test output artifacts. Are these checked into git? If yes, they shouldn't be. |
| `features.md` | Long brand-extraction spec. Is this the spec for `extract:tokens` / `extract:primitives`? If so, move to `docs/specs/`. |
| `engine/library/` | Krevio-specific component-library extraction. Should this be `engine/targets/library/` (a 5th target) or stay as a general engine module? |
| `engine/targets/html-mirror/` | Has `index.ts` exporting `buildHtmlMirror` but doesn't implement `TargetAdapter` and isn't in `scripts/build.ts`'s `TargetName` union. Is it a 4th target or a sibling concept? |
| `.aider.conf.yml`, `.clinerules`, `.windsurfrules` | Three stray AI integration files at root. Generated? Hand-written? Still in use? |
| `scripts/audit-capture.ts` | Has 4 npm scripts (`audit:shell|plan|execute|capture`). What does this audit, and is it the same kind of audit as this V2.0 effort? |

---

## 5. "Where Does a New Target Plug In?" — Adding a Hypothetical `nuxt` Target

Tracing what an agent (or contributor) would need to change to add a new framework target. This is the test for how cleanly the architecture has been factored.

### Step 1: Implement the adapter
Create `engine/targets/nuxt/` with the same shape as `engine/targets/astro/` and `engine/targets/react/`:

- `engine/targets/nuxt/index.ts` — export a `nuxtAdapter: TargetAdapter`
- `engine/targets/nuxt/build.ts` — single-page `buildNuxtProject(options): Promise<BuildSummary>`
- `engine/targets/nuxt/build-multi.ts` (optional) — `buildNuxtMulti(options): Promise<MultiBuildSummary>`
- `engine/targets/nuxt/emit.ts` — `writeComponent`, `writePage`, etc.
- `engine/targets/nuxt/scaffold.ts` — `writeScaffold`, `writePackageJson`, `writeNuxtConfig`, `writeTsConfig`, etc.
- `engine/targets/nuxt/types.ts` — `ComponentDef`, `BuildOptions`, `BuildSummary` (re-use shared types where possible)
- `engine/targets/nuxt/emit-multi.ts` (optional)

The `TargetAdapter` contract at `engine/targets/types.ts:64-73` is the only required surface:
```ts
export interface TargetAdapter {
  name: 'astro' | 'react' | 'webapp';
  build(options: TargetBuildOptions): Promise<TargetBuildSummary>;
  buildMulti?(options: TargetMultiBuildOptions): Promise<TargetMultiBuildSummary>;
}
```

### Step 2: Wire the adapter into the dispatcher
**Edit `scripts/build.ts`:**
- Line 28: extend `type TargetName = 'astro' | 'react' | 'webapp'` to include `'nuxt'`
- Add the dynamic import branch that loads `../engine/targets/nuxt` and calls `nuxtAdapter.build(...)`

**Edit `scripts/clone-urls.ts`:** (line 43-45)
- Add `import { nuxtAdapter } from '../engine/targets/nuxt';`
- Wire it into the target dispatch

### Step 3: Add npm scripts
**Edit `package.json`:**
- `"build:nuxt": "tsx scripts/build.ts --target=nuxt"`
- `"build:nuxt:multi": "tsx scripts/clone-urls.ts --target=nuxt"`
- (optionally `test:parity:nuxt`)

### Step 4: Update the `TargetAdapter.name` union type
**Edit `engine/targets/types.ts:65`:**
- Change `name: 'astro' | 'react' | 'webapp'` to also include `'nuxt'`.
- (Note: this is a leaky contract — see Issue below.)

### Step 5: Optional — extend orchestrator
If the new target needs post-emit hooks:
- `engine/orchestrator/post-build/post-emit-multi-nuxt.ts` (mirror of `post-emit-multi-react.ts`)
- Wire it into `scripts/build.ts` and `scripts/clone-urls.ts`

### Step 6: Documentation surface that must be updated
- `AGENTS.md` — currently lies about Next.js being the only target
- `README.md` — needs target list
- 9+ AI tool integration `clone-website` skill files — regenerate via `sync-skills.mjs` after editing `.claude/skills/clone-website/SKILL.md`
- `docs/ROADMAP.md` — has no notion of multiple targets

### Friction points discovered
1. **`TargetAdapter.name` is a string-literal union, not a string.** Adding a new target requires editing the shared types file — couples adding a target to changing core engine types.
2. **No target registry.** Every script that dispatches by target name does its own `if/else` chain. `scripts/build.ts:28`, `scripts/clone-urls.ts:43-45`, `scripts/run-clone.ts`, `scripts/clone-site.ts` all hard-code the target list independently.
3. **`engine/targets/html-mirror/` already shows the seam.** It exists as a sibling of astro/react/webapp but is not a `TargetAdapter`. So there's a precedent for "things that emit but bypass the contract."
4. **Shared scaffolding is incomplete.** `engine/targets/shared/` has `paths`, `slug`, `extract-head`, `slice-body`, `asset-copy`, `find-landmarks` — but not a `Scaffold` interface. Each target implements its own scaffold-writing convention.
5. **No formal "what does it mean to be a target" doc.** A new contributor would have to reverse-engineer `astro/index.ts` + `react/index.ts` + `webapp/index.ts` to find the conventions.

### How many places require changes for one new target: **6** (engine target folder, `scripts/build.ts`, `scripts/clone-urls.ts`, `package.json`, `engine/targets/types.ts`, the skill docs).
If the target is multi-page or needs post-emit, add 1-2 more.

---

## 6. Target Abstraction — Is It Consistent?

**Verdict: largely consistent across `astro`, `react`, `webapp`, with one known asymmetry. `html-mirror` is outside the contract.**

### What's consistent (good)
- All three define a `<target>Adapter: TargetAdapter` value in `engine/targets/<target>/index.ts`
- All three implement `build(options: TargetBuildOptions): Promise<TargetBuildSummary>`
- All three derive a default project name from `manifest.json -> documentUrl -> hostname` via the same `deriveDefaultName` helper (duplicated, not shared — see "what's inconsistent")
- All three accept `cloneDir`, `outDir`, `name`, `force`
- All three return `{ outDir, componentsEmitted, pagesEmitted, assetCount, assetBytes }`
- All three re-export their public API from `index.ts` with the same shape (`writeScaffold`, `writePackageJson`, `writeTsConfig`, etc.)
- Shared utilities live in `engine/targets/shared/` (`extract-head.ts`, `slice-body.ts`, `find-landmarks.ts`, `asset-copy.ts`, `paths.ts`, `slug.ts`, `types.ts`) and all three targets import from there.

### What's inconsistent (needs attention in V2.0)
1. **`buildMulti` is optional.** `astro` and `react` implement it. `webapp` does not (docstring at `engine/targets/webapp/index.ts:6-9` says "Phase 2"). This is honest and correct, but means scripts that want multi-page must `if (adapter.buildMulti)` everywhere.
2. **`deriveDefaultName` is duplicated.** Identical 18-line function in `astro/index.ts:57-76`, `react/index.ts:71-90`, `webapp/index.ts:87-106`. Should live in `engine/targets/shared/`.
3. **`TargetBuildOptions` is leaky.** Webapp needs a `crawlDir` field that isn't on the shared type — `webapp/index.ts:117` casts via `(options as { crawlDir?: string }).crawlDir`. This is a smell: either `crawlDir` is universal (add to shared) or there should be a target-specific options extension mechanism.
4. **`TargetAdapter.name` union (`engine/targets/types.ts:65`)** hard-codes the three target names. Should be `string` with a runtime check, or a generic type parameter.
5. **Webapp target has 12 subfolders** (crawler/, inference/, detect-libs/, emit-libs/, emit-mocks/, emit-realtime/, emit-stateful/, emit-assets/, form-capture/, scaffold/) while astro and react have ~6 files at the same level. The webapp target is doing significantly more work — but it isn't documented as a different *kind* of target. This may deserve a sub-contract (e.g. `WebappAdapter extends TargetAdapter`).
6. **`html-mirror/` is the canary.** It lives in `engine/targets/`, has `index.ts` exporting a `buildHtmlMirror` function, but doesn't conform to `TargetAdapter`. It's invoked by `scripts/build-html-mirror.ts` directly. Either lift it into the contract or move it out of `engine/targets/`.
7. **`engine/library/`** is target-shaped (extract-react-build, render-section-preview, write-catalogue, bundle-dist) but lives outside `engine/targets/`. Possibly a 5th target, possibly a different concept (a library *consumes* extracted clones rather than producing one). Worth deciding in V2.0.

### Where the contract lives
- The interface: `engine/targets/types.ts` (74 lines, clean)
- The shared helpers: `engine/targets/shared/` (8 files)
- The dispatcher: `scripts/build.ts`

### Suggested V2.0 reorg signal
The target abstraction is the **healthiest part of the engine** and should be the model for the V2.0 layout. The split between `engine/<phase>/` (extract, analyze, generate, qa) and `engine/targets/<target>/` should be sharpened: phase code does target-agnostic work on captured artifacts, target code does framework-specific emission. A few files (`engine/clone/`, `engine/iconify/`, `engine/animations/`, `engine/tokens/`, `engine/primitives/`, `engine/scope-styles/`, `engine/refactor/`, `engine/verify/`) currently sit at the top of `engine/` as siblings of `extract`/`analyze`/`generate`/`qa` — which suggests the phase-based grouping has already started to dissolve. V2.0 should either commit to phases or commit to subsystems.

---

## 7. Summary Risk List for V2.0 Planning

1. **Documentation lies about the tech stack** — touches AGENTS.md, README.md, every AI tool integration file. Single biggest source of confusion for new contributors and agents.
2. **CI is broken** — `.github/workflows/ci.yml` runs scripts that don't exist. Either nobody pushes to master, or CI fails silently.
3. **Two parallel pipelines coexist** — dormant `extract.ts`/`qa.ts` and active `capture.ts`/`verify-parity.ts`. Dead code is still referenced from skills.
4. **`scripts/` is unsorted** — 56 files, 43 wired into npm, 13 ad-hoc one-offs (some target-specific, some hardcoded user paths). No subfolder structure.
5. **`docs/docs/research/prompts/` path bug** exists on disk.
6. **`engine/tests/out/` artifacts** may be checked in (verify with `git ls-files`).
7. **Target contract leaks** — `crawlDir` cast on webapp, `name` string-literal union, `deriveDefaultName` triplicated.
8. **`html-mirror/` and `library/`** are target-shaped but outside the contract.
9. **Cloned outputs leak into the repo** — `clones/app.omnisocials.com-*/node_modules/` has thousands of files in a gitignored dir that should have been moved out per the AGENTS.md instruction.
10. **Docker / docker-compose / Dockerfile.dev** are pure legacy.

End of audit.

---

## Round 2: Follow-up Answers

### A. Safety pass on the "obvious deletes" list

Grep run across the whole repo (no path exclusions). For each candidate I list code-level inbound references separately from doc-level references, then a verdict. Anything mentioned only in `docs/V2.0/*` (this audit series) is filtered out because those are about-to-delete-it references, not active callers.

#### A.1 `Dockerfile`
- Inbound code/config refs: **2**
  - `docker-compose.yml:5` — `dockerfile: Dockerfile` (builds the `app` service)
  - `.dockerignore:52` — listed for self-exclusion from build context
- Inbound doc refs: 0 outside the audit docs
- **Verdict: SAFE TO DELETE** (paired with `docker-compose.yml` + `.dockerignore`). No script or CI step references it. The `next build` command inside it cannot succeed because Next.js is not a dependency.

#### A.2 `Dockerfile.dev`
- Inbound code/config refs: **2**
  - `docker-compose.yml:30` — `dockerfile: Dockerfile.dev` (builds the `dev` service)
  - `.dockerignore:52` — wildcard `Dockerfile` rule covers it
- **Verdict: SAFE TO DELETE.** Runs `npm run dev`, which is not in `package.json`. Cannot start.

#### A.3 `docker-compose.yml`
- Inbound code/config refs: **0** (no `make`, no script, no `npm run` calls `docker compose`).
- Inbound doc refs: 0 outside audit docs.
- **Verdict: SAFE TO DELETE.** Healthcheck hits `:3000` for a Next.js server that does not exist.

#### A.4 `.dockerignore`
- Inbound code/config refs: 0. It is consumed only by `docker build`, which is no longer used.
- **Verdict: SAFE TO DELETE** in the same commit as the three above.

#### A.5 `engine/qa/` (whole subtree) — REVISED FINDING
The original audit marked the whole folder DORMANT. That was wrong. Re-grepping:
- `engine/qa/parity-check.ts` is imported by `scripts/clone-urls.ts:465` via `await import('../engine/qa/parity-check')` and is invoked as a hard parity gate (`scripts/clone-urls.ts:469`). `runParityCheck` is the active, in-pipeline parity harness for `clone-urls`/`build:astro:multi`/`build:react:multi`. **STILL ACTIVE — DO NOT DELETE.**
- `engine/qa/screenshotter.ts`, `engine/qa/pixel-diff.ts`, `engine/qa/content-masker.ts` — imported only by `scripts/qa.ts` (dormant, not in `package.json`). **SAFE TO DELETE** with `scripts/qa.ts`.
- `engine/qa/section-comparator.ts`, `engine/qa/hover-tester.ts`, `engine/qa/dom-comparator.ts` — imported only by `scripts/qa-sections.ts` (dormant). **SAFE TO DELETE** with `scripts/qa-sections.ts`.
- `engine/qa/fix-loop.ts`, `engine/qa/asset-waiter.ts` — zero inbound code imports. Referenced only by the seven `clone-website` skill files (`.claude`, `.codex`, `.github`, `.windsurf`, `.opencode`, `.gemini`, `.augment`, `.continue`, `.cursor` — same generated text). **NEEDS DOC UPDATE FIRST** then SAFE TO DELETE.
- **Folder verdict:** Do not blanket-delete `engine/qa/`. Move `parity-check.ts` out (proposal: `engine/verify/parity-check.ts` so the whole `verify/` subsystem is one folder) and delete the rest.

#### A.6 `scripts/extract.ts`
- Inbound code refs: 0 (no `import` resolves to it).
- Inbound doc refs: 8 (every generated `clone-website` skill across `.claude`, `.codex`, `.augment`, `.continue`, `.cursor`, `.gemini`, `.opencode`, `.windsurf`, `.github/skills`) plus `docs/ROADMAP.md:238/248/258/268/278/304` and `docs/V2.0/01-pipeline-audit.md` (audit).
- Inbound code/config inside `package.json`: 0.
- **Verdict: NEEDS DOC UPDATE FIRST.** Once the seven skill files and `docs/ROADMAP.md` are regenerated to point at `parity capture` / `parity build`, SAFE TO DELETE.

#### A.7 `scripts/extract-multi.ts`
- Inbound code refs: 0.
- Inbound doc refs: 1 (`docs/V2.0/01-pipeline-audit.md:540`, audit).
- Inbound config refs: 0.
- **Verdict: SAFE TO DELETE.** No doc updates needed beyond the audit it self-references.

#### A.8 `scripts/qa.ts`
- Inbound code refs: 0.
- Inbound doc refs: 8 skill files (same set as A.6), `docs/ROADMAP.md:228`, plus this audit.
- **Verdict: NEEDS DOC UPDATE FIRST.** Same skill-regeneration step as `scripts/extract.ts`.

#### A.9 `scripts/qa-sections.ts`
- Inbound code refs: 0.
- Inbound doc refs: 1 (`docs/ROADMAP.md:228`).
- **Verdict: SAFE TO DELETE** after one ROADMAP edit.

#### A.10 `scripts/download-assets.mjs`
- Inbound code refs: 0.
- Inbound doc refs: 1 (`docs/V2.0/01-pipeline-audit.md`, audit only).
- Inbound config refs: 0.
- **Verdict: SAFE TO DELETE.** It hardcodes terminal-industries URLs and is finished work.

#### A.11 `docs/docs/research/prompts/`
- Inbound code refs: 0.
- Inbound doc refs: 0 (it's a path bug, not a referenced folder).
- Gitignored.
- **Verdict: SAFE TO DELETE.** No PRs needed.

#### A.12 Additions on second look (also delete)

| Path | Refs | Verdict |
|---|---|---|
| `engine/extract/playwright/` (whole folder) | Only `scripts/extract.ts` + `scripts/extract-multi.ts` import it | NEEDS DOC UPDATE FIRST (port any salvageable logic from `font-extractor.ts`/`asset-collector.ts` into `engine/extract/capture/`), then SAFE TO DELETE |
| `engine/extract/multi-page.ts`, `engine/extract/merge.ts`, `engine/extract/cache.ts`, `engine/extract/checkpoint.ts` | Only `scripts/extract-multi.ts` | SAFE TO DELETE alongside `extract-multi.ts` |
| `engine/extract/chrome-mcp/` | Only contains `.gitkeep`. Referenced in skill files as "Chrome MCP visual intelligence." | NEEDS DOC UPDATE FIRST (skill regeneration removes the reference), then SAFE TO DELETE |
| `engine/analyze/behavior-model.ts` | 0 code refs | SAFE TO DELETE |
| `engine/generate/component-gen.ts`, `engine/generate/page-assembler.ts`, `engine/generate/foundation.ts`, `engine/generate/templates/` | 0 code refs | SAFE TO DELETE |
| `engine/generate/builder-prompts.ts` | Imported by `scripts/extract.ts` only | SAFE TO DELETE with `scripts/extract.ts` |
| `docs/design-references/.gitkeep`, `docs/animations/.gitkeep` | 0 refs | SAFE TO DELETE (Next.js scaffold residue) |
| `Dockerfile` mention inside `.gitignore` (`.next/`, `clone-prototype/`, `clone-astro/`) | rules in `.gitignore` only | NEEDS DOC UPDATE FIRST (strip the stale ignore lines) — then they're effectively gone |
| `scripts/seo-backfill.mts` | Hard-coded Cameron downloads path | SAFE TO DELETE |
| `scripts/inspect-live.ts`, `inspect-selector-resolution.ts`, `login-omni.ts`, `auth-verify.ts`, `verify-clone.ts`, `verify-interactions.ts`, `verify-key-clicks.ts`, `verify-key-clicks-v2.ts`, `verify-posts-menu.ts`, `verify-tabs-and-toasts.ts`, `verify-toast.ts` | One-offs, Omnisocials/Krevio hardcoded | SAFE TO DELETE or move under `docs/blocklists/<app>/scripts/` |

#### A.13 Tally
- 12 candidates listed (excluding `engine/qa/` which is now partial).
- **SAFE TO DELETE outright: 6** (`Dockerfile`, `Dockerfile.dev`, `docker-compose.yml`, `.dockerignore`, `scripts/extract-multi.ts`, `scripts/download-assets.mjs`, `docs/docs/research/prompts/`).
- **NEEDS DOC UPDATE FIRST: 3** (`scripts/extract.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`).
- **STILL ACTIVE — DO NOT DELETE: 1** (`engine/qa/parity-check.ts`). The folder-level "delete `engine/qa/`" claim from §3 of the original audit is wrong and must be retracted.

---

### B. Call-graph proof of the two parallel pipelines

Methodology: grep every `import` whose path resolves into either pipeline's surface, and grep every `npm run` script + skill reference. Lines are `caller (file:line) → callee (module)`.

#### B.1 The DORMANT pipeline (legacy "extract -> analyze -> generate -> qa")

Entry candidates: `scripts/extract.ts`, `scripts/extract-multi.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`.

```
scripts/extract.ts:17        → engine/extract/playwright/animation-detector
scripts/extract.ts:18        → engine/extract/playwright/page-scanner
scripts/extract.ts:19        → engine/extract/playwright/font-extractor
scripts/extract.ts:20        → engine/extract/playwright/asset-collector
scripts/extract.ts:21        → engine/extract/playwright/interaction-mapper
scripts/extract.ts:22        → engine/extract/playwright/stylesheet-scraper
scripts/extract.ts:27        → engine/generate/builder-prompts

scripts/extract-multi.ts:26  → engine/extract/playwright/animation-detector
scripts/extract-multi.ts:27  → engine/extract/playwright/page-scanner
scripts/extract-multi.ts:28  → engine/extract/playwright/font-extractor
scripts/extract-multi.ts:29  → engine/extract/playwright/asset-collector
scripts/extract-multi.ts:30  → engine/extract/playwright/interaction-mapper
scripts/extract-multi.ts:31  → engine/extract/playwright/stylesheet-scraper
scripts/extract-multi.ts (rest) → engine/extract/multi-page, engine/extract/merge

scripts/qa.ts:15             → engine/qa/screenshotter
scripts/qa.ts:22             → engine/qa/pixel-diff
scripts/qa.ts:28             → engine/qa/content-masker

scripts/qa-sections.ts:19    → engine/qa/section-comparator
scripts/qa-sections.ts:20    → engine/qa/hover-tester
scripts/qa-sections.ts:21    → engine/qa/dom-comparator
```

Inbound to those 4 scripts:
```
package.json                 → 0 references
.github/workflows/ci.yml     → 0 references
scripts/* (any other script) → 0 references
engine/**                    → 0 references
.claude/skills/clone-website/SKILL.md:63,333,390,485       → scripts/extract.ts, scripts/qa.ts (TEXT ONLY)
(same 8 lines repeated across .codex / .augment / .continue / .cursor / .gemini / .opencode / .windsurf / .github/skills)
docs/ROADMAP.md:218,228,238,248,258,268,278,304,354,394,460,470,480,490 → engine/qa/* + engine/extract/playwright/* + scripts/extract.ts (TEXT ONLY)
```

**Verdict: Dormant — code-dead, doc-alive.** Zero runtime callers from `package.json`, CI, or any other script. The only "callers" are natural-language instructions inside generated skill markdown and `docs/ROADMAP.md`. No hidden hooks. A static-trace tool would not find a path from `npm run *` to any of these files.

#### B.2 The ACTIVE pipeline ("capture -> parse -> clone -> build -> verify")

Entry points (each is wired into `package.json`):
```
npm run capture                  → scripts/capture.ts
npm run parse:har                → scripts/parse-har.ts
npm run parse:trace              → scripts/parse-trace.ts
npm run clone                    → scripts/clone.ts
npm run clone-site               → scripts/clone-site.ts
npm run clone-urls               → scripts/clone-urls.ts
npm run clone-end-to-end         → scripts/run-clone.ts
npm run build:<astro|react|webapp> → scripts/build.ts
npm run verify:parity            → scripts/verify-parity.ts
npm run extract:css / tokens / primitives / animations / library / iconify:svgs → engine/css/* + engine/tokens/* + engine/primitives/* + engine/animations/* + engine/library/* + engine/iconify/*
```

Then the in-pipeline call graph:
```
scripts/capture.ts                  → engine/extract/browser/cdp-attach (openBrowser)
                                    → engine/extract/browser/viewports
                                    → engine/extract/capture/recording
                                    → engine/extract/capture/tour
                                    → engine/extract/capture/network-recorder
                                    → engine/extract/capture/lazy-load-pass

scripts/clone.ts                    → engine/clone/{html-rewriter, css-rewriter, asset-copier, url-map}

scripts/clone-site.ts               → engine/extract/site-crawler
                                    → scripts/capture.ts (subprocess)
                                    → scripts/parse-har.ts (subprocess)
                                    → scripts/parse-trace.ts (subprocess)
                                    → scripts/clone.ts (subprocess)

scripts/clone-urls.ts:43            → engine/targets/astro                 (astroAdapter)
scripts/clone-urls.ts:44            → engine/targets/react                 (reactAdapter)
scripts/clone-urls.ts:161           → adapter = target === 'astro' ? astroAdapter : reactAdapter
scripts/clone-urls.ts:465 (dynamic) → engine/qa/parity-check (runParityCheck)   *** parity-check IS active ***

scripts/build.ts:266                → engine/targets/astro                 (astroAdapter)
scripts/build.ts:274                → engine/targets/react                 (reactAdapter)
scripts/build.ts:283                → engine/targets/webapp                (webappAdapter)

scripts/build-html-mirror.ts:14     → engine/targets/html-mirror (NOT TargetAdapter — direct buildHtmlMirror call)

scripts/verify-parity.ts            → engine/verify/{ports, screenshots, diff, report, render, types}

engine/targets/astro/index.ts       → engine/targets/shared/* + engine/analyze/topology + engine/analyze/design-tokens + engine/analyze/component-tree
engine/targets/react/index.ts       → engine/targets/shared/* + engine/analyze/topology + engine/analyze/design-tokens + engine/analyze/component-tree
engine/targets/webapp/index.ts      → engine/targets/webapp/build → engine/targets/webapp/{crawler, inference, detect-libs, emit-libs, emit-mocks, emit-realtime, emit-stateful, emit-assets, scaffold}
```

Post-build hooks:
```
scripts/clone-urls.ts → engine/orchestrator/post-build/post-emit-multi (astro)
scripts/clone-urls.ts → engine/orchestrator/post-build/post-emit-multi-react (react)
scripts/clone-urls.ts → engine/orchestrator/post-build/emit-only (recovery path)
scripts/clone-urls.ts:465 → engine/qa/parity-check (hard parity gate)
```

**Verdict: Active, well-connected.** The active pipeline does use one file inside `engine/qa/` — `parity-check.ts` — via a dynamic import. That's the hidden hook the §3 deletes list missed.

#### B.3 Final verdict on the "two parallel pipelines" claim

Dormant pipeline (`scripts/extract.ts`, `scripts/extract-multi.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts` + their engine subtrees, *except* `engine/qa/parity-check.ts`) is **truly dead — no hidden hooks**. The original audit was wrong only in calling `engine/qa/` as a whole "DORMANT." `parity-check.ts` is the survivor that has to be lifted into the active subsystem before its containing folder is deleted.

---

### C. Proposed `TargetAdapter` v2 interface

Goals:
1. Eliminate the `crawlDir` structural cast on webapp.
2. Eliminate the `name` string-literal union so adding a target needs no edit to `engine/targets/types.ts`.
3. Force every target to declare a uniform post-emit pass (install / build / verify-render / parity-gate), even if it returns a no-op summary.
4. Make `buildMulti` and `crawlMode` declarative capabilities, not optional methods, so callers can check support without `typeof adapter.x === 'function'` probes.

```ts
/**
 * Target adapter contract v2.
 *
 * Every target (astro, react, webapp, html-mirror, future nuxt/sveltekit/etc.)
 * implements this contract. The shared dispatcher (`parity build` /
 * `parity clone-urls`) never needs to know which target it is.
 */

/** What kind of input a target consumes. */
export type TargetInputKind =
  | 'clone'          // captured static clone dir (`index.html` + `manifest.json`)
  | 'crawl'          // multi-route crawl graph (webapp)
  | 'crawl-or-clone'; // accepts either

/** Capabilities a target may advertise. The dispatcher reads these. */
export interface TargetCapabilities {
  /** Does this target support multi-page builds? */
  readonly multiPage: boolean;
  /** Does this target support a post-emit verify-render boot test? */
  readonly verifyRender: boolean;
  /** Does this target support the pixel-diff parity gate? */
  readonly parityGate: boolean;
  /** Inputs accepted by `build()`. */
  readonly inputKind: TargetInputKind;
}

export interface TargetBuildInput {
  /** Captured clone dir (required when capabilities.inputKind !== 'crawl'). */
  cloneDir?: string;
  /** Crawl graph dir (required when capabilities.inputKind !== 'clone'). */
  crawlDir?: string;
  /** Output directory. */
  outDir: string;
  /** Optional project slug. Adapter derives from manifest if absent. */
  name?: string;
  /** Overwrite outDir if it already exists. */
  force?: boolean;
  /** Adapter-specific options bag. Each adapter declares its own shape. */
  options?: Readonly<Record<string, unknown>>;
}

export interface TargetBuildSummary {
  outDir: string;
  componentsEmitted: number;
  pagesEmitted: number;
  assetCount: number;
  assetBytes: number;
}

export interface MultiPageInput {
  cloneDir: string;
  pathname: string;
  url?: string;
}

export interface TargetMultiBuildInput extends Omit<TargetBuildInput, 'cloneDir'> {
  pages: ReadonlyArray<MultiPageInput>;
}

export interface TargetMultiBuildSummary {
  outDir: string;
  pagesEmitted: ReadonlyArray<string>;
  sharedComponents: ReadonlyArray<string>;
  perPageComponents: number;
  assetCount: number;
  assetBytes: number;
}

export interface PostEmitInput {
  /** Output dir produced by `build()` / `buildMulti()`. */
  projectDir: string;
  /** Reference capture root (for parity gate). May be omitted if !parityGate. */
  referenceDir?: string;
  /** Viewports to verify against. Defaults to canonical four. */
  viewports?: ReadonlyArray<string>;
  /** Pixel-diff threshold (0..1). Defaults to adapter's recommendation. */
  parityThreshold?: number;
  /** Skip the parity gate (still install + build + verify-render). */
  skipParity?: boolean;
  /** Original URL — used only for parity reports. */
  originalUrl?: string;
}

export interface PostEmitSummary {
  /** Did `npm install` (or equivalent) complete? */
  installed: boolean;
  /** Did the production build succeed? */
  built: boolean;
  /** verify-render result (null if !capabilities.verifyRender). */
  verifyRender: { routesChecked: number; passed: number } | null;
  /** parity gate result (null if !capabilities.parityGate OR skipParity). */
  parity: { passed: boolean; reportPath: string } | null;
}

/**
 * v2 contract. `name` is a free string (no union), capabilities are explicit,
 * and `postEmit` is mandatory (a no-op implementation is fine).
 */
export interface TargetAdapter {
  /** Free-form identifier, e.g. 'astro' | 'react' | 'webapp' | 'nuxt'. */
  readonly name: string;
  /** Static capability declaration read by the dispatcher. */
  readonly capabilities: TargetCapabilities;
  /** Single-page (or single-crawl) build. */
  build(input: TargetBuildInput): Promise<TargetBuildSummary>;
  /** Multi-page build. Must throw if !capabilities.multiPage. */
  buildMulti(input: TargetMultiBuildInput): Promise<TargetMultiBuildSummary>;
  /**
   * Post-emit: install + production build + verify-render (if supported) +
   * parity gate (if supported). MANDATORY. Targets that have nothing to do
   * here return `{ installed: false, built: false, verifyRender: null, parity: null }`.
   */
  postEmit(input: PostEmitInput): Promise<PostEmitSummary>;
}
```

#### How today's three targets map to v2

| v2 surface | astro (today) | react (today) | webapp (today) |
|---|---|---|---|
| `name` | `'astro'` (literal) → free `'astro'` string | `'react'` (literal) → free `'react'` string | `'webapp'` (literal) → free `'webapp'` string |
| `capabilities.inputKind` | NEW. Set `'clone'` | NEW. Set `'clone'` | NEW. Set `'crawl-or-clone'` — kills the `(options as { crawlDir? }).crawlDir` cast at `engine/targets/webapp/index.ts:117` |
| `capabilities.multiPage` | NEW. `true` (mirrors today's `buildMulti?`) | NEW. `true` | NEW. `false` (documented "Phase 2" at `engine/targets/webapp/index.ts:6-9`) |
| `capabilities.verifyRender` | NEW. `true` (today's `runPostEmitMulti` verify-render phase) | NEW. `true` (`runPostEmitMultiReact`) | NEW. `false` (gap — see audit §6.7) |
| `capabilities.parityGate` | NEW. `true` (`runParityCheck` accepts `'astro'`) | NEW. `true` (`runParityCheck` accepts `'react'`) | NEW. `false` (parity-check target union does not include `'webapp'`) |
| `build()` | `engine/targets/astro/build.ts:buildAstroProject` | `engine/targets/react/build.ts:buildReactProject` | `engine/targets/webapp/build.ts:buildWebappProject` — `crawlDir` now lives on `TargetBuildInput`, no cast |
| `buildMulti()` | `engine/targets/astro/build-multi.ts:buildAstroMulti` | `engine/targets/react/build-multi.ts:buildReactMulti` | NEW stub that throws "Phase 2" |
| `postEmit()` | NEW. Wraps `engine/orchestrator/post-build/post-emit-multi.ts:runPostEmitMulti` + `engine/qa/parity-check.ts:runParityCheck` | NEW. Wraps `engine/orchestrator/post-build/post-emit-multi-react.ts:runPostEmitMultiReact` + `engine/qa/parity-check.ts:runParityCheck` | NEW. No-op summary (until verify-render and parity gate are added for webapp) |

#### Bonus: how `html-mirror` finally joins the contract

| v2 surface | html-mirror |
|---|---|
| `name` | `'html-mirror'` |
| `capabilities.inputKind` | `'crawl'` |
| `capabilities.multiPage` | `true` (every crawled route emits a static page) |
| `capabilities.verifyRender` | `false` |
| `capabilities.parityGate` | `false` |
| `build()` | wraps `engine/targets/html-mirror/index.ts:buildHtmlMirror` |
| `buildMulti()` | same function (it's already multi-route) |
| `postEmit()` | no-op summary |

This is the seam for a hypothetical Nuxt target: implement six methods, declare four capabilities, ship.

---

### D. Proposed V2.0 folder tree

```
dr-parity/
├── README.md                          RENAME→ stays, REWRITE content (NEW text — describes the CLI)
├── AGENTS.md                          KEEP (rewrite — strip Next.js claims, document parity CLI)
├── CLAUDE.md                          KEEP (regenerated symlink to AGENTS.md)
├── GEMINI.md                          KEEP (regenerated)
├── CHANGELOG.md                       KEEP
├── LICENSE                            KEEP
├── package.json                       KEEP (collapsed: 43 scripts → ~6 thin shims to `parity <cmd>`)
├── tsconfig.json                      KEEP
├── playwright.config.ts               DELETE (no `playwright test` is wired)
├── dr-parity-primitives.config.ts     KEEP
├── .nvmrc                             KEEP
├── .gitignore                         KEEP (strip `.next/`, `clone-prototype/`, `clone-astro/`)
├── .gitattributes                     KEEP
├── features.md                        MOVE→ docs/specs/brand-extraction.md
│
├── Dockerfile                         DELETE
├── Dockerfile.dev                     DELETE
├── docker-compose.yml                 DELETE
├── .dockerignore                      DELETE
│
├── .github/
│   ├── workflows/ci.yml               REWRITE (runs `npm run typecheck` + `parity self-check`)
│   ├── copilot-instructions.md        KEEP (generated)
│   ├── PULL_REQUEST_TEMPLATE.md       KEEP
│   ├── ISSUE_TEMPLATE/                KEEP
│   └── skills/clone-website/SKILL.md  DELETE (no longer the source of truth; see .claude/skills below)
│
├── bin/
│   └── parity                         NEW — entry shim that execs `tsx packages/cli/src/main.ts`
│
├── packages/
│   ├── cli/                           NEW — the `parity` CLI binary lives here
│   │   ├── package.json               NEW (declares `parity` bin)
│   │   ├── src/
│   │   │   ├── main.ts                NEW — top-level command dispatcher
│   │   │   ├── commands/              NEW
│   │   │   │   ├── capture.ts         NEW (absorbs scripts/capture.ts)
│   │   │   │   ├── parse.ts           NEW (absorbs parse-har + parse-trace)
│   │   │   │   ├── clone.ts           NEW (absorbs clone + clone-site + clone-urls + run-clone)
│   │   │   │   ├── build.ts           NEW (absorbs scripts/build.ts)
│   │   │   │   ├── verify.ts          NEW (absorbs verify-parity + parity-check)
│   │   │   │   ├── extract.ts         NEW (absorbs css/tokens/primitives/animations/library subcommands)
│   │   │   │   └── self-check.ts      NEW (validates target adapters + skill freshness)
│   │   │   ├── logging/               NEW — structured per-run logs land in .runs/
│   │   │   ├── flags/                 NEW — uniform --key=value parser shared by all commands
│   │   │   └── run-context.ts         NEW — per-invocation context (slug, start time, log writer)
│
├── engine/
│   ├── types/                         KEEP
│   ├── utils/                         KEEP
│   │
│   ├── extract/
│   │   ├── browser/                   KEEP (active)
│   │   ├── capture/                   KEEP (active)
│   │   ├── site-crawler.ts            KEEP (active)
│   │   ├── playwright/                DELETE (after porting any salvageable font/asset logic into capture/)
│   │   ├── chrome-mcp/                DELETE (empty + skill-references purged)
│   │   ├── multi-page.ts              DELETE
│   │   ├── merge.ts                   DELETE
│   │   ├── cache.ts                   DELETE
│   │   └── checkpoint.ts              DELETE
│   │
│   ├── analyze/
│   │   ├── topology.ts                KEEP
│   │   ├── design-tokens.ts           KEEP
│   │   ├── component-tree.ts          KEEP
│   │   ├── behavior-model.ts          DELETE
│   │   └── css/                       KEEP
│   │
│   ├── clone/                         KEEP (active)
│   │
│   ├── generate/
│   │   ├── prototype/                 KEEP (active)
│   │   ├── astro/                     KEEP (active)
│   │   ├── component-gen.ts           DELETE
│   │   ├── page-assembler.ts          DELETE
│   │   ├── foundation.ts              DELETE
│   │   ├── builder-prompts.ts         DELETE
│   │   └── templates/                 DELETE
│   │
│   ├── verify/                        KEEP — absorb engine/qa/parity-check.ts here
│   │   ├── ports.ts                   KEEP
│   │   ├── screenshots.ts             KEEP
│   │   ├── diff.ts                    KEEP
│   │   ├── report.ts                  KEEP
│   │   ├── render.ts                  KEEP
│   │   ├── types.ts                   KEEP
│   │   └── parity-check.ts            MOVE← engine/qa/parity-check.ts (the only survivor)
│   │
│   ├── qa/                            DELETE (after moving parity-check.ts)
│   │
│   ├── tests/                         KEEP (parity specs)
│   │   └── out/                       MOVE→ .runs/test-output/ (gitignored)
│   │
│   ├── targets/                       KEEP (the healthiest subsystem)
│   │   ├── types.ts                   REWRITE (TargetAdapter v2 — see §C)
│   │   ├── shared/                    KEEP — add deriveDefaultName.ts (de-duplicate triplicated copy)
│   │   ├── astro/                     KEEP
│   │   ├── react/                     KEEP
│   │   ├── webapp/                    KEEP
│   │   └── html-mirror/               KEEP — adopt TargetAdapter v2 here too
│   │
│   ├── orchestrator/                  KEEP
│   ├── iconify/                       KEEP
│   ├── animations/                    KEEP
│   ├── tokens/                        KEEP
│   ├── primitives/                    KEEP
│   ├── scope-styles/                  KEEP
│   ├── refactor/                      KEEP
│   ├── library/                       KEEP (decide later if this becomes engine/targets/library)
│   └── playbook/                      KEEP
│
├── scripts/                           SHRINK — only tooling remains
│   ├── sync-skills.mjs                KEEP
│   ├── sync-agent-rules.sh            KEEP
│   ├── (all 43 pipeline scripts)      DELETE — absorbed into packages/cli/src/commands/
│   ├── (all 11 one-offs)              MOVE→ docs/blocklists/<app>/scripts/ OR DELETE
│   └── .gitkeep                       KEEP
│
├── docs/
│   ├── README.md                      NEW — index for docs/
│   ├── ROADMAP.md                     REWRITE (stats are 10x off)
│   ├── V2.0/                          KEEP (this audit + sibling docs)
│   ├── research/
│   │   ├── INSPECTION_GUIDE.md        KEEP
│   │   └── captures/                  KEEP (gitignored)
│   ├── specs/                         NEW — features.md lands here as brand-extraction.md
│   ├── adapters/                      NEW — one .md per target documenting its capabilities + post-emit
│   ├── docs/                          DELETE (`docs/docs/` path bug)
│   ├── design-references/.gitkeep     DELETE
│   ├── animations/.gitkeep            DELETE
│   └── blocklists/                    KEEP — per-app blocklists + one-off scripts move under here
│
├── clones/                            KEEP (gitignored working dir)
│   └── .gitkeep                       KEEP
│
├── .runs/                             NEW — per-invocation structured logs (gitignored)
│   └── <iso-timestamp>-<command>/     NEW — created by packages/cli/src/logging
│       ├── meta.json                  NEW
│       ├── stdout.log                 NEW
│       └── stderr.log                 NEW
│
├── .claude/
│   ├── skills/clone-website/SKILL.md  REWRITE (calls `parity` CLI, not raw tsx scripts)
│   ├── skills/playwright-cli/         KEEP (gitignored)
│   ├── commands/clone-website.md      KEEP (regenerated)
│   └── settings.local.json            KEEP (gitignored)
│
├── (other AI tool integrations)       KEEP all (regenerated by sync-skills.mjs after SKILL.md rewrite)
│
└── (absent files)                     n/a — auto-probe.mjs, full-diag.mjs, test-login.mjs, bugs.md, NEXT.md, SMOKE_TEST_DIFF.txt referenced in docs but absent on disk; doc references should be cleaned up
```

Directory roles (one-liners):
- **`bin/parity`** — single user-facing entry. `npm run *` shims point here.
- **`packages/cli/`** — the CLI binary. Owns argument parsing, logging, run-context; orchestrates engine modules.
- **`engine/extract/`** — phase 1 — turn a URL into a captured directory.
- **`engine/clone/`** — phase 2a — turn the capture into a static HTML clone.
- **`engine/analyze/`** — phase 2b — produce topology/tokens/component-tree specs from a clone.
- **`engine/generate/`** — phase 3 — render framework-agnostic prototypes from specs.
- **`engine/targets/`** — phase 3 — framework-specific emission (TargetAdapter v2 contract).
- **`engine/orchestrator/`** — runs the per-target post-emit hooks invoked by `adapter.postEmit()`.
- **`engine/verify/`** — phase 4 — install/build/verify-render/parity-gate; sole home of `parity-check.ts`.
- **`engine/{iconify,animations,tokens,primitives,scope-styles,refactor,library,playbook}/`** — supporting subsystems consumed by adapters.
- **`scripts/`** — tooling only (skill sync, agent-rules sync). Pipeline scripts are gone.
- **`docs/V2.0/`** — this audit series. Once V2.0 lands, archive to `docs/history/V2.0/`.
- **`docs/adapters/`** — one markdown per target documenting capabilities, options, post-emit behaviour.
- **`docs/blocklists/`** — per-app crawler blocklists + per-app verification one-offs.
- **`clones/`** — working scratch (gitignored).
- **`.runs/`** — per-invocation logs (gitignored). Read by `parity logs <run-id>`.

---

### E. Doc/code drift cleanup list

Goal: a single PR that scrubs every "Next.js + shadcn/ui + Tailwind v4 + `src/`" claim. Below is the line-by-line.

#### E.1 `AGENTS.md`
| Line | Current | Replacement |
|---|---|---|
| 21 | "Framework: Next.js 16 (App Router, React 19, TypeScript strict)" | "Framework: Node 24 + tsx + Playwright. No web framework runtime — the engine is a CLI." |
| 22 | "UI: shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)" | DELETE line. UI libraries are an *emitted* concern, not a Dr Parity dependency. |
| 23 | "Icons: Lucide React (default — will be replaced/supplemented by extracted SVGs)" | DELETE line. |
| 24 | "Styling: Tailwind CSS v4 with oklch design tokens" | DELETE line. |
| 25 | "Deployment: Vercel" | DELETE line. |
| 27-30 | "`npm run dev` — Start dev server / `npm run build` — Production build / `npm run lint` — ESLint check / `npm run check` — Run lint + typecheck + build" | Replace with: "`npm run typecheck`, `parity capture <url>`, `parity clone <url>`, `parity build <target>`, `parity verify`, see `parity --help`." |
| 47-72 | The whole `src/ app/ components/ ui/ icons.tsx lib/utils.ts types/ hooks/ public/images/ public/videos/ public/seo/` tree | Replace with the V2.0 tree from §D of this audit. |

#### E.2 `CLAUDE.md`
Currently a generated copy of `AGENTS.md` (`@AGENTS.md` directive at line 1). Regenerate after editing `AGENTS.md` via `bash scripts/sync-agent-rules.sh`. No direct edits.

#### E.3 `README.md`
| Line | Current | Replacement |
|---|---|---|
| 7 | "Next.js-based cloning engine" | "TypeScript CLI cloning engine" |
| 31-37 | Tech-stack section listing Next.js / React / Tailwind / shadcn | Replace with: "Node 24, tsx, Playwright, cheerio. Emits Astro, React, Webapp, or static HTML projects. No runtime web framework in the engine itself." |
| 41-49 | `src/`, `public/` folder claims | Delete. Replace with link to AGENTS.md tree. |

Full rewrite is faster than line-edits.

#### E.4 `.claude/skills/clone-website/SKILL.md`
| Line | Current | Replacement |
|---|---|---|
| 63 | `npx tsx scripts/extract.ts <url> --output docs/research` | `parity capture <url>` |
| 333 / 390 | `npx tsx scripts/qa.ts <original-url> --clone-url http://localhost:3000 --threshold 5` | `parity verify --reference=<original-url> --project=<clone-dir> --threshold=0.05` |
| 393 | "The fix loop module (`engine/qa/fix-loop.ts`) is designed for exactly this" | Delete reference to `fix-loop.ts`; describe `parity verify` reporting instead. |
| 485 | "Don't skip the QA comparison. Run `scripts/qa.ts` and fix what it finds." | "Don't skip the parity gate. Run `parity verify` and fix what it finds." |
| Anywhere it claims "Next.js + shadcn/ui + Tailwind v4 scaffold must already be in place" | DELETE that pre-flight check — no scaffold exists. |

After this edit, `node scripts/sync-skills.mjs` regenerates every other AI-tool skill file (`.codex`, `.augment`, `.continue`, `.cursor`, `.gemini`, `.opencode`, `.windsurf`, `.github/skills`) from the same source — eight files fixed by one edit.

#### E.5 `docs/research/INSPECTION_GUIDE.md`
The guide describes inspecting *target* sites, not the Dr Parity repo. The only drift is in the Phase 5 output paragraph that names files we may or may not still emit (`DESIGN_TOKENS.md`, `COMPONENT_INVENTORY.md`, etc.).
- **Action:** Verify these are still the expected outputs of `parity extract:tokens` / `parity extract:primitives`. If yes, no edit needed. If no, update the filenames to match what the engine actually writes today (`engine/tokens/emit-css.ts`, `engine/tokens/emit-ts.ts`, `engine/tokens/emit-map.ts`).

#### E.6 `.github/workflows/ci.yml`
| Line | Current | Replacement |
|---|---|---|
| 30-37 (approx) | `run: npm run lint` and `run: npm run build` | Replace with `run: npm run typecheck` and (optional) `run: npx tsx packages/cli/src/main.ts self-check`. |

The workflow currently fails on every push because `lint` and `build` are not declared. Fixing this is high-priority — it's the only enforcement mechanism this repo has.

#### E.7 `docs/ROADMAP.md`
- Counts at the top of the file ("26 engine files, 11062 lines") are off by 10x — actual is 254 engine files.
- Every "Where: engine/qa/screenshotter.ts | engine/qa/fix-loop.ts | engine/extract/playwright/page-scanner.ts | scripts/extract.ts" pointer (lines 152, 162, 172, 218, 228, 238, 248, 258, 268, 278, 304, 354, 394, 460, 470, 480, 490) points to dormant code.
- **Action:** Full rewrite. Map each roadmap milestone to the new pipeline (`parity capture` → `parity clone` → `parity build` → `parity verify`).

#### E.8 The other generated skill files (read-only after `sync-skills.mjs`)
`.codex/skills/clone-website/SKILL.md`, `.augment/commands/clone-website.md`, `.continue/commands/clone-website.md`, `.cursor/commands/clone-website.md`, `.gemini/commands/clone-website.toml`, `.opencode/commands/clone-website.md`, `.windsurf/workflows/clone-website.md`, `.github/skills/clone-website/SKILL.md`, `.amazonq/cli-agents/clone-website.json` — all carry identical drift (refer to `scripts/extract.ts`, `scripts/qa.ts`, `engine/qa/fix-loop.ts`). All are regenerated from `.claude/skills/clone-website/SKILL.md`. Fix E.4, run `node scripts/sync-skills.mjs`, done.

---

### F. Adding a hypothetical `nuxt` target — V2.0 walkthrough

#### F.1 Today (lifted from §5 of the original audit)

| # | Touchpoint | What changes |
|---|---|---|
| 1 | NEW `engine/targets/nuxt/` folder | ~6 files (`index.ts`, `build.ts`, `build-multi.ts`, `emit.ts`, `scaffold.ts`, `types.ts`) |
| 2 | `scripts/build.ts:28` | Extend `type TargetName = 'astro' \| 'react' \| 'webapp'` to add `'nuxt'` |
| 3 | `scripts/build.ts:264-291` | Add a third `if (target === 'nuxt')` branch with dynamic import + adapter probe |
| 4 | `scripts/clone-urls.ts:43-45` | Add `import { nuxtAdapter }` + add to target dispatch chain |
| 5 | `engine/targets/types.ts:65` | Edit `name: 'astro' \| 'react' \| 'webapp'` to include `'nuxt'` (changes the shared contract for one target) |
| 6 | `package.json` | Add `build:nuxt` + `build:nuxt:multi` scripts |
| 7 | OPTIONAL `engine/orchestrator/post-build/post-emit-multi-nuxt.ts` | Mirror of `post-emit-multi-react.ts` |
| 8 | OPTIONAL `engine/qa/parity-check.ts:38` | Extend `ParityTarget = 'astro' \| 'react'` union to include `'nuxt'` |
| 9 | `AGENTS.md`, `README.md`, `docs/ROADMAP.md` | Update target list |
| 10 | 8 generated `clone-website` skill files | Regenerate from `.claude/skills/clone-website/SKILL.md` |

**Today: 10 touchpoints, ~6 new files + edits in 5 existing core files + edits in 4 doc files. Estimated diff: ~600 lines new code + ~60 lines edits across 9 non-target files. Two of those edits (`engine/targets/types.ts:65` and `engine/qa/parity-check.ts:38`) require modifying shared contract files just to add a target.**

#### F.2 V2.0

| # | Touchpoint | What changes |
|---|---|---|
| 1 | NEW `engine/targets/nuxt/` folder | ~6 files. Same shape as astro/react. `index.ts` exports `nuxtAdapter: TargetAdapter` (v2) with `capabilities` declared inline — no edit to `engine/targets/types.ts` needed |
| 2 | NEW `engine/targets/nuxt/README.md` (or `docs/adapters/nuxt.md`) | Documents capabilities + options bag |
| 3 | NEW one-line entry in `packages/cli/src/commands/build.ts`'s adapter registry | `{ nuxt: () => import('engine/targets/nuxt') }` — registry is target-agnostic, no `if/else` chain |

**That is the entire list.** Specifically:
- `engine/targets/types.ts` does NOT change (`name` is `string`, not a union).
- `engine/qa/parity-check.ts` is irrelevant (it has moved into `engine/verify/parity-check.ts` and is invoked by `adapter.postEmit()`, not by direct import on the target name).
- `package.json` does NOT change (one shim — `npm run build` — dispatches by `--target=<any-string>`).
- `AGENTS.md` does NOT change (the target list is generated from the registry at `parity targets --list`).
- `clone-website` skill files do NOT change (they say "use `parity build --target=<x>`", which is target-agnostic).
- `scripts/build.ts`, `scripts/clone-urls.ts` do NOT exist any more — they're absorbed into `packages/cli/src/commands/build.ts` (one file, one registry).

**V2.0: 3 touchpoints. ~6 new files in the target folder. Zero edits to shared contract files. Zero edits to top-level docs. Zero npm script additions.**

#### F.3 Side-by-side

| Metric | Today | V2.0 |
|---|---|---|
| Files modified outside `engine/targets/<new>/` | 9 | 1 (the CLI's adapter registry) |
| Shared contract files touched | 2 (`engine/targets/types.ts`, `engine/qa/parity-check.ts`) | 0 |
| `npm run` script edits | 2 added | 0 |
| Doc files needing edit + regen | 11 (AGENTS.md + README.md + ROADMAP.md + 8 skills) | 1 (a NEW per-target doc) |
| Lines of edit outside the new target folder | ~60 | ~5 |
| Decisions a contributor has to make | "Which dispatcher to edit? `build.ts` vs `clone-urls.ts` vs both?" | None — single registry |
| Risk of forgetting a hookup | High (5 dispatchers, 2 unions) | Low (one registry, one capability declaration) |

This is the case for V2.0 in one table: **a new target is one folder, one registry line, one doc page** — and nothing about the rest of the repo changes.

---

## Report back

- **Obvious deletes that survived the safety pass:** 6 of 12 are SAFE TO DELETE outright. 3 (`scripts/extract.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`) need a skill/doc regeneration first. 1 (`engine/qa/`) gets demoted to "partial delete only" because `parity-check.ts` is active.
- **Biggest surprise in the call-graph proof:** `engine/qa/parity-check.ts` is dynamically imported by `scripts/clone-urls.ts:465` as a hard parity gate. The original §3 "delete `engine/qa/*`" line was wrong. The file is the active parity harness for every multi-page astro/react build. It needs to move into `engine/verify/`, not be deleted.
- **Touchpoints for adding a new target:** today 10 (6 new files + 9 edits across `engine/targets/types.ts`, `scripts/build.ts`, `scripts/clone-urls.ts`, `package.json`, `engine/qa/parity-check.ts`, `AGENTS.md`, `README.md`, `docs/ROADMAP.md`, 8 generated skill files). In V2.0: 3 (6 new files, one registry line, one doc page). No shared contract files touched.
- **Back-compat of `TargetAdapter` v2 with today's three targets:** Yes, structurally — astro/react/webapp can each be wrapped into v2 in a single PR per target; the existing `build`/`buildMulti` functions stay, gain a `capabilities` declaration and a mandatory `postEmit` (no-op for webapp until verify-render lands).
