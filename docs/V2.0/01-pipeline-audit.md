# Dr Parity V2.0 — Pipeline & Entry Points Audit (Agent 1 of 4)

Read-only forensic map of every way the Dr Parity pipeline can currently be invoked.
Source: `/Users/cameronmcallister/Github/dr-parity` @ branch `prototype-mode`, 2026-05-22.
No code modified. No pipelines executed.

---

## TL;DR (the punchline before the spreadsheet)

There are **at least 56 invocable surfaces** that touch the clone pipeline, spread across:

- 51 npm scripts in `package.json` (plus 5 `tsx scripts/*.ts` files with no npm wrapper)
- 1 user-invocable Claude skill (`/clone-website` and the synced `clone-website.md` slash-command)
- 3 root-level diagnostic `.mjs` files (`auto-probe.mjs`, `full-diag.mjs`, `test-login.mjs`)
- 1 Dockerfile + Dockerfile.dev + docker-compose.yml (these target the *Next.js dashboard*, not the engine)
- 1 Playwright config (browser launch defaults, no orchestration)

There are **at least four parallel "clone this URL" front doors** with overlapping responsibilities:
`/clone-website` (skill), `npm run clone-end-to-end`, `npm run clone-site`, `npm run clone-urls`, and the legacy `tsx scripts/extract.ts` referenced inside the skill body. Three of them call `capture` → `parse:har` → `parse:trace` → `clone`. The fourth (skill `extract.ts`) is a totally separate codepath that bypasses the capture pipeline entirely.

---

## 1. Master inventory: every entry point

### 1.1 npm scripts in `package.json`

Source: `/Users/cameronmcallister/Github/dr-parity/package.json` lines 26 to 74.

| # | npm script | Underlying file | Active? | Notes |
|---|---|---|---|---|
| 1 | `typecheck` | `tsc --noEmit` | active | Pure TS check; no pipeline impact |
| 2 | `check` | alias of `typecheck` | active | Misnamed: doesn't run lint/build despite CLAUDE.md note |
| 3 | `generate:prototype` | `scripts/generate-prototype.ts` | legacy | "Zero-build React prototype" from a `page-data.json` (the old `scripts/extract.ts` output) |
| 4 | `generate:prototype:fixture` | `engine/generate/prototype/__fixtures__/run-fixture.ts` | legacy | Fixture replay of the same |
| 5 | `generate:astro` | `scripts/generate-astro.ts` | legacy | Same as 3 but emits Astro. Pre-`buildAstroProject` codepath |
| 6 | `generate:astro:fixture` | `engine/generate/astro/__fixtures__/run-fixture.ts` | legacy | Fixture replay |
| 7 | `build-astro` | `scripts/build-astro.ts` | active (shim) | Thin shim: forwards to `scripts/build.ts --target=astro`. Used by `rebuild-pro` phase 0 (see `engine/orchestrator/phases.ts:44`) |
| 8 | `build:astro` | `scripts/build.ts --target=astro` | active | Canonical unified builder |
| 9 | `build:react` | `scripts/build.ts --target=react` | active | Canonical unified builder |
| 10 | `build:webapp` | `scripts/build.ts --target=webapp` | active | Canonical unified builder |
| 11 | `crawl:webapp` | `scripts/crawl-webapp.ts` | active | Webapp BFS crawler (persistent Chrome profile) |
| 12 | `capture:forms` | `scripts/capture-form-states.ts` | active | Phase 4 form-state capture (webapp) |
| 13 | `build:react:multi` | `scripts/clone-urls.ts --target=react` | active | URL-list multi-page React build |
| 14 | `build:astro:multi` | `scripts/clone-urls.ts --target=astro` | active | URL-list multi-page Astro build |
| 15 | `test:parity:astro` | `engine/tests/multi-viewport-parity.spec.ts` | active | Multi-viewport parity spec |
| 16 | `test:parity:react` | `engine/tests/multi-viewport-parity-react.spec.ts` | active | Same as above for React |
| 17 | `capture` | `scripts/capture.ts` | active | Canonical Playwright capture (3 modes: launch / cdp / persistent) |
| 18 | `parse:har` | `scripts/parse-har.ts` | active | Parse network HAR into `parsed/{styles,scripts,assets}` |
| 19 | `parse:trace` | `scripts/parse-trace.ts` | active | Parse trace.zip into `dom-snapshots.jsonl` |
| 20 | `parse:all` | `parse:har && parse:trace` chained via `$npm_config_dir` | active | Caveat: relies on `--dir=` npm config, undocumented |
| 21 | `complete:assets` | `scripts/complete-assets.ts` | active | Fetch missing URLs referenced by captured CSS |
| 22 | `extract:css` | `scripts/extract-css.ts` | active | Wave 1 CSS extractor (consumes captured clone dir, emits analysis JSON) |
| 23 | `extract:primitives` | `scripts/extract-primitives.ts` | active | Wave 2 primitive Astro component emitter |
| 24 | `extract:tokens` | `scripts/extract-tokens.ts` | active | Wave 2 design token emitter |
| 25 | `clone` | `scripts/clone.ts` | active | Build static 1:1 clone from a capture dir |
| 26 | `clone-site` | `scripts/clone-site.ts` | active | **Autonomous multi-page crawl** → clone → Astro emit |
| 27 | `clone-urls` | `scripts/clone-urls.ts` | active | **Explicit URL-list multi-page** (no crawler) → clone → Astro/React emit |
| 28 | `clone-page` | `scripts/clone-page.ts` | active (shim) | Thin alias over `run-clone.ts` for single-page clone |
| 29 | `clone-end-to-end` | `scripts/run-clone.ts` | active | Capture → parse:har → parse:trace → clone (single URL) |
| 30 | `check:html-rewriter` | `scripts/check-html-rewriter.ts` | active | Smoke test for the HTML rewriter |
| 31 | `check:astro-emit` | `scripts/check-astro-emit.ts` | active | Smoke test for Astro emitter |
| 32 | `check:refactor` | `scripts/check-refactor.ts` | active | Smoke test for refactor-sections |
| 33 | `iconify:svgs` | `scripts/iconify-svgs.ts` | active | Extract inline SVGs → Astro icon components |
| 34 | `verify:parity` | `scripts/verify-parity.ts` | active | Pixel-diff captured clone vs rebuilt Astro site |
| 35 | `extract:animations` | `scripts/extract-animations.ts` | active | Static animation extractor (JS parse, not runtime) |
| 36 | `scope:styles` | `scripts/scope-styles.ts` | active | Wave 2 scoped per-component style emitter |
| 37 | `check:scope-styles` | `scripts/check-scope-styles.ts` | active | Smoke test |
| 38 | `check:prettify` | `scripts/check-prettify.ts` | active | Smoke test |
| 39 | `centralize:content` | `scripts/centralize-content.ts` | active | Extract editable copy → `src/content/site.ts` |
| 40 | `refactor:sections` | `scripts/refactor-sections.ts` | active | Wave 3 section refactor (primitives + icon swap) |
| 41 | `rebuild-pro` | `scripts/rebuild-pro.ts` | active | **The mega-orchestrator** — runs phases 0-11 plus 12-14 (verify, media-preserve) |
| 42 | `generate:edit-playbook` | `scripts/generate-edit-playbook.ts` | active | EDIT.md playbook generator |
| 43 | `extract:library` | `scripts/extract-library.ts` | active | Catalogue extractor for the section library |
| 44 | `audit:shell` | `scripts/audit-capture.ts shell` | active | Audit-capture phase 1 of 3 (shell) |
| 45 | `audit:plan` | `scripts/audit-capture.ts plan` | active | Audit-capture phase 2 of 3 (plan) |
| 46 | `audit:execute` | `scripts/audit-capture.ts execute` | active | Audit-capture phase 3 of 3 (execute) |
| 47 | `audit:capture` | `scripts/audit-capture.ts run` | active | Audit-capture all 3 phases (deterministic webapp surface capture) |
| 48 | `preview` | `serve` | active | Static preview using `npx serve` |

Plus three implicit aliases removed for brevity. Note: `package.json` does **not** declare `dev`, `build`, `lint`, or `start` despite `.claude/skills/clone-website/SKILL.md` line 31 telling agents to run `npm run build`. That call would fail today.

### 1.2 Scripts with no npm wrapper (callable via `npx tsx scripts/...`)

| # | File | Purpose | State |
|---|---|---|---|
| 49 | `scripts/extract.ts` | Legacy single-page extractor (animations + fonts + assets + interactions → `page-data.json`). **This is what the `/clone-website` skill tells agents to run.** | legacy |
| 50 | `scripts/extract-multi.ts` | Multi-page version of 49 | legacy |
| 51 | `scripts/qa.ts` | Pixel-diff QA (used by the skill's Phase 4.1) | active |
| 52 | `scripts/qa-sections.ts` | Section-by-section QA comparator | active |
| 53 | `scripts/emit-only.ts` | Recover from a partial run: emit Astro project from a frozen capture set (hard-coded defaults point at `/Users/cameronmcallister/Desktop/github/dr-parity/...` and `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/fluid-glass`) | active (recovery) |
| 54 | `scripts/recapture-routes.ts` | Per-route fresh navigation pass for a webapp crawl dir | active |
| 55 | `scripts/build-html-mirror.ts` | Static HTML mirror from a crawl directory | active |
| 56 | `scripts/login-omni.ts` | Manual login into the persistent Chrome profile | active (auth helper) |
| 57 | `scripts/auth-verify.ts` | Headless probe of the persistent profile against a URL | active (auth helper) |
| 58 | `scripts/inspect-live.ts` | Click-probe a running local clone | experimental |
| 59 | `scripts/inspect-selector-resolution.ts` | Resolve manifest triggers against running clone | experimental |
| 60 | `scripts/verify-clone.ts` | Screenshot each route on `:5173` (hard-coded `/Users/cameronmcallister/Github/omnichannel-clone/...` output path) | experimental |
| 61 | `scripts/verify-interactions.ts` | Click verifier | experimental |
| 62 | `scripts/verify-key-clicks.ts` and `.v2.ts` | Hard-coded click set against omnisocials clone | experimental |
| 63 | `scripts/verify-posts-menu.ts` | Hard-coded probe for the posts menu | experimental |
| 64 | `scripts/verify-tabs-and-toasts.ts` | Hard-coded probe | experimental |
| 65 | `scripts/verify-toast.ts` | Hard-coded toast probe | experimental |
| 66 | `scripts/seo-backfill.mts` | One-time backfill for old clones at `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/` | one-shot legacy |
| 67 | `scripts/download-assets.mjs` | Hard-coded asset downloader (terminal-industries URLs) | one-shot legacy |

### 1.3 Root-level diagnostic `.mjs`

| # | File | Purpose | State |
|---|---|---|---|
| 68 | `auto-probe.mjs` | Probe routes on `http://localhost:5173` and dump `/tmp/clone-*.png` | experimental scratch |
| 69 | `full-diag.mjs` | BFS-style probe of routes + heuristic shell detector against omnisocials | experimental scratch |
| 70 | `test-login.mjs` | Try login across `playwright-pinterest` and `playwright-shared` profiles in headless and headed | experimental scratch |

### 1.4 Claude Code skill + slash command

| # | Surface | Path | What it does |
|---|---|---|---|
| 71 | `/clone-website` slash command | `.claude/commands/clone-website.md` | One-liner that delegates to the skill |
| 72 | `clone-website` skill | `.claude/skills/clone-website/SKILL.md` | **525-line natural-language pipeline.** Phase 1.1 instructs the agent to run `npx tsx scripts/extract.ts <url> --output docs/research` — i.e. the legacy extractor (#49), not `clone-site`, not `capture`, not `build`. Phase 4.1 calls `npx tsx scripts/qa.ts`. Phase 0.3 calls `npm run build` (which does not exist). |

### 1.5 Sync utilities (not part of the clone pipeline)

| # | File | Purpose |
|---|---|---|
| 73 | `scripts/sync-skills.mjs` | Regenerate platform-specific skill copies from `.claude/skills/clone-website/SKILL.md` |
| 74 | `scripts/sync-agent-rules.sh` | Regenerate platform-specific agent rule files from `AGENTS.md` |

### 1.6 Docker / Playwright config

| # | Surface | Purpose | Pipeline impact |
|---|---|---|---|
| 75 | `Dockerfile` | Multi-stage build for a `next.js` app (`/app/.next/standalone`, `server.js`) | NONE for the clone engine. Targets the Next.js dashboard that ships with the repo |
| 76 | `Dockerfile.dev` | `node:24-alpine`, `npm run dev` — but `dev` is not in `package.json` | broken/legacy |
| 77 | `docker-compose.yml` | Spins up `app` (port 3000) and `dev` (port 3001) of the above | broken/legacy |
| 78 | `playwright.config.ts` | LaunchOptions defaults (viewport 1440x900, headless, screenshot off) | Passive defaults consumed by Playwright when no explicit launch options are set |

---

## 2. Per-entry-point detail (the ones an agent realistically lands on)

### 2.1 `npm run capture` — `scripts/capture.ts`

- **Command:** `npm run capture -- <url> [--mode=launch|cdp|persistent] [--viewport=...] [--out=...] [--no-tour] [--headed]`
- **What it does:** Launches Chromium in one of three modes, opens the URL at each viewport (4 by default), records HAR/video/trace plus screenshot, and runs the scroll/hover tour to wake lazy content. Output written under `docs/research/captures/<host>/<iso-timestamp>/<viewport>/`.
- **Output:** `docs/research/captures/<host>/<iso-timestamp>/manifest.json`, plus per-viewport `screenshot.png`, `network.har` (launch) or `network.json` (cdp/persistent), `trace.zip`, optional `video/`.
- **Targets:** target-agnostic (raw capture).
- **Calls under the hood:** `engine/extract/browser/cdp-attach.ts` (openBrowser), `engine/extract/browser/viewports.ts`, `engine/extract/capture/recording.ts`, `engine/extract/capture/network-recorder.ts`, `engine/extract/capture/tour.ts`, `engine/extract/capture/lazy-load-pass.ts`.
- **State:** actively used. Foundation of every downstream clone.
- **Inconsistency:** Output root is `docs/research/captures`, NOT `clones/` (the documented "default clone output" path).

### 2.2 `npm run clone-end-to-end` — `scripts/run-clone.ts`

- **Command:** `npm run clone-end-to-end -- <url> [--viewport=...] [--out=...] [--no-tour] [--no-preview]`
- **What it does:** Runs `capture` → `parse:har` → `parse:trace` → `clone` in series via `spawn('npx tsx scripts/...')`. Single URL only.
- **Output:** `<out>/<host>/<timestamp>/<viewport>/clone/index.html` (default `out` is `docs/research/captures`).
- **Targets:** target-agnostic (emits a static 1:1 clone, no framework).
- **Calls under the hood:** `scripts/capture.ts`, `scripts/parse-har.ts`, `scripts/parse-trace.ts`, `scripts/clone.ts`.
- **State:** active. Mentioned in `CLAUDE.md` as `npm run clone-site`. Confusing.
- **Inconsistency:** Despite the npm script name being `clone-end-to-end`, the file is `run-clone.ts`, and the HELP text inside the file calls itself `dr-parity clone-site (end-to-end)`. THREE different names for the same thing.

### 2.3 `npm run clone-page` — `scripts/clone-page.ts`

- **Command:** `npm run clone-page -- <url> [...same flags as run-clone]`
- **What it does:** Spawns `npx tsx scripts/run-clone.ts` with the args verbatim. Pure alias.
- **State:** active alias. Exists purely so the verb "clone this page" maps to `clone-page` instead of `clone-end-to-end`.

### 2.4 `npm run clone-site` — `scripts/clone-site.ts`

- **Command:** `npm run clone-site -- <entry-url> [--max-pages=N] [--max-depth=N] [--path-prefix=...] [--resume] ...`
- **What it does:** Crawls (BFS + robots.txt + path-prefix) from entry URL, captures + parses + clones every discovered page, then runs `buildAstroMulti` to emit a unified Astro project plus `runPostEmitMulti` for centralise + media-preserve + build + verify.
- **Output:** `docs/research/captures/<host>/<timestamp>/` per page, plus the consolidated Astro project at `docs/research/captures/<host>/astro-site/` (or `--astro-out=`).
- **Targets:** Astro only (multi-page).
- **Calls under the hood:** `engine/extract/site-crawler.ts`, then spawns `scripts/capture.ts`, `scripts/parse-har.ts`, `scripts/parse-trace.ts`, `scripts/complete-assets.ts`, `scripts/clone.ts`, then in-process calls `buildAstroMulti` and `runPostEmitMulti`.
- **State:** active. The "real" autonomous front door for multi-page astro clones.
- **Inconsistency:** Despite `clone-site` being the documented multi-page command, the SAME file uses HELP_TEXT `dr-parity clone-site (autonomous multi-page)` while `run-clone.ts` uses HELP_TEXT `dr-parity clone-site (end-to-end)`.

### 2.5 `npm run clone-urls` (and `build:astro:multi`, `build:react:multi`) — `scripts/clone-urls.ts`

- **Command:** `npm run clone-urls -- --urls=urls.txt [--target=astro|react] [--viewport=...] ...`
- **What it does:** Same as `clone-site` but skips the crawler — you pass an explicit URL list. Per URL: capture → parse:har → parse:trace → complete:assets → clone. Then `astroAdapter.buildMulti` or `reactAdapter.buildMulti` + `runPostEmitMulti` (astro) or `runPostEmitMultiReact` (react).
- **Output:** `<out>/<host>/<timestamp>/` per page, plus `<out>/<host>/<target>-site-urls/` (the flag is awkwardly named `--astro-out` even for react).
- **Targets:** astro, react. (NOT webapp.)
- **Calls under the hood:** spawned `capture` / `parse:har` / `parse:trace` / `complete:assets` / `clone`, then in-process `engine/targets/astro/build-multi.ts` or `engine/targets/react/build.ts` plus the post-emit module.
- **State:** active. The "fallback" for when the crawler misses JS-rendered nav.
- **Inconsistency:** Default `--viewport=desktop` (one viewport) while `clone-site` defaults to all four.

### 2.6 `npm run build:astro` / `:react` / `:webapp` — `scripts/build.ts`

- **Command:** `npm run build:<target> -- <clone-dir> [--out=...] [--name=...] [--force]` or (webapp) `npm run build:webapp -- --crawl-dir=...`
- **What it does:** Takes an already-cloned directory (or, for webapp, a crawl dir) and emits a typed framework project. Single-page or multi-page via repeated `--clone-dir=<path>:<pathname>` arguments.
- **Output:** sibling `<target>-site/` next to the input by default, or under `clones/<host>-<iso-timestamp>/`.
- **Targets:** astro, react, webapp.
- **Calls under the hood:** dynamic-imports `engine/targets/{astro,react,webapp}/index.ts` → `adapter.build` or `adapter.buildMulti`.
- **State:** active. The unified `TargetAdapter` dispatcher.

### 2.7 `npm run crawl:webapp` — `scripts/crawl-webapp.ts`

- **Command:** `npm run crawl:webapp -- <startUrl> [--seed-routes=...] [--blocklist=...] [--user-data-dir=...] ...`
- **What it does:** Persistent-profile Chrome BFS crawl of an authed SPA. Emits a state graph + per-state DOM/screenshots/meta under `docs/research/crawl/<host>/<iso>/`.
- **Output:** `docs/research/crawl/<host>/<iso>/{graph.json, states/, routes/, ...}`.
- **Targets:** webapp.
- **Calls under the hood:** `engine/targets/webapp/crawler/`.
- **State:** active. The webapp pipeline's "capture" step.

### 2.8 `npm run audit:*` — `scripts/audit-capture.ts`

- **Command:** `npm run audit:capture -- <startUrl> [--routes=...]` (or `:shell`, `:plan`, `:execute` for individual phases).
- **What it does:** Deterministic three-phase webapp surface capture: shell, plan, execute. **Replaces the BFS crawler** in `crawl-webapp.ts` for sites where determinism matters.
- **Output:** `docs/research/audit/<host>/<iso>/` (per the script body).
- **Targets:** webapp.
- **State:** active. The newer alternative to `crawl:webapp`. Both exist side-by-side.
- **Inconsistency:** Overlaps massively with `crawl:webapp`. Two different paradigms, both labelled "webapp capture".

### 2.9 `npm run rebuild-pro` — `scripts/rebuild-pro.ts`

- **Command:** `npm run rebuild-pro -- <clone-dir> [--url=<url>] [--site] [--mode=safe|aggressive] [--skip=...] ...`
- **What it does:** The mega-orchestrator. Phases 0-14 (scaffold → extract-css → extract-tokens → extract-primitives → iconify-svgs → refactor-sections → scope-styles → wire-layout → centralise-content → verify-parity → verify-render → media-preserve → ...). Can ingest a URL via `--url=` (delegates to `clone-page` or `clone-site --site`).
- **Output:** `<clone-dir>/../astro-pro/` (default).
- **Targets:** astro.
- **Calls under the hood:** Spawns `npm run build-astro`, `extract:css`, `extract:tokens`, `extract:primitives`, `iconify:svgs`, `refactor:sections`, `scope:styles`, `centralize:content`, `verify:parity`. Imports `engine/orchestrator/phases.ts`, `engine/verify/render.ts`, `engine/scope-styles/media-preserve.ts`.
- **State:** active. The most powerful and most opaque entry point. Has a `--emit-only` recovery flag.

### 2.10 `npm run verify:parity` — `scripts/verify-parity.ts`

- **Command:** `npm run verify:parity -- --clone=<dir> --rebuilt=<dir> [--threshold=0.01] [--viewports=...]`
- **What it does:** Pixel-diff a captured clone against a rebuilt Astro site at multiple viewports. Boots both, screenshots, diffs.
- **Output:** `<rebuilt>/../parity-report/{json, md, png}`.
- **Targets:** astro (any rebuilt site with `index.html`).
- **State:** active. Different from `scripts/qa.ts` (which compares against a LIVE URL, not a rebuilt directory).

### 2.11 `npx tsx scripts/qa.ts` (no npm wrapper) — referenced by skill

- **Command:** `npx tsx scripts/qa.ts <original-url> [--clone-url=http://localhost:3000] [--threshold=5]`
- **What it does:** Pixel-diff between two live URLs (original on the web, clone running locally). Outputs to `docs/design-references/qa/`.
- **Targets:** target-agnostic.
- **State:** active. Used by the `/clone-website` skill Phase 4.1.
- **Inconsistency:** Output directory `docs/design-references/qa` vs `verify:parity`'s `<rebuilt>/../parity-report`. Same goal, two output locations, two CLIs.

### 2.12 The Claude skill `/clone-website` — `.claude/skills/clone-website/SKILL.md`

- **Command:** `/clone-website <url1> [<url2> ...] [optional instructions]`
- **What it does:** Natural-language 5-phase pipeline that an LLM agent walks through. Phase 0.3 runs `npm run build` (does not exist). Phase 1.1 runs `npx tsx scripts/extract.ts <url> --output docs/research`. Phase 4.1 runs `npx tsx scripts/qa.ts`. **Does not mention `capture`, `clone-site`, `clone-urls`, `clone-end-to-end`, `build:astro`, or `rebuild-pro` at all.**
- **Output:** `docs/research/page-data.json`, `docs/research/analysis.json`, `docs/research/prompts/`, plus Next.js components under `src/components/` (the skill assumes Next.js scaffold).
- **Targets:** NONE of astro / react / webapp. The skill targets the in-repo Next.js dashboard.
- **State:** ACTIVELY drives Cameron's experience but **points at the legacy `scripts/extract.ts` codepath**, not the capture-based pipeline that the rest of the repo (and CLAUDE.md) uses.

---

## 3. Dependency graph (call relationships)

```
User intent: "clone this URL"
│
├── (A) /clone-website skill ───────────────► scripts/extract.ts  [LEGACY: produces page-data.json, not a clone]
│                                              └─► writes docs/research/page-data.json
│                                              └─► writes docs/research/prompts/*.md
│                                              (then LLM agent hand-builds src/components/*.tsx)
│
├── (B) npm run clone-end-to-end ───────────► scripts/run-clone.ts
│       (a.k.a. clone-page)                    ├─► spawn capture.ts
│                                              ├─► spawn parse-har.ts
│                                              ├─► spawn parse-trace.ts
│                                              └─► spawn clone.ts          → static clone at .../clone/index.html
│
├── (C) npm run clone-site ──────────────────► scripts/clone-site.ts
│                                              ├─► engine/extract/site-crawler.ts
│                                              ├─► loop: spawn capture, parse:har, parse:trace, complete:assets, clone
│                                              ├─► in-proc: buildAstroMulti
│                                              └─► in-proc: runPostEmitMulti
│                                                     ├─► centralize-content
│                                                     ├─► media-preserve
│                                                     ├─► npm run build (inside the emitted project)
│                                                     └─► verify-parity
│
├── (D) npm run clone-urls (also build:astro:multi, build:react:multi) ─► scripts/clone-urls.ts
│                                              ├─► loop: spawn capture, parse:har, parse:trace, complete:assets, clone
│                                              ├─► in-proc: astroAdapter.buildMulti OR reactAdapter.buildMulti
│                                              └─► in-proc: runPostEmitMulti (astro) or runPostEmitMultiReact
│
├── (E) npm run build:<target> ─────────────► scripts/build.ts
│                                              └─► dynamic import: engine/targets/<target>/index.ts → adapter.build
│
├── (F) npm run crawl:webapp ───────────────► scripts/crawl-webapp.ts
│                                              └─► engine/targets/webapp/crawler/  → graph.json + states/
│        npm run audit:capture ──────────────► scripts/audit-capture.ts (alternative deterministic capture)
│                                              └─► shell + plan + execute phases
│
│        Then: npm run build:webapp --crawl-dir=<that> ─► scripts/build.ts → engine/targets/webapp
│
└── (G) npm run rebuild-pro ────────────────► scripts/rebuild-pro.ts
        (--url=<url> branch)                   ├─► spawn clone-page OR clone-site --site (depending on flags)
        (otherwise: <clone-dir> input)         ├─► phases 0-14 via engine/orchestrator/phases.ts
                                                   ├─► spawn: build-astro (i.e. scripts/build.ts --target=astro)
                                                   ├─► spawn: extract:css
                                                   ├─► spawn: extract:tokens
                                                   ├─► spawn: extract:primitives
                                                   ├─► spawn: iconify:svgs
                                                   ├─► spawn: refactor:sections
                                                   ├─► spawn: scope:styles
                                                   ├─► in-proc: wireLayout, centralizeContent, preserveMediaRules
                                                   └─► spawn: verify:parity
```

Note the asymmetry: `clone-site` does the post-emit chain in-process. `clone-urls` does too. `rebuild-pro` does the same chain by **spawning npm scripts** so it can be paused/resumed phase-by-phase. Three different orchestration strategies for the same conceptual pipeline.

---

## 4. Canonical happy path per target

### 4.1 Astro (working, well-tested)

```bash
# Option A: full autonomous (preferred)
npm run clone-site -- https://example.com

# Option B: explicit URL list (when crawler misses pages)
npm run clone-urls -- --urls=urls.txt --target=astro

# Option C: production "pro" rebuild from existing clone
npm run rebuild-pro -- ./clones/example.com-2026-05-22T.../desktop/clone --mode=aggressive
```

Verdict: **Clear-ish.** Three doors all reach a usable Astro project, but the choice between A/B/C is non-obvious. CLAUDE.md mentions all three without explaining when to pick which.

### 4.2 React (intermittently working)

```bash
# Capture + clone first (no React-aware autonomous front door exists for single-page)
npm run clone-end-to-end -- https://example.com

# Then build to React from the clone
npm run build:react -- ./clones/.../desktop/clone

# OR: explicit URL list, multi-page
npm run clone-urls -- --urls=urls.txt --target=react
```

Verdict: **Muddy.** There is no `clone-site --target=react`. `clone-urls --target=react` works but is a multi-page tool that defaults to one viewport. Single-page React goes via two steps (clone-end-to-end → build:react) with NO documented end-to-end command.

### 4.3 Webapp (in progress)

```bash
# Step 1: authenticate (one-time, persistent profile)
npx tsx scripts/login-omni.ts https://app.example.com

# Step 2: capture either via BFS crawler OR audit-capture
npm run crawl:webapp -- https://app.example.com
# OR
npm run audit:capture -- https://app.example.com --routes=/,/posts,/inbox

# Step 3 (optional): recapture each route fresh for clean baselines
npx tsx scripts/recapture-routes.ts --crawl-dir=docs/research/crawl/<host>/<iso>

# Step 4: capture forms (optional, phase 4 work)
npm run capture:forms -- https://app.example.com --plan=forms.yaml --no-dry-run

# Step 5: build to a Vite + React + MSW project
npm run build:webapp -- --crawl-dir=docs/research/crawl/<host>/<iso>

# Step 6: emit-only recovery if step 5 crashed
npx tsx scripts/emit-only.ts --capture-root=... --out=... --name=...
```

Verdict: **Muddy.** Webapp has TWO competing capture strategies (`crawl:webapp` vs `audit:capture`), an optional recapture pass, an optional form capture, and an `emit-only` recovery flow whose defaults are hard-coded to Cameron's old fluid.glass paths.

---

## 5. Redundancy / overlap matrix

| Group | Overlapping commands | What they share | What differs |
|---|---|---|---|
| **A. "Clone one URL end-to-end"** | `npm run clone-end-to-end`, `npm run clone-page`, the skill's `extract.ts` step, `npm run capture && parse:har && parse:trace && clone` (manual) | Goal: produce a runnable static clone of one URL | Aliases vs orchestrator vs legacy. The skill uses `extract.ts` which doesn't produce a clone at all |
| **B. "Clone a whole site"** | `npm run clone-site` (autonomous crawl), `npm run clone-urls` (explicit list) | Multi-page astro/react emit | Crawler vs URL list. Default viewports differ (4 vs 1). Default output path differs (`astro-site` vs `<target>-site-urls`) |
| **C. "Webapp capture"** | `npm run crawl:webapp`, `npm run audit:capture` (+ `:shell` `:plan` `:execute`), `scripts/recapture-routes.ts` | Capture the authed SPA surface | BFS-with-clicks vs deterministic three-phase vs per-route fresh nav |
| **D. "Pixel-diff QA"** | `npm run verify:parity`, `npx tsx scripts/qa.ts`, `npx tsx scripts/qa-sections.ts`, `engine/tests/multi-viewport-parity*.spec.ts`, `scripts/verify-clone.ts` | Compare clone vs original | Live URL vs built directory; full page vs sections; spec vs CLI |
| **E. "Generate a target project from extraction data"** | `npm run generate:astro`, `npm run generate:prototype`, `npm run build:astro`, `npm run build:react`, `npm run build:webapp`, `npm run rebuild-pro` | Emit framework code | `generate:*` consumes legacy `page-data.json`; `build:*` consumes a clone dir; `rebuild-pro` consumes a clone dir AND runs a 14-phase orchestrator on top |
| **F. "Auth helpers"** | `scripts/login-omni.ts`, `scripts/auth-verify.ts`, `test-login.mjs` | Login or probe the persistent Chrome profile | Three different scripts that all `launchPersistentContext` against `~/.config/playwright-pinterest` |
| **G. "Verify a running clone"** | `scripts/verify-clone.ts`, `scripts/verify-interactions.ts`, `scripts/verify-key-clicks.ts`, `verify-key-clicks-v2.ts`, `scripts/verify-posts-menu.ts`, `scripts/verify-tabs-and-toasts.ts`, `scripts/verify-toast.ts`, `scripts/inspect-live.ts`, `scripts/inspect-selector-resolution.ts`, `auto-probe.mjs`, `full-diag.mjs` | Hit a localhost dev server and assert something | Mostly hard-coded to omnichannel-clone paths, single-use, never generalised |

### 5.1 Top three worst overlaps

1. **"Clone one URL"** — five plausible commands (`/clone-website` skill, `clone-end-to-end`, `clone-page`, manual capture+clone, or `extract.ts`-and-LLM-build). They produce *different artifacts* (skill produces Next.js code; the others produce a static clone or a framework project).
2. **Capture pipeline output location** — `capture` writes to `docs/research/captures/`. CLAUDE.md says clones go to `clones/`. `rebuild-pro` writes to `<clone-dir>/../astro-pro/`. `emit-only.ts` hard-codes `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/`. `verify-clone.ts` hard-codes `/Users/cameronmcallister/Github/omnichannel-clone/docs/verify-clone`. No single output policy.
3. **QA / parity verification** — `verify:parity` (rebuilt dir vs clone dir, pixelmatch), `scripts/qa.ts` (live URL vs clone URL, pixelmatch), `scripts/qa-sections.ts` (section-by-section), the `test:parity:*` specs (multi-viewport), and the dozen `scripts/verify-*.ts` scratch files. All claim to "verify the clone".

---

## 6. The "what would Claude pick?" simulation

If Cameron asks Claude "clone https://example.com with dr-parity" today, here are the 5-7 plausible routes Claude could land on and **why** each one exists in a state that makes it land-able:

### Route 1 — `/clone-website` skill

- **Why Claude picks it:** The user said "clone", the skill description starts with "Reverse-engineer and clone any website…", and it's `user-invocable: true`. The instruction tier 0 in CLAUDE.md auto-routes "clone any website" verbs to this skill.
- **What actually happens:** Claude runs `npx tsx scripts/extract.ts <url> --output docs/research`. That writes `page-data.json` and `prompts/`. Then Claude is expected to **hand-build Next.js components** from those prompts. No capture pipeline, no static clone, no astro/react target.
- **Hidden cost:** Diverges completely from the rest of the repo. Most users probably don't realise the skill bypasses `capture`/`clone`/`build`.

### Route 2 — `npm run clone-site -- <url>`

- **Why Claude picks it:** Listed prominently in `CLAUDE.md` under "Full Clone Pipeline" as the example command. Name reads like the right verb.
- **What actually happens:** Autonomous crawl + capture + clone + Astro emit. Lands on a runnable Astro project.
- **Hidden cost:** Bypasses the skill entirely. No QA loop. Astro only.

### Route 3 — `npm run clone-end-to-end` (or `clone-page`)

- **Why Claude picks it:** The verb "clone" + the helper text in CLAUDE.md's example block (`npm run clone-site` literally calls `run-clone.ts` for one-shot mode, which then suggests the alias).
- **What actually happens:** Capture → parse → static clone. No framework target.
- **Hidden cost:** Stops at "static clone" — user usually wants more.

### Route 4 — `npm run capture -- <url>` (then "I'll figure out the rest")

- **Why Claude picks it:** It's the most literal-sounding script and is documented at length in CLAUDE.md. Claude may use it as the first step before deciding the next.
- **What actually happens:** Just captures. User has to remember to run `parse:har`, `parse:trace`, `clone`, `build:*` in sequence.
- **Hidden cost:** Five-step chore that `run-clone.ts` already orchestrates.

### Route 5 — `npm run rebuild-pro -- --url=<url>`

- **Why Claude picks it:** The word "pro" implies "the best one". Has a `--url=` flag that takes a URL directly. Has `--site` for multi-page.
- **What actually happens:** Delegates to `clone-page` or `clone-site` first, then runs 14-phase orchestration on top.
- **Hidden cost:** Very heavy. Aggressive mode can degrade parity. Hard to interrupt cleanly.

### Route 6 — `npm run build:astro -- <clone-dir>` (or `build:react`, `build:webapp`)

- **Why Claude picks it:** It's the highest-fidelity name match for "build a clone of this site". Common Next.js mental model: `npm run build`.
- **What actually happens:** **Errors immediately** — `build:astro` requires an already-cloned `<clone-dir>`. Doesn't accept a URL.
- **Hidden cost:** Confusion. User has to learn that "build" means "build framework from clone" and is step 5 of 5.

### Route 7 — `npx playwright install` followed by hand-rolling

- **Why Claude picks it:** When everything looks broken (skill fails, npm scripts confuse). The repo has 12+ `scripts/verify-*.ts` and `auto-probe.mjs` files that look like ad-hoc Playwright runners.
- **What actually happens:** Cameron's old debugging scripts get run on the wrong site.
- **Hidden cost:** Pure entropy.

---

## 7. Surprises uncovered

1. **The `/clone-website` skill points at the wrong pipeline.** `.claude/skills/clone-website/SKILL.md:62` runs `scripts/extract.ts`, which is the legacy `page-data.json` extractor. It bypasses `capture`/`clone`/`build` entirely. Anyone who uses the skill never touches the actual cloning engine.
2. **`npm run build` does not exist** but the skill's Phase 0.3 (line 31) tells the agent to run it as a verification step. So does Phase 3.1 (line 234), Phase 3.3 (line 308). Three different lines in the skill assume a script that isn't in `package.json`.
3. **`scripts/emit-only.ts` has hard-coded absolute paths** for `fluid.glass` recovery (`/Users/cameronmcallister/Desktop/github/dr-parity/...` and `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/fluid-glass`). It's listed as a generic recovery tool but defaults to a single specific clone.
4. **Three different "names" for the same script.** The npm key is `clone-end-to-end`, the file is `scripts/run-clone.ts`, and its HELP text identifies itself as `dr-parity clone-site (end-to-end)`. Meanwhile `clone-site.ts` ALSO uses `dr-parity clone-site` in its HELP text. Two scripts, one display name.
5. **Webapp has two complete capture paradigms.** `crawl:webapp` (BFS with clicks) and `audit:capture` (deterministic shell+plan+execute). Both exist in `package.json`. There's no documentation comparing them or saying when to pick which.
6. **`parse:all` is broken without an env var.** `npm run parse:all` uses `$npm_config_dir` (line 46 of package.json) which requires the user to pass `--dir=<path>`. That convention is documented nowhere.
7. **The Docker setup targets the wrong app.** `Dockerfile` and `docker-compose.yml` are clearly the original Next.js dashboard template (multi-stage `next.js` build, copies `.next/standalone`, runs `server.js`). They have nothing to do with the clone engine. `Dockerfile.dev` runs `npm run dev`, which is not declared in `package.json` — broken.
8. **Eleven hard-coded "verify" scripts** all target `http://localhost:5173` (the old omnichannel-clone Vite port) and reference paths under `/Users/cameronmcallister/Github/omnichannel-clone/`. They're not in the dr-parity universe at all — they're leftovers from a sibling project.
9. **`auto-probe.mjs`, `full-diag.mjs`, `test-login.mjs`** at the repo root are scratch diagnostics for omnisocials.com that were never moved into `scripts/` or documented. They sit next to `package.json` looking like first-class entry points.
10. **`/clone-website` slash-command and the skill have separate frontmatter.** Both declare `argument-hint`, both declare `description`. They are auto-synced by `scripts/sync-skills.mjs` but the slash-command file is hand-edited at `.claude/commands/clone-website.md`. Two sources, one truth claim each.
11. **`build:astro`'s shim `build-astro` (`scripts/build-astro.ts`) is what `engine/orchestrator/phases.ts:44` spawns.** So phase 0 of `rebuild-pro` calls the SHIM rather than `build.ts` directly, adding a layer of indirection that exists purely for backward compatibility.

---

## 8. Folder structure observations

- `docs/research/captures/` — actual capture output (active)
- `docs/research/crawl/` — webapp crawler output (active)
- `docs/research/audit/` — audit-capture output (active)
- `docs/research/forms/` — form-capture output (active)
- `docs/research/` (root) — legacy `extract.ts` output (`page-data.json`, `analysis.json`, `prompts/`) (legacy but still actively written by the skill)
- `docs/design-references/qa/` — `scripts/qa.ts` output (skill workflow)
- `clones/` — declared in `CLAUDE.md` as the default clone output but actually unused by `clone-site`/`clone-urls`. Used only by `build.ts` and `build-html-mirror.ts` defaults
- `<clone-dir>/../astro-pro/` — `rebuild-pro` output
- `<clone-dir>/../parity-report/` — `verify:parity` output
- `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/` — `emit-only.ts` and `seo-backfill.mts` hard-coded output

No single output policy. Six different conventions in active use.

---

## 9. Suggested consolidation hooks (not a plan, just signal for Agent 4)

- The `TargetAdapter` contract in `engine/targets/types.ts` already unifies astro/react/webapp at the build step. `scripts/build.ts` already dispatches via target. **A `parity clone <url> <target>` command can plausibly be implemented as a thin wrapper that:**
  1. Always calls `scripts/capture.ts` (or the webapp equivalent)
  2. Always calls `parse:har` + `parse:trace`
  3. Always calls `scripts/clone.ts`
  4. Calls the right `engine/targets/<target>/index.ts` via the existing adapter
  5. Optionally runs the post-emit chain (centralise + media-preserve + verify)
- The `/clone-website` skill needs to be rewritten or retired. Its current instructions describe a parallel universe pipeline.
- `Dockerfile` / `docker-compose.yml` / `Dockerfile.dev` need a decision: delete them or fix them to target the engine.
- The 11 `scripts/verify-*.ts` files and 3 root `.mjs` files are dead weight and should be moved to `scripts/_archive/` or deleted.
- `scripts/emit-only.ts` should drop the hard-coded fluid.glass defaults — they make it a one-shot tool dressed up as a CLI.

---

## Appendix A: Quick reference — every entry point one-liner

```
npm run typecheck                            # tsc --noEmit
npm run check                                # alias for typecheck (misnamed)
npm run capture -- <url> [--mode] [--vp]     # Playwright capture (foundational)
npm run parse:har -- <capture-dir>           # HAR → parsed/{styles,scripts,assets}
npm run parse:trace -- <capture-dir>         # trace.zip → dom-snapshots.jsonl
npm run parse:all -- --dir=<capture-dir>     # both (requires $npm_config_dir)
npm run complete:assets -- <capture-dir>     # fetch missing CSS-referenced URLs
npm run clone -- <capture-dir>               # static 1:1 clone from a capture
npm run clone-page -- <url>                  # alias of clone-end-to-end
npm run clone-end-to-end -- <url>            # capture→parse→clone (single URL)
npm run clone-site -- <entry-url>            # autonomous crawl + clone + astro
npm run clone-urls -- --urls=urls.txt        # explicit list + clone + astro/react
npm run build:astro -- <clone-dir>           # astro emit from a clone
npm run build:react -- <clone-dir>           # react emit from a clone
npm run build:webapp -- --crawl-dir=<dir>    # webapp emit from a crawl
npm run build:astro:multi -- --urls=...      # alias of clone-urls --target=astro
npm run build:react:multi -- --urls=...      # alias of clone-urls --target=react
npm run build-astro -- <clone-dir>           # shim → build.ts --target=astro
npm run crawl:webapp -- <startUrl>           # webapp BFS crawler
npm run capture:forms -- <appUrl> --plan=... # webapp form-state capture
npm run audit:capture -- <startUrl>          # webapp deterministic shell+plan+execute
npm run audit:shell -- <startUrl>            # webapp audit phase 1
npm run audit:plan -- <auditDir>             # webapp audit phase 2
npm run audit:execute -- <auditDir>          # webapp audit phase 3
npm run rebuild-pro -- <clone-dir>           # 14-phase astro pro pipeline
npm run rebuild-pro -- --url=<url> [--site]  # same, with capture step
npm run extract:css -- <clone-dir>           # wave 1 css extractor
npm run extract:primitives -- <analysis-dir> # wave 2 primitives
npm run extract:tokens -- <analysis-dir>     # wave 2 tokens
npm run extract:animations -- <clone-dir>    # static animation extractor
npm run extract:library -- ...               # section library catalogue
npm run iconify:svgs -- <clone-dir>          # extract inline SVGs
npm run scope:styles -- <analysis-dir>       # scoped per-component css
npm run refactor:sections -- ...             # wave 3 section refactor
npm run centralize:content -- <out-dir>      # extract editable copy
npm run generate:edit-playbook -- <root>     # EDIT.md generator
npm run generate:prototype                   # legacy: page-data.json → react prototype
npm run generate:astro                       # legacy: page-data.json → astro
npm run generate:prototype:fixture           # fixture replay (prototype)
npm run generate:astro:fixture               # fixture replay (astro)
npm run verify:parity -- --clone=... --rebuilt=... # pixel-diff dirs
npm run test:parity:astro                    # multi-viewport spec (astro)
npm run test:parity:react                    # multi-viewport spec (react)
npm run check:html-rewriter                  # smoke test
npm run check:astro-emit                     # smoke test
npm run check:refactor                       # smoke test
npm run check:scope-styles                   # smoke test
npm run check:prettify                       # smoke test
npm run preview                              # serve

# tsx-only (no npm wrapper):
npx tsx scripts/extract.ts <url>             # LEGACY: page-data.json (used by the skill!)
npx tsx scripts/extract-multi.ts <url>       # legacy multi-page
npx tsx scripts/qa.ts <orig-url>             # pixel-diff (live URLs) — used by the skill
npx tsx scripts/qa-sections.ts <orig-url>    # section-by-section qa
npx tsx scripts/emit-only.ts ...             # recovery: emit from frozen capture
npx tsx scripts/recapture-routes.ts ...      # per-route fresh nav pass
npx tsx scripts/build-html-mirror.ts ...     # static HTML mirror from crawl
npx tsx scripts/login-omni.ts <url>          # persistent profile login
npx tsx scripts/auth-verify.ts <url>         # persistent profile probe
npx tsx scripts/seo-backfill.mts             # one-shot seo backfill (hard-coded paths)
npx tsx scripts/inspect-live.ts              # experimental
npx tsx scripts/inspect-selector-resolution.ts # experimental
npx tsx scripts/verify-clone.ts              # experimental (hard-coded)
npx tsx scripts/verify-interactions.ts       # experimental (hard-coded)
npx tsx scripts/verify-key-clicks.ts         # experimental (hard-coded)
npx tsx scripts/verify-key-clicks-v2.ts      # experimental (hard-coded)
npx tsx scripts/verify-posts-menu.ts         # experimental (hard-coded)
npx tsx scripts/verify-tabs-and-toasts.ts    # experimental (hard-coded)
npx tsx scripts/verify-toast.ts              # experimental (hard-coded)
node scripts/download-assets.mjs             # one-shot asset downloader (hard-coded)
node scripts/sync-skills.mjs                 # regenerate per-platform skill files
bash scripts/sync-agent-rules.sh             # regenerate per-platform agent rules
node auto-probe.mjs                          # scratch diagnostic (localhost:5173)
node full-diag.mjs                           # scratch diagnostic (omnisocials)
node test-login.mjs                          # scratch diagnostic (persistent profile)

# Claude Code:
/clone-website <url> [<url2> ...]            # the user-facing skill (legacy pipeline!)
.claude/commands/clone-website.md            # slash-command file (thin delegate)
```

---

## Round 2: Follow-up Answers

> Read-only forensic follow-up. No code modified. Cross-references the inventory in sections 1 to 9 above.

### A. Winners and losers — the five "clone one URL" routes, classified

The five plausible front doors for "clone one URL" identified in section 6, judged head-to-head:

#### A.1 `/clone-website` skill (`.claude/skills/clone-website/SKILL.md`)

- **Verdict:** DEPRECATE (the current SKILL.md body). REPLACE with a new, thin SKILL.md that wraps the canonical CLI path.
- **Who calls it today:** End-user via `/clone-website <url>` slash-command and via natural-language clone requests routed by Claude.
- **Unique production:** `docs/research/page-data.json`, `docs/research/prompts/section-*.md`, hand-built `src/components/*.tsx` Next.js components. Also produces `docs/animations/ANIMATIONS.md` (Phase 5) and `docs/research/CHROME_MCP_FINDINGS.md` (Phase 1.2). NONE of the capture-based routes produce these.
- **Replacement cost:** Medium. The Chrome-MCP visual verification pass (Phase 1.2), the animation documentation step (Phase 5), and the side-by-side QA loop (Phase 4.3) are NOT captured by any other route. These behaviors need to survive in the new skill. The legacy `scripts/extract.ts` codepath itself should be retired.
- **Risk if removed as-is:** Loses the LLM-driven Chrome MCP visual verification pass and the animation documentation generator. Both are uniquely valuable and must be preserved in V2.0 as steps that run AFTER the canonical CLI pipeline, not instead of it.
- **REGRESSION FLAG:** This is the ONLY route that produces (a) Chrome MCP visual verification findings and (b) human-readable `ANIMATIONS.md` catalogue documentation. Preserve those two outputs.

#### A.2 `npm run clone-end-to-end` (`scripts/run-clone.ts`)

- **Verdict:** KEEP-AS-PRIMARY for "clone one URL".
- **Who calls it today:** `npm run clone-page` (pure alias). Likely the most-used single-page entry by humans because the verb maps clean. Not called from any orchestrator.
- **Unique production:** End-to-end static 1:1 clone for a single URL across all four viewports in one command. Output: `docs/research/captures/<host>/<iso>/<viewport>/clone/index.html`.
- **Replacement cost:** Zero — it already chains `capture → parse:har → parse:trace → clone` cleanly. This IS the canonical happy path; everything else just adds work on top.
- **Risk if removed:** High. Loses the single-command single-URL flow. The four-step manual chain is what `run-clone.ts` already abstracts.

#### A.3 `npm run clone-page` (`scripts/clone-page.ts`)

- **Verdict:** MERGE-INTO `clone-end-to-end` — keep one name, drop the other.
- **Who calls it today:** Nothing in-tree calls it. Pure user-facing alias.
- **Unique production:** Nothing. It is a `spawn('npx', ['tsx', 'scripts/run-clone.ts', ...args])` wrapper.
- **Replacement cost:** Trivial. Pick one name (recommend `parity clone <url>` post-rename) and delete the other npm key + file.
- **Risk if removed:** None. Two npm keys for one operation is pure noise.

#### A.4 `npm run capture` (`scripts/capture.ts`)

- **Verdict:** KEEP-AS-INTERNAL.
- **Who calls it today:** `run-clone.ts`, `clone-site.ts`, `clone-urls.ts` all spawn it. Direct human use is occasional (for the three modes `launch | cdp | persistent` when a logged-in profile is needed).
- **Unique production:** Raw Playwright capture (HAR + trace + video + screenshot) per viewport. Foundation of every downstream clone. Only place that supports CDP and persistent-context modes.
- **Replacement cost:** Infinite — nothing else captures.
- **Risk if removed:** Catastrophic. The entire pipeline collapses.
- **Recommendation:** Expose it as `parity capture` in V2.0 for advanced use (auth flows, debugging), but the primary `parity clone` command should call it internally so users never need to remember the four-step chain.

#### A.5 `scripts/extract.ts` (the skill's current Phase 1.1 target)

- **Verdict:** DEPRECATE.
- **Who calls it today:** The `/clone-website` skill (Phase 1.1, line 63 of SKILL.md). Also `scripts/generate-prototype.ts` and `scripts/generate-astro.ts` consume its output `page-data.json` (the legacy "extract → generate" pipeline).
- **Unique production:** `docs/research/page-data.json`, `docs/research/analysis.json`, `docs/research/prompts/section-*.md`. These ARE used by the legacy `generate:*` scripts but nothing else in the active pipeline reads them.
- **Replacement cost:** Medium. The runtime animation monitor injection (`injectAnimationMonitors`) and the section-prompt generator (`prompts/section-*.md`) are uniquely useful and not replicated in the capture pipeline. If those capabilities matter for V2.0, they need to be ported into `engine/extract/` proper.
- **Risk if removed:** The `/clone-website` skill stops working until rewritten (which is the point). The legacy `generate:*` commands die — they are already marked "legacy" in the inventory (rows 3-6 of section 1.1).
- **REGRESSION FLAG:** Runtime animation monitor (`injectAnimationMonitors`) shimming `IntersectionObserver` / `Element.animate` / scroll listeners has no equivalent in the capture pipeline. If V2.0 needs that data, port it into `engine/extract/capture/` as an additional capture pass, not as a parallel codepath.

#### A.6 The manual chain `capture && parse:har && parse:trace && clone`

- **Verdict:** DEPRECATE as a documented front door. Keep the underlying scripts (already classified as KEEP-AS-INTERNAL).
- **Who calls it today:** CLAUDE.md "Ad-hoc steps" section documents it. No script consumes it as a unit.
- **Unique production:** Nothing — identical to `clone-end-to-end`.
- **Replacement cost:** Zero — `clone-end-to-end` IS this chain.
- **Risk if removed from docs:** None. Removes a confusion source.

#### A.7 Companion classification (mentioned implicitly): `clone-site` and `clone-urls`

Not strictly "clone one URL" doors, but they shadow it.

- **`npm run clone-site`** → KEEP-AS-PRIMARY for "clone a whole site (autonomous)". Unique production: BFS crawl + multi-page Astro emit with shared component extraction. No other route does this autonomously.
- **`npm run clone-urls`** → KEEP-AS-PRIMARY for "clone a whole site (explicit URL list)". Unique production: URL-list multi-page with `--target=react` OR `--target=astro` plus post-emit chain. Only multi-page route that supports React.

### B. The `/clone-website` skill divergence — step-by-step diff

#### B.1 What Claude does TODAY when a user runs `/clone-website <url>`

Citing SKILL.md line numbers as the source of truth.

1. **Phase 0.1 (lines 22-24):** Parse URL(s) from `$ARGUMENTS`. No CLI call.
2. **Phase 0.2 (lines 26-28):** Verify Chrome MCP / Playwright MCP / Browserbase / Puppeteer MCP is available. Asks user if none found.
3. **Phase 0.3 (lines 30-32):** Runs `npm run build`. **BROKEN — script does not exist in package.json.**
4. **Phase 0.4 (lines 34-40):** `mkdir -p docs/research docs/design-references docs/animations public/fonts public/images public/videos public/seo`.
5. **Phase 0.5 (lines 42-52):** `npx playwright --version`, then `npx playwright install chromium` if missing.
6. **Phase 1.1 (lines 60-94):** Runs `npx tsx scripts/extract.ts <url> --output docs/research`. **This is the LEGACY extractor.** Produces `docs/research/page-data.json`, `docs/research/prompts/section-*.md`. Does NOT use `engine/extract/capture/*`, does NOT produce a `capture/` directory, does NOT produce HAR/trace/screenshots in the canonical layout.
7. **Phase 1.2 (lines 96-112):** Chrome MCP visual verification, screenshots saved to `docs/design-references/`, findings into `docs/research/CHROME_MCP_FINDINGS.md`. *(This step has no equivalent in the canonical pipeline.)*
8. **Phase 1.3 (lines 114-124):** Validate `docs/research/page-data.json` shape — confirms `scripts/extract.ts` output.
9. **Phase 2.1-2.5 (lines 128-197):** "Analysis" — described as running logic from `engine/analyze/topology.ts`, `design-tokens.ts`, `component-tree.ts`, `behavior-model.ts`. Saves to `docs/research/analysis.json`. **There is NO CLI that runs these as a unit.** The skill expects the LLM to coordinate by hand. `npm install <packages>` step at the end.
10. **Phase 3.1 (lines 205-238):** LLM hand-writes `src/app/globals.css`, `src/app/layout.tsx`, `src/components/icons.tsx`. Runs `npm run build`. **BROKEN — script does not exist.**
11. **Phase 3.2 (lines 240-292):** Dispatches builder agents in parallel, each reads `docs/research/prompts/section-{id}-{name}.md`, writes `src/components/{ComponentName}.tsx`. Worktree-per-builder, merge after.
12. **Phase 3.3 (lines 294-312):** Assemble `src/app/page.tsx`. Run `npm run build`. **BROKEN.**
13. **Phase 4.1 (lines 322-337):** `npm run dev &` (**BROKEN — script does not exist**), then `npx tsx scripts/qa.ts <url> --clone-url http://localhost:3000 --threshold 5`.
14. **Phase 4.2 (lines 342-351):** Read `docs/design-references/qa/qa-report.json`, gate on >=95%/90-95%/<90% match.
15. **Phase 4.3 (lines 353-377):** Chrome MCP side-by-side comparison, click/hover/scroll testing.
16. **Phase 4.4 (lines 379-393):** Dispatch fix agents, re-run `scripts/qa.ts`. Max 3 iterations.
17. **Phase 5 (lines 397-430):** LLM hand-writes `docs/animations/ANIMATIONS.md` from `page-data.json` `AnimationSpec` data.

#### B.2 What SHOULD happen (canonical engine path)

The canonical path the REST of the repo uses:

1. **Pre-flight:** `npm run typecheck` (the only verification script that exists). `npx playwright install chromium` if needed.
2. **Capture + parse + static clone:** `npm run clone-end-to-end -- <url>`. This already chains `capture → parse:har → parse:trace → clone`. Output: `docs/research/captures/<host>/<iso>/<viewport>/clone/index.html`.
3. **Build to target:** Either `npm run build:astro -- <clone-dir>` or `npm run build:react -- <clone-dir>` against the per-viewport `clone/` directory from step 2.
4. **(Optional) Post-emit chain:** `npm run rebuild-pro -- <clone-dir>` for the full 14-phase pipeline (CSS extract, tokens, primitives, refactor, scope styles, centralise content, verify parity).
5. **Pixel-diff QA:** `npm run verify:parity -- --clone=<clone-dir> --rebuilt=<rebuilt-dir>` (built dir vs clone dir), OR `npx tsx scripts/qa.ts <original-url> --clone-url=<local-url>` (live URLs).

For multi-page sites, replace step 2 with `npm run clone-site -- <url>` (autonomous) or `npm run clone-urls -- --urls=urls.txt --target=astro|react`.

#### B.3 The diff — every place the skill drifted

| Concern | Skill says (today) | Canonical path | Severity |
|---|---|---|---|
| Build verification | `npm run build` (lines 31, 234, 308, 326) | `npm run typecheck` (the only verification that exists) | BROKEN — 4 references to a non-existent script |
| Dev server | `npm run dev &` (line 326) | No `dev` script exists. The captured clone is `npx serve <dir>`; the rebuilt project has its own framework dev server | BROKEN |
| Extraction | `npx tsx scripts/extract.ts` (legacy `page-data.json` producer) (line 63) | `npm run clone-end-to-end` (capture → parse → clone) | WRONG PIPELINE — two parallel codepaths, neither knows the other exists |
| Output layout | `docs/research/page-data.json`, `docs/research/prompts/`, `src/components/`, `public/` (Next.js scaffold) | `docs/research/captures/<host>/<iso>/<viewport>/clone/` then `<target>-site/` | INCOMPATIBLE — skill targets the in-repo Next.js dashboard, canonical pipeline emits standalone Astro/React projects |
| Target framework | Next.js (hard-assumed throughout Phase 3 — `app/`, `globals.css`, `layout.tsx`, `next/font`) | astro / react / webapp via `TargetAdapter` | WRONG STACK — the skill targets a framework not in the active build matrix |
| Analysis step | LLM coordinates calls to `engine/analyze/*` functions by hand (Phases 2.1-2.5) | No CLI exposes these as a unit; `rebuild-pro` calls them as orchestrated phases | NO ENTRY POINT — skill describes work nobody can run |
| Component generation | LLM dispatches "builder agents" reading `prompts/section-*.md` | `engine/targets/astro/index.ts`/`react/index.ts` `adapter.build` | DUPLICATE — two ways to generate components, only one is tested |
| QA tool | `scripts/qa.ts` (live vs live) | `verify:parity` (clone vs rebuilt) AND/OR `qa.ts` for live | INCOMPLETE — skill never uses `verify:parity`, the more rigorous tool |
| Animation docs | LLM hand-writes `docs/animations/ANIMATIONS.md` from `page-data.json` (Phase 5) | No equivalent in canonical pipeline | UNIQUE — only the skill produces this; preserve it |
| Chrome MCP verification | Phase 1.2 visual pass | No equivalent in canonical pipeline | UNIQUE — only the skill does this; preserve it |

#### B.4 Fixes to make the skill a thin wrapper

1. **Delete Phase 0.3 entirely.** Replace with `npm run typecheck` if any verification is needed before starting.
2. **Replace Phase 1.1.** Swap `npx tsx scripts/extract.ts` for `npm run clone-end-to-end -- <url>` (single page) or `npm run clone-site -- <url>` (multi-page). Update the description of what gets produced (captures, parsed artefacts, static clone — not `page-data.json`).
3. **Replace Phase 1.3 validation.** Validate `<capture-dir>/manifest.json`, the per-viewport `clone/manifest.json`, and verify `parsed/document.html` exists. Drop `page-data.json` references.
4. **Move Phase 1.2 (Chrome MCP) AFTER the static clone exists.** Compare static clone in browser against the live URL. This is the unique value the skill adds — preserve it but reorder.
5. **Reframe Phase 2 entirely.** Either (a) call `npm run rebuild-pro` to run the analysis + emit chain via the existing orchestrator, or (b) explicitly call `npm run build:astro -- <clone-dir>` (or react/webapp) for the simple case. Stop describing analysis as a thing the LLM coordinates by hand.
6. **Delete Phase 3.1.** The target adapter writes `globals.css`, `layout.tsx`, `icons.tsx` (or their framework equivalents) automatically. Skill should not pretend to hand-write them.
7. **Replace Phase 3.2's "builder agent" model with the `TargetAdapter` invocation.** Builder prompts (`docs/research/prompts/`) are a `scripts/extract.ts` byproduct that doesn't exist in the capture pipeline. They need to be either ported or dropped.
8. **Replace Phase 3.3's `npm run build`** with `npm run build` *inside the emitted project directory* (`<target>-site/`), or `npm run typecheck` at the repo root if Cameron wants a sanity check.
9. **Replace Phase 4.1's `npm run dev`** with `cd <target>-site && npm run dev` (the emitted project has its own scripts) or `npm run preview` (which is `serve`) against the static clone directly.
10. **Keep Phase 4.1's `scripts/qa.ts` invocation** — it works. Optionally add `verify:parity` for clone-vs-rebuilt comparison.
11. **Keep Phase 4.3 (Chrome MCP side-by-side) and Phase 5 (ANIMATIONS.md)** as the LLM's unique contribution.
12. **Update Phase 0.4** to drop the Next.js-flavoured directory list (`public/fonts`, `public/images`, etc.) since the canonical pipeline manages its own asset directories under each capture.

After these changes the skill becomes: `pre-flight → call clone-end-to-end → call build:<target> → Chrome MCP visual verify → run qa.ts → fix iteration → generate ANIMATIONS.md`. ~50% shorter, ~100% functional.

### C. Single canonical output convention for V2.0

Currently there are six concurrent output conventions (documented in section 8 above). The proposal: **everything lives under `clones/<target-name>/<timestamp>/` with a fixed sub-structure.**

#### C.1 Proposed layout

```
clones/
  <target-name>/                        # Cameron-chosen short name (e.g. "stripe", "linear"). If not given, derived from URL host
    <iso-timestamp>/                    # 2026-05-22T14-30-00Z (colons replaced with dashes for filesystem safety)
      manifest.json                     # Top-level: source url(s), target name, host, timestamp, viewports, target framework, status, durations
      logs/
        capture.log
        parse.log
        clone.log
        build.log
        verify.log
      captures/                         # Raw Playwright output (current docs/research/captures/<host>/<iso>/)
        <viewport>/                     # desktop | tablet | mobile | wide
          screenshot.png
          network.har                   # or network.json for cdp/persistent
          trace.zip
          video/                        # launch mode only
      parsed/                           # Output of parse:har + parse:trace, per viewport
        <viewport>/
          document.html
          document.url
          styles/{<sha8>.css, index.json}
          scripts/{<sha8>.js, index.json}
          assets/{<sha8>.<ext>, index.json}
          asset-manifest.json
          skipped.json
          dom-snapshots.jsonl
          trace-manifest.json
      clones/                           # Per-viewport static 1:1 clone (current <viewport>/clone/)
        <viewport>/
          index.html
          styles/<sha8>.css
          scripts/<sha8>.js
          assets/<sha8>.<ext>
          manifest.json
      crawl/                            # ONLY for multi-page: BFS crawler output (current docs/research/crawl/...)
        graph.json
        states/
        routes/
      audit/                            # ONLY for webapp audit-capture (current docs/research/audit/...)
        shell/
        plan/
        execute/
      sites/                            # Emitted framework projects (current <captureRoot>/astro-site/ etc.)
        astro/                          # Only present if user built astro target
        react/                          # Only present if user built react target
        webapp/                         # Only present if user built webapp target
      reports/                          # All QA / verification output (consolidating docs/design-references/qa/ + parity-report/)
        qa/
          qa-report.json
          diff-<viewport>.png
        parity/
          parity-report.json
          parity-report.md
          parity-<viewport>.png
        animations/
          ANIMATIONS.md                 # The skill's Phase 5 output, moved here
        chrome-mcp/
          CHROME_MCP_FINDINGS.md        # The skill's Phase 1.2 output, moved here
```

#### C.2 Naming rules

- **Target name first, not host first.** This matters because Cameron tends to clone the same host repeatedly (`stripe.com` v1, v2, v3) and human-meaningful names like `stripe-payments` or `linear-redesign` index faster than `stripe.com-2026-05-22T14-30-00Z`. The host is preserved in `manifest.json`.
- **Default target name if none given:** Derive from the URL host with the TLD dropped (`stripe.com` → `stripe`, `app.linear.app` → `linear-app`).
- **Timestamp format:** ISO 8601 with colons replaced by dashes for filesystem safety: `2026-05-22T14-30-00Z`. Sortable lexicographically. Never use locale-dependent formats.
- **Multi-page differs from single-page** only in the presence of `crawl/` and `audit/` directories, plus a `pages: [...]` array in `manifest.json` listing the discovered URLs and their per-page capture subdirectories. Per-page captures go under `captures/<viewport>/pages/<slugified-pathname>/` rather than at the root of `captures/<viewport>/`.
- **Where logs live:** Always `logs/` at the run root. One file per pipeline stage. Plus stdout/stderr is teed live to the terminal for human visibility.

#### C.3 Why this convention

- **Single root makes archival trivial.** `mv clones/<target>/ ~/Archive/` moves a complete clone with everything needed to inspect, rebuild, or compare it. Current layout requires picking pieces from four different parent directories.
- **`clones/` matches CLAUDE.md's stated convention** ("All generated clones default to `clones/<host>-<iso-timestamp>/`"). Today nothing actually writes there except `build.ts` defaults — the real captures land in `docs/research/captures/`. The proposal makes the documented behaviour real.
- **Target-name-first is human-indexable.** Cameron's recall pattern is "the stripe clone from last week", not "the 2026-05-15 clone".
- **`reports/` consolidates ALL QA output.** Today three different tools write to three different locations (`docs/design-references/qa/`, `<rebuilt>/../parity-report/`, `docs/animations/`). Consolidating means a clone is fully self-describing.

#### C.4 Scripts that must change to comply

| Script | Current default | New default |
|---|---|---|
| `scripts/capture.ts` | `docs/research/captures/<host>/<iso>/` | `clones/<target>/<iso>/captures/` |
| `scripts/parse-har.ts` | sibling `parsed/` next to capture | `clones/<target>/<iso>/parsed/<viewport>/` |
| `scripts/parse-trace.ts` | sibling `parsed/` next to capture | `clones/<target>/<iso>/parsed/<viewport>/` |
| `scripts/clone.ts` | `<capture-dir>/clone/` | `clones/<target>/<iso>/clones/<viewport>/` |
| `scripts/clone-site.ts` | `docs/research/captures/<host>/<iso>/` + `astro-site/` | `clones/<target>/<iso>/captures/` + `clones/<target>/<iso>/sites/astro/` |
| `scripts/clone-urls.ts` | same as clone-site plus `<target>-site-urls/` | same target, `sites/<target-framework>/` |
| `scripts/run-clone.ts` | `docs/research/captures` | `clones/<target>/<iso>/` |
| `scripts/clone-page.ts` | inherits from run-clone | inherits from run-clone (or deprecate as per A.3) |
| `scripts/build.ts` | `clones/<host>-<iso>/` (close to spec already) | `clones/<target>/<iso>/sites/<target>/` |
| `scripts/build-astro.ts` | shim → build.ts | same shim, updated path |
| `scripts/crawl-webapp.ts` | `docs/research/crawl/<host>/<iso>/` | `clones/<target>/<iso>/crawl/` |
| `scripts/audit-capture.ts` | `docs/research/audit/<host>/<iso>/` | `clones/<target>/<iso>/audit/` |
| `scripts/capture-form-states.ts` | `docs/research/forms/` | `clones/<target>/<iso>/forms/` |
| `scripts/qa.ts` | `docs/design-references/qa/` | `clones/<target>/<iso>/reports/qa/` |
| `scripts/qa-sections.ts` | same as qa.ts | same as qa.ts |
| `scripts/verify-parity.ts` | `<rebuilt>/../parity-report/` | `clones/<target>/<iso>/reports/parity/` |
| `scripts/rebuild-pro.ts` | `<clone-dir>/../astro-pro/` | `clones/<target>/<iso>/sites/astro/` (collapsing astro-pro into astro since "pro" is just orchestration depth, not a separate target) |
| `scripts/emit-only.ts` | hard-coded `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/` | `clones/<target>/<iso>/sites/<target>/` (delete hard-coded fallback) |
| `scripts/seo-backfill.mts` | hard-coded `/Users/cameronmcallister/Downloads/SPLIT TEST DR PARITY/` | deprecate or accept a `--clone-root` arg |
| `scripts/verify-clone.ts` | hard-coded `/Users/cameronmcallister/Github/omnichannel-clone/...` | deprecate (see section 9 of audit) |
| `scripts/build-html-mirror.ts` | `clones/...` (close to spec) | `clones/<target>/<iso>/mirror/` |
| Skill `clone-website/SKILL.md` | `docs/research/`, `docs/design-references/`, `docs/animations/`, `public/` | All under `clones/<target>/<iso>/` (specifically `reports/animations/`, `reports/chrome-mcp/`, `reports/qa/`) |

**Total: 18 scripts + 1 skill** need to update default output paths. Most are one-line constant changes. The skill is a larger rewrite (covered in B.4).

### D. Why Claude picks the wrong route — context cues to remove

| Route | Context cue that draws Claude here |
|---|---|
| `/clone-website` skill | `name: clone-website` and `description: Reverse-engineer and clone any website... Use this whenever the user wants to clone, replicate, rebuild, reverse-engineer, or copy any website` in the skill frontmatter (SKILL.md lines 1-3). Maximum keyword density on the user's literal verbs ("clone", "rebuild", "replicate", "copy"). |
| `npm run clone-site` | CLAUDE.md's "Full Clone Pipeline" section header reads `npm run clone-site -- https://example.com` as the first example. Top of the file, most-prominent code block. |
| `npm run clone-end-to-end` | The npm key contains the words "end-to-end" — Claude reads that as "the complete pipeline". Also CLAUDE.md mentions it as the single-URL command for the `clone-site` pipeline. |
| `npm run clone-page` | Verb match — "clone this page" maps clean to `clone-page`. Listed in CLAUDE.md's quick-reference table. |
| `npm run capture` | The capture pipeline section of CLAUDE.md is the longest single block in the file (`## Playwright Capture Pipeline (multi-mode)`), and it leads with `npm run capture https://example.com`. Claude treats the longest, most-documented thing as the "right" thing. |
| `npm run rebuild-pro` | The word `pro` is a strong "use this, it's better" signal to LLMs. Plus the `--url=` flag means it accepts URLs directly. CLAUDE.md does not actively warn against picking it for fresh clones. |
| `npm run build:astro` / `:react` / `:webapp` | Verb `build` is the universal Next/Vite/Astro convention — Claude defaults to it when it doesn't recognise the project's specific entry points. Will fail immediately because these accept `<clone-dir>` not `<url>`. |
| Hand-rolling with `npx playwright install` | When the skill fails (which it will, given the `npm run build` calls), Claude falls back to first-principles browser automation. The 11 `scripts/verify-*.ts` files and 3 root `.mjs` diagnostics provide false copy-paste targets. |

**What to remove / rename / blockade to leave one obvious door:**

1. **Rename the skill** to something less aggressively-matching (e.g. `parity-clone`) OR rewrite its frontmatter to delegate to `parity clone <url>` (the V2.0 CLI) so the skill is a thin orchestrator. Currently it dominates ALL clone-related routing.
2. **Remove `clone-page` and `clone-end-to-end` npm keys.** Keep only `parity` (or `clone` if you prefer a single short word) as the V2.0 verb.
3. **Demote `npm run capture` in CLAUDE.md.** Move the "multi-mode capture pipeline" section below the canonical "clone a URL" section, with explicit prose: "Use this only when you need a logged-in profile via CDP or persistent mode. For all other cases, use `parity clone`."
4. **Rename `rebuild-pro` to `parity rebuild` and remove the `--url=` flag.** Force it to accept a `<clone-dir>` only. The URL path should always go through `parity clone` first.
5. **Add a clear error to `build:astro` / `build:react` / `build:webapp`** that says `"This builds from a clone directory. To start from a URL, run: parity clone <url>"`.
6. **Delete the 11 `scripts/verify-*.ts` files and 3 root `.mjs` diagnostics** or move them to `scripts/_archive/` so they stop appearing in Claude's grep results.
7. **Update `.claude/commands/clone-website.md`** to invoke the new V2.0 CLI directly (`!parity clone $ARGUMENTS`) once it exists, removing the natural-language pipeline indirection.

After (1) and (2), the skill no longer has keyword dominance and Claude has fewer plausible doors to choose from. After (3) and (4), the documented surface area collapses to: `parity clone <url> [--target=astro|react|webapp]` for fresh clones, `parity rebuild <clone-dir>` for the heavy orchestration pass, `parity verify <clone-dir> <rebuilt-dir>` for QA.

### E. The npm scripts manifest

Source: `package.json` lines 26-74. Status assigned based on whether the script is called from another script, from the skill, from CLAUDE.md/AGENTS.md, or stands alone.

| # | npm script name | Exists? | Called by | Status (V2.0) | Notes |
|---|---|---|---|---|---|
| 1 | `typecheck` | YES | nothing in-tree | KEEP | The only verification that works |
| 2 | `check` | YES | nothing in-tree | RENAME → `verify:types` (or DELETE) | CLAUDE.md says it runs lint+typecheck+build; reality is just typecheck |
| 3 | `generate:prototype` | YES | nothing in-tree | DELETE | Legacy `page-data.json → React prototype` |
| 4 | `generate:prototype:fixture` | YES | nothing in-tree | DELETE | Fixture replay of #3 |
| 5 | `generate:astro` | YES | nothing in-tree | DELETE | Legacy `page-data.json → Astro` |
| 6 | `generate:astro:fixture` | YES | nothing in-tree | DELETE | Fixture replay of #5 |
| 7 | `build-astro` | YES | `engine/orchestrator/phases.ts:44` (rebuild-pro phase 0) | KEEP-AS-INTERNAL | Pure shim → `build.ts --target=astro`. Rebuild-pro depends on it. |
| 8 | `build:astro` | YES | direct user, rebuild-pro indirectly | KEEP | Canonical unified builder for astro target |
| 9 | `build:react` | YES | direct user | KEEP | Canonical unified builder for react target |
| 10 | `build:webapp` | YES | direct user | KEEP | Canonical unified builder for webapp target |
| 11 | `crawl:webapp` | YES | direct user | KEEP (for now) | One of two webapp capture paradigms — needs reconciliation with audit:capture |
| 12 | `capture:forms` | YES | direct user (webapp phase 4) | KEEP | Form-state capture, no overlap |
| 13 | `build:react:multi` | YES | direct user | RENAME → `clone-urls --target=react` | Pure alias of #27 with `--target=react` baked in |
| 14 | `build:astro:multi` | YES | direct user | RENAME → `clone-urls --target=astro` | Pure alias of #27 |
| 15 | `test:parity:astro` | YES | direct user | KEEP | Multi-viewport parity spec |
| 16 | `test:parity:react` | YES | direct user | KEEP | Same, react |
| 17 | `capture` | YES | run-clone.ts, clone-site.ts, clone-urls.ts | KEEP | Foundation of every clone |
| 18 | `parse:har` | YES | run-clone.ts, clone-site.ts, clone-urls.ts, rebuild-pro.ts | KEEP | |
| 19 | `parse:trace` | YES | run-clone.ts, clone-site.ts, clone-urls.ts, rebuild-pro.ts | KEEP | |
| 20 | `parse:all` | YES | nothing | DELETE or FIX | Broken without undocumented `--dir=` config |
| 21 | `complete:assets` | YES | clone-site.ts, clone-urls.ts | KEEP | |
| 22 | `extract:css` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | Part of rebuild-pro chain |
| 23 | `extract:primitives` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 24 | `extract:tokens` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 25 | `clone` | YES | run-clone.ts, clone-site.ts, clone-urls.ts | KEEP | Static 1:1 clone primitive |
| 26 | `clone-site` | YES | direct user | KEEP | Autonomous multi-page (Astro) |
| 27 | `clone-urls` | YES | direct user, also via build:react:multi, build:astro:multi | KEEP | URL-list multi-page (Astro + React) |
| 28 | `clone-page` | YES | direct user | DELETE | Pure alias of #29; consolidate |
| 29 | `clone-end-to-end` | YES | direct user, rebuild-pro --url= branch | KEEP, RENAME to `parity clone` | KEEP-AS-PRIMARY for "clone one URL" |
| 30 | `check:html-rewriter` | YES | nothing in-tree | KEEP | Smoke test |
| 31 | `check:astro-emit` | YES | nothing in-tree | KEEP | Smoke test |
| 32 | `check:refactor` | YES | nothing in-tree | KEEP | Smoke test |
| 33 | `iconify:svgs` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 34 | `verify:parity` | YES | rebuild-pro phase, direct user | KEEP | Pixel-diff clone-vs-rebuilt |
| 35 | `extract:animations` | YES | direct user | KEEP | Static animation extractor |
| 36 | `scope:styles` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 37 | `check:scope-styles` | YES | nothing in-tree | KEEP | Smoke test |
| 38 | `check:prettify` | YES | nothing in-tree | KEEP | Smoke test |
| 39 | `centralize:content` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 40 | `refactor:sections` | YES | rebuild-pro phase | KEEP-AS-INTERNAL | |
| 41 | `rebuild-pro` | YES | direct user | KEEP, RENAME → `parity rebuild` | Mega-orchestrator; remove `--url=` flag |
| 42 | `generate:edit-playbook` | YES | direct user | KEEP | EDIT.md generator |
| 43 | `extract:library` | YES | direct user | KEEP | Section library catalogue |
| 44 | `audit:shell` | YES | direct user (webapp phase 1 of 3) | KEEP | |
| 45 | `audit:plan` | YES | direct user (webapp phase 2 of 3) | KEEP | |
| 46 | `audit:execute` | YES | direct user (webapp phase 3 of 3) | KEEP | |
| 47 | `audit:capture` | YES | direct user | KEEP | Runs all 3 audit phases |
| 48 | `preview` | YES | nothing in-tree, suggested in CLAUDE.md | KEEP | `npx serve` |
| — | `build` | **NO** | SKILL.md lines 31, 234, 308 reference it | **ADD or FIX SKILL** | Cross-reference broken |
| — | `dev` | **NO** | SKILL.md line 326 references it. Dockerfile.dev references it. | **ADD or FIX SKILL+Dockerfile** | Broken in 2 places |
| — | `lint` | **NO** | CLAUDE.md "Commands" section advertises it. AGENTS.md "Commands" section advertises it. | **ADD or FIX DOCS** | Both top-level instruction files lie about this script existing |
| — | `start` | **NO** | implicit Next.js convention; Dockerfile may reference | DELETE expectation | Not advertised by any active doc, but Dockerfile expects Next.js conventions |

#### E.1 Broken cross-references (the worst offenders)

| Source | Reference | Reality |
|---|---|---|
| `SKILL.md:31` | `npm run build` | Not in package.json. Skill Phase 0.3 fails. |
| `SKILL.md:234` | `npm run build` | Same. Phase 3.1 verification fails. |
| `SKILL.md:308` | `npm run build` | Same. Phase 3.3 verification fails. |
| `SKILL.md:326` | `npm run dev &` | Not in package.json. Phase 4.1 fails. |
| `CLAUDE.md` Commands section | `npm run dev` | Not in package.json. |
| `CLAUDE.md` Commands section | `npm run build` | Not in package.json. |
| `CLAUDE.md` Commands section | `npm run lint` | Not in package.json. |
| `AGENTS.md` Commands section | `npm run dev` | Not in package.json. |
| `AGENTS.md` Commands section | `npm run build` | Not in package.json. |
| `AGENTS.md` Commands section | `npm run lint` | Not in package.json. |
| `AGENTS.md` Commands section | `npm run check` | Exists but is just an alias of `typecheck`, not the lint+typecheck+build it advertises. |
| `Dockerfile.dev` | `npm run dev` | Not in package.json. Container would fail to start. |

**Total broken references: 12.** Every single instruction file (SKILL.md, CLAUDE.md, AGENTS.md, Dockerfile.dev) lies about at least one npm script existing. Fix path is either (a) add the missing scripts as aliases for the emitted-project equivalents, or (b) rewrite the instruction files to reflect reality. Option (b) is honest; option (a) is convenient. Pick one and apply consistently.

### F. "What does each route actually produce" matrix

For each KEEP-AS-PRIMARY and KEEP-AS-INTERNAL route, the input → output file tree.

#### F.1 `parity clone <url>` (KEEP-AS-PRIMARY, currently `npm run clone-end-to-end`)

```
INPUT:  url=https://example.com
        [--viewport=desktop,...]    (default: all 4)
        [--out=<dir>]                (default: docs/research/captures, V2.0: clones)
        [--no-tour]
        [--no-preview]

OUTPUT (current):
  docs/research/captures/<host>/<iso-timestamp>/
    manifest.json
    desktop/
      screenshot.png
      network.har
      trace.zip
      video/
      parsed/
        document.html
        document.url
        styles/{<sha8>.css, index.json}
        scripts/{<sha8>.js, index.json}
        assets/{<sha8>.<ext>, index.json}
        asset-manifest.json
        skipped.json
        dom-snapshots.jsonl
        trace-manifest.json
      clone/
        index.html
        styles/<sha8>.css
        scripts/<sha8>.js
        assets/<sha8>.<ext>
        manifest.json
    tablet/    (same structure)
    mobile/    (same structure)
    wide/      (same structure)
```

#### F.2 `parity clone-site <entry-url>` (KEEP-AS-PRIMARY, currently `npm run clone-site`)

```
INPUT:  entry-url=https://example.com
        [--max-pages=N]              (default 50)
        [--max-depth=N]              (default 3)
        [--rate-limit-ms=N]
        [--path-prefix=...]
        [--no-robots]
        [--out=<dir>]
        [--astro-out=<dir>]          (default: <out>/<host>/astro-site)
        [--no-tour]
        [--no-emit]
        [--force]
        [--resume]

OUTPUT (current):
  docs/research/captures/<host>/<iso-timestamp>/
    .crawl-state.json                (for --resume)
    <slugified-pathname-1>/          (one per discovered URL)
      desktop/                       (full capture+parsed+clone as in F.1)
      tablet/
      ...
    <slugified-pathname-2>/
      ...
  docs/research/captures/<host>/astro-site/    (or wherever --astro-out points)
    package.json
    astro.config.mjs
    src/
      pages/             (one .astro per cloned URL)
      components/        (shared components extracted across pages)
      layouts/
      styles/
    public/              (deduped assets across pages)
    post-emit-report.json
```

#### F.3 `parity clone-urls --urls=urls.txt --target=astro|react` (KEEP-AS-PRIMARY, currently `npm run clone-urls`)

```
INPUT:  --urls=<file>                (newline-separated URL list)
        --url=<single>                (repeatable, mixes with --urls=)
        --target=astro|react          (default: astro)
        --viewport=<list>             (default: desktop only)
        [--rate-limit-ms=N]
        [--out=<dir>]
        [--astro-out=<dir>]           (default: <out>/<host>/<target>-site-urls)
        [--no-tour]
        [--no-emit]
        [--no-post-emit]
        [--force]
        [--skip-failed]

OUTPUT (current):
  docs/research/captures/<host>/<iso-timestamp>/
    <slugified-pathname-N>/
      <viewport>/         (full capture+parsed+clone)
  docs/research/captures/<host>/<target>-site-urls/    (or --astro-out)
    package.json
    [astro.config.mjs OR vite.config.ts]
    src/...
    public/...
    post-emit-report.json
```

#### F.4 `parity build:<target> <clone-dir>` (KEEP-AS-INTERNAL primarily, currently `npm run build:astro|react|webapp`)

```
INPUT:  <clone-dir>                  (a directory containing parsed/ + clone/ from F.1)
        --target=astro|react|webapp  (from npm script name)
        [--out=<dir>]                (default: clones/<host>-<iso>/)
        [--name=<project-name>]
        [--force]
        (webapp variant)
        --crawl-dir=<dir>             (from crawl:webapp output)
        --multi --clone-dir=<path>:<route>  (multi-page, repeatable)

OUTPUT (astro):
  <out>/
    package.json
    astro.config.mjs
    tsconfig.json
    src/
      pages/index.astro     (single-page) OR pages/<route>.astro (multi)
      components/<Section>.astro
      layouts/Layout.astro
      styles/global.css
    public/
      fonts/
      images/
      videos/
      seo/

OUTPUT (react):
  <out>/
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    src/
      App.tsx
      components/<Section>.tsx
      styles/global.css
    public/...

OUTPUT (webapp):
  <out>/
    package.json
    vite.config.ts
    src/
      App.tsx
      routes/<route>.tsx
      mocks/handlers.ts    (MSW handlers from crawler state graph)
      ui/                  (extracted shadcn primitives)
    public/...
```

#### F.5 `parity capture <url> --mode=launch|cdp|persistent` (KEEP-AS-INTERNAL but exposed for auth flows, currently `npm run capture`)

```
INPUT:  url
        --mode=launch|cdp|persistent (default: launch)
        --viewport=<list>
        --out=<dir>
        --headed
        --no-tour

OUTPUT (launch mode):
  <out>/<host>/<iso>/
    manifest.json
    <viewport>/
      screenshot.png
      network.har
      trace.zip
      video/

OUTPUT (cdp / persistent modes):
  <out>/<host>/<iso>/
    manifest.json
    cdp/     (or persistent/)
      screenshot.png
      network.json      (NOT network.har)
      trace.zip
      (no video/)
```

#### F.6 `parity parse:har <capture-dir>` (KEEP-AS-INTERNAL, currently `npm run parse:har`)

```
INPUT:  <capture-dir>     (a per-viewport dir containing network.har or network.json)

OUTPUT (sibling parsed/ inside the <viewport>/ directory):
  parsed/
    document.html
    document.url
    styles/<sha8>.css     (deduplicated by content hash)
    styles/index.json     (URL → sha8 mapping)
    scripts/<sha8>.js
    scripts/index.json
    assets/<sha8>.<ext>
    assets/index.json
    asset-manifest.json
    skipped.json          (entries that were not extractable)
```

#### F.7 `parity parse:trace <capture-dir>` (KEEP-AS-INTERNAL, currently `npm run parse:trace`)

```
INPUT:  <capture-dir>     (must contain trace.zip in each viewport dir)

OUTPUT (added to existing parsed/):
  parsed/
    trace-unpacked/       (raw extracted contents of trace.zip)
    dom-snapshots.jsonl   (one DOM snapshot per line, timestamped)
    trace-manifest.json
```

#### F.8 `parity clone <capture-dir>` (the primitive, KEEP-AS-INTERNAL, currently `npm run clone`)

```
INPUT:  <capture-dir>     (must contain parsed/ from parse:har)

OUTPUT (sibling clone/ inside the <viewport>/ directory):
  clone/
    index.html            (rewritten captured HTML, <base href="./"> injected, CSP stripped)
    styles/<sha8>.css     (copy of parsed/styles/<sha8>.css, references rewritten)
    scripts/<sha8>.js     (copy of parsed/scripts/<sha8>.js)
    assets/<sha8>.<ext>
    manifest.json         (counts, byte totals, sample unresolved external URLs)
```

#### F.9 `parity rebuild <clone-dir>` (KEEP-AS-PRIMARY for orchestration, currently `npm run rebuild-pro`)

```
INPUT:  <clone-dir>       (from F.1 output, the <viewport>/clone/ dir)
        --mode=safe|aggressive  (default: safe)
        --skip=<phase,phase,...>
        --site             (multi-page mode)
        [--emit-only]       (recovery)
        [--url=<url>]       (V2.0: REMOVE this flag, force user to clone first)

OUTPUT (in <clone-dir>/../astro-pro/ today, V2.0: clones/<target>/<iso>/sites/astro/):
  package.json
  astro.config.mjs
  src/
    pages/
    components/
      sections/<Section>.astro     (refactored via refactor:sections phase)
      primitives/<Primitive>.astro (extracted via extract:primitives)
      icons/<Icon>.astro            (extracted via iconify:svgs)
    styles/
      global.css                    (extracted tokens via extract:tokens)
      <Section>.module.css          (scoped per-component via scope:styles)
    content/site.ts                 (centralised editable copy via centralize:content)
  public/...
  parity-report/                    (auto-generated by phase 9 verify:parity)
    parity-report.json
    parity-report.md
    parity-<viewport>.png
```

#### F.10 `parity verify <clone-dir> <rebuilt-dir>` (KEEP-AS-PRIMARY for QA, currently `npm run verify:parity`)

```
INPUT:  --clone=<dir>             (the F.1 captured clone)
        --rebuilt=<dir>           (the F.4 emitted project, after npm run build)
        --threshold=<float>       (default 0.01 i.e. 1% pixel difference)
        --viewports=<list>

OUTPUT (in <rebuilt>/../parity-report/ today):
  parity-report.json    (per-viewport match %, threshold pass/fail)
  parity-report.md      (human-readable summary)
  parity-<viewport>.png (red-highlighted diff image)
```

This matrix is what the V2.0 `parity` CLI must preserve. Every transition (capture → parse → clone → build → rebuild → verify) needs an equivalent V2.0 verb, and the new output convention (section C) needs to apply uniformly.
