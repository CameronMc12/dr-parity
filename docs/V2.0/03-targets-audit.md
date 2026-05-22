# V2.0 Audit — Targets Deep Dive (astro / react / webapp)

> Read-only audit of the three Dr Parity targets. No code modified. The aim is to surface the real shape of each target so V2.0 can give all three the same operator experience.

Status snapshot (from Cameron):

| Target  | Lived-experience state                                    |
|---------|-----------------------------------------------------------|
| astro   | Finished. Reliably ~99.99% parity.                        |
| react   | One historic success. Has not been replicable since.      |
| webapp  | In progress. Pipeline mostly wired, hard validation light.|

---

## 1. The Target Contract

`engine/targets/types.ts:64-73` defines a single `TargetAdapter` shape that all three implement:

```
TargetAdapter {
  name: 'astro' | 'react' | 'webapp'
  build(options: TargetBuildOptions): Promise<TargetBuildSummary>
  buildMulti?(options: TargetMultiBuildOptions): Promise<TargetMultiBuildSummary>
}
```

`TargetBuildOptions` is minimal — `cloneDir`, `outDir`, `name?`, `force?`, `primitives?`. Webapp **smuggles** an extra `crawlDir` through a structural cast (`engine/targets/webapp/index.ts:117`) because the shared contract has no concept of it. That is the first sign the contract is shallower than it looks.

The dispatcher is `scripts/build.ts`:
- Loads the adapter via dynamic import (`engine/targets/astro|react|webapp/index.ts`).
- Routes single vs multi based on whether `--clone-dir=` was given with a `:pathname` suffix.
- Special-cases webapp `--crawl-dir` (`scripts/build.ts:322-325`).
- Webapp single-page-only — `buildMulti` is intentionally omitted (`engine/targets/webapp/index.ts:8-9`).

`scripts/clone-urls.ts` is the **end-to-end driver** for astro + react only. It does `capture → parse:har → parse:trace → complete:assets → clone → adapter.buildMulti → post-emit → parity gate` (`scripts/clone-urls.ts:402-489`). It cannot drive webapp.

---

## 2. Shared (Target-Agnostic) Layer

`engine/targets/shared/` is the only true seam between targets:

| File                                             | Role                                                              |
|--------------------------------------------------|-------------------------------------------------------------------|
| `engine/targets/shared/types.ts`                 | `ComponentDef`, `ComponentRole`, `ExtractedHead`, `SliceResult`   |
| `engine/targets/shared/extract-head.ts`          | Cheerio extraction of `<head>` innerHTML + html/body attrs        |
| `engine/targets/shared/slice-body.ts`            | Body slice into Preamble / Header / Main(sections) / Footer / etc.|
| `engine/targets/shared/find-landmarks.ts`        | Wrapper-aware landmark discovery                                  |
| `engine/targets/shared/asset-copy.ts`            | Clone `clone/` → project `public/` copy                           |
| `engine/targets/shared/paths.ts`                 | URL/srcset/CSS path normalisation                                 |
| `engine/targets/shared/slug.ts`                  | `deriveSlug`, `pascalCase`                                        |

This is target-agnostic on paper. Two leaks worth noting:

1. `slice-body.ts:193-204` emits a `Main` wrapper with **Astro-style `---` frontmatter**. The file docblock at L26-27 acknowledges it: "non-Astro targets must rewrite that frontmatter during their own emit step." React's emit does work around this; webapp's emit re-uses the React JSX converter and dodges the issue by going through `htmlToJsx`.
2. The bug-2 tile subdivision (`slice-body.ts:166-178`) is hardcoded to Apple-style markers (`data-analytics-section-engagement`, `data-tile-id`, `.tile-wrapper`). It is shared, so it benefits all targets, but it is also Apple-shaped.

---

## 3. Target 1 — astro

### 3.1 What it produces

A static Astro 5 project (`engine/targets/astro/scaffold.ts:29-46`):

```
<outDir>/
  package.json                     # astro@^5
  astro.config.mjs                 # output: 'static'
  tsconfig.json
  src/
    layouts/Layout.astro
    components/
      shared/<Name>.astro          # multi-page only
      <route>/<Name>.astro         # multi-page only
      <Name>.astro                 # single-page mode
    pages/
      index.astro                  # single-page
      <pageName>.astro             # multi-page
    content/site.ts                # post-emit: centralised content
    styles/responsive.css          # post-emit: preserved @media
  public/                          # asset copy from clone
  analysis/css-rules.json          # post-emit
  EDIT.md                          # post-emit: edit playbook
  parity-report.json               # post-emit: parity diff result
  post-emit-multi-summary.json
```

### 3.2 Code path (all files astro-specific)

| File                                              | Purpose                                                          |
|---------------------------------------------------|------------------------------------------------------------------|
| `engine/targets/astro/index.ts`                   | `astroAdapter` (TargetAdapter impl), default-name derivation     |
| `engine/targets/astro/types.ts`                   | `BuildOptions`, `BuildSummary`                                   |
| `engine/targets/astro/build.ts`                   | Single-page orchestrator                                         |
| `engine/targets/astro/build-multi.ts`             | Multi-page orchestrator                                          |
| `engine/targets/astro/emit.ts`                    | `writeComponent`, `writeLayout`, `writePage`                     |
| `engine/targets/astro/emit-multi.ts`              | Fingerprint dedupe + per-page emit                               |
| `engine/targets/astro/scaffold.ts`                | package.json, astro.config, SEO config                           |
| `engine/targets/astro/prettify.ts`                | AST-safe prettify pass (roundtrip-verified, silent revert)       |
| `engine/targets/astro/is-inline.ts`               | `injectIsInline` helper                                          |
| `engine/targets/astro/centralize-content.ts`      | Extract section text into `src/content/site.ts`                  |

Post-build pipeline lives in `engine/orchestrator/post-build/post-emit-multi.ts`:
1. `extract-css` aggregated across every per-page clone (`:171-179`)
2. `media-preserve` → `src/styles/responsive.css` (`:184-197`)
3. `centralise-content` → `src/content/site.ts` (`:202-214`)
4. `npm install` + `npm run build` (`:219-249`)
5. `edit-playbook` → EDIT.md (`:255-264`)
6. `verify-render` (boot dev server, smoke-test routes) (`:269-287`)

### 3.3 Pipeline diffs vs other targets

| Stage              | Astro                                                          |
|--------------------|----------------------------------------------------------------|
| Extract            | Shared (capture.ts + parse-har + parse-trace + complete-assets)|
| Analyze            | Astro-specific post-emit (css aggregation + media preserve)    |
| Generate           | `.astro` SFC emit with `---` frontmatter + import wiring       |
| QA                 | `verify-render` (route boot smoke) + parity-check (pixel diff) |

### 3.4 Input contract

- `cloneDir` with `index.html` + `manifest.json` (validated at `engine/targets/astro/build.ts:20-31`).
- Multi: array of `{ cloneDir, pathname }`.

### 3.5 Output contract

`TargetBuildSummary { outDir, componentsEmitted, pagesEmitted, assetCount, assetBytes }`.
`TargetMultiBuildSummary` adds `pagesEmitted: string[]`, `sharedComponents: string[]`, `perPageComponents`.

### 3.6 Known good runs

- `engine/tests/MULTI_VIEWPORT_FINDINGS.md` references `clone-enerblock/` as a finished Astro rebuild. It also notes the rebuild dropped 99.5% of `@media` rules — which is precisely the gap the post-emit `media-preserve` phase now closes.
- `docs/research/enerblock/EXTRACTION_SUMMARY.md` documents the canonical end-to-end Astro path.
- The Astro path has a hard parity gate via `engine/qa/parity-check.ts:38` (`ParityTarget = 'astro' | 'react'`).

### 3.7 Known issues / TODOs

- `slice-body.ts:26-27` flags the Astro-shaped `---` frontmatter living in the shared layer.
- Prettify can silently revert on AST drift (`engine/targets/astro/build.ts:95-99`).

### 3.8 Why it works

1. The Astro `.astro` file format **is** essentially captured HTML with an import block on top. The JSX-conversion step that the other two targets need (and that the bugs.md investigation surfaced as fragile) **doesn't exist for Astro**.
2. The post-emit pipeline (`post-emit-multi.ts`) is comprehensive: CSS aggregation, media-preserve, content centralisation, install, build, render verification — six phases that catch regressions before declaring a clone done.
3. The parity gate is wired (`scripts/clone-urls.ts:462-489`).
4. SSR-by-default: Astro produces static HTML so the page renders even without JS, sidestepping hydration mismatch noise.

---

## 4. Target 2 — react

### 4.1 What it produces

A Vite + React 18 + TS multi-entry project (`engine/targets/react/scaffold.ts:31-56`):

```
<outDir>/
  package.json                    # vite@^5, react@^18, tsx, typescript
  vite.config.ts
  tsconfig.json (+ tsconfig.node.json + tsconfig.app.json)
  index.html                       # single-page only
  <pageName>.html                  # multi-page (real Vite entry per page)
  src/
    main.tsx                       # single-page
    App.tsx                        # single-page
    entries/<pageName>.tsx         # multi-page
    pages/<PageName>Page.tsx       # multi-page
    components/
      shared/<Name>.tsx            # multi-page only
      <pageName>/<Name>.tsx        # multi-page only
      <Name>.tsx                   # single-page
    lib/post-hydration-sync.ts
    prerender.tsx                  # build-time SSR (multi-page)
    globals.css
    jsx-custom-elements.d.ts
  public/                          # asset copy
  parity-report.json               # post-emit: parity diff
```

`package.json` `build` script is `tsc -b && vite build && tsx src/prerender.tsx` (`engine/targets/react/scaffold.ts:39`) — so React **does** ship a build-time prerender pass now. That contradicts bugs.md GAP H.

### 4.2 Code path (react-specific)

| File                                                | Purpose                                                          |
|-----------------------------------------------------|------------------------------------------------------------------|
| `engine/targets/react/index.ts`                     | `reactAdapter` (TargetAdapter impl)                              |
| `engine/targets/react/types.ts`                     | `BuildOptions`, `BuildSummary`, `ReactComponentDef`              |
| `engine/targets/react/build.ts`                     | Single-page orchestrator                                         |
| `engine/targets/react/build-multi.ts`               | Multi-page orchestrator (multi-entry Vite)                       |
| `engine/targets/react/emit.ts`                      | Single-page emit (`writeApp/Component/IndexHtml/Main`)           |
| `engine/targets/react/emit-multi.ts`                | Per-page entry + page emit + fingerprint dedupe                  |
| `engine/targets/react/scaffold.ts`                  | package.json, vite/ts config, globals.css, custom elements dts   |
| `engine/targets/react/scaffold-multi.ts`            | Multi-entry vite config, prerender stub                          |
| `engine/targets/react/html-to-jsx.ts`               | The HTML → JSX converter (the lone fragile thing)                |
| `engine/targets/react/collect-hoistable.ts`         | Body-script hoisting + stylesheet planning                       |
| `engine/targets/react/post-hydration-sync.ts`       | Library that re-runs captured scripts after React hydrates       |
| `engine/targets/react/jsx-custom-elements.d.ts`     | JSX widening for custom elements (a-link, swiper-slider, etc.)   |
| `engine/orchestrator/post-build/post-emit-multi-react.ts` | React-shaped post-emit (install / build / verify-render)   |

### 4.3 Pipeline diffs vs other targets

| Stage              | React                                                                |
|--------------------|----------------------------------------------------------------------|
| Extract            | Shared with Astro                                                    |
| Analyze            | None — no CSS aggregation, no media-preserve, no content extraction  |
| Generate           | `htmlToJsx` per component + multi-entry Vite + prerender             |
| QA                 | React-shaped `runPostEmitMultiReact` + parity-check                  |

The React post-emit is intentionally **narrower** than Astro's (`engine/orchestrator/post-build/post-emit-multi-react.ts:5-12`): "those phases are Astro-shaped". It runs only npm install, npm run build, and Playwright-based render verification with hydration-mismatch tolerance (`:74-86`) and third-party error filtering (`:103-160`).

### 4.4 Input contract

Identical to Astro.

### 4.5 Output contract

Identical to Astro for `TargetBuildSummary` / `TargetMultiBuildSummary`.

### 4.6 Known good runs

- bugs.md acknowledges Cameron's one historic success but does not name the URL.
- No fixture clone of a successful React project is on disk under `clones/`.
- React is wired into the parity gate (`engine/qa/parity-check.ts:38`).

### 4.7 Known issues vs bugs.md (state of fixes)

| bugs.md GAP / Bug | Status |
|---|---|
| Bug 1: `<script type="module">` into `/public` | **Fixed.** `build-multi.ts:117-127` calls `restoreTypeModuleForEsModules` after `collectAndStripBodyScripts` strips the attribute. |
| Bug 2: Only 3 sections rendered | **Fixed in shared layer.** `slice-body.ts:166-178` subdivides outer wrappers with 2+ tile markers. |
| Bug 3: Font 404s in `complete-assets.ts` | **Not verified in this audit** — needs a re-run on apple.com to confirm. |
| GAP A: tabIndex string vs number | **Fixed.** `engine/targets/react/html-to-jsx.ts:56-70` `NUMERIC_HTML_ATTRS` set includes tabindex, rowspan, colspan, maxlength, etc. |
| GAP B: No post-emit pipeline for React | **Fixed.** `engine/orchestrator/post-build/post-emit-multi-react.ts` is wired into `scripts/clone-urls.ts:427-443`. |
| GAP C: Inline style url() / quoted values mangled | **Status unknown** — `parseInlineStyle` at `html-to-jsx.ts:413` not re-read here. Worth verifying. |
| GAP D: Parity harness orphaned | **Fixed.** `engine/qa/parity-check.ts` accepts `target: 'astro' \| 'react'` and is called as a hard gate. |
| GAP E: className whitespace not collapsed | **Status unknown.** |
| GAP F: No prettify pass | **Not fixed** — only Astro has `prettifyEmittedDir`. |
| GAP G: No centralizeContent / EDIT.md | **Not fixed for React.** Only Astro post-emit produces these. |
| GAP H: No SSR / pre-render | **Fixed.** `prerender.tsx` ships and runs in the build script. |

### 4.8 Why it is flaky (hypothesis)

1. **JSX conversion fragility.** Astro emits captured HTML verbatim. React must traverse the captured DOM and re-serialise every node as JSX. Each new site introduces an attribute / boolean / numeric / SVG / custom-element shape the converter has not seen. `html-to-jsx.ts` has accumulated heuristics (`NUMERIC_HTML_ATTRS`, `IE_ONLY_ATTRS`, `BOOLEAN_ATTRS`, `ATTR_MAP`) but they are list-driven — each new failure adds a new entry.
2. **No CSS pipeline.** Astro's post-emit aggregates CSS across pages and preserves media queries. React's post-emit doesn't. Whatever the captured HTML links to, **must** load directly — and the React post-emit can only verify it via render verification, not by inspecting CSS structure.
3. **Hydration mismatch noise.** `post-emit-multi-react.ts:74-86` explicitly downgrades React errors #418-#426 to warnings. Real hydration bugs that affect parity are easy to hide in that mask.
4. **Captured-script execution.** React must re-run captured scripts after hydration via `post-hydration-sync.ts`. The Astro target sidesteps this entirely because the page is static HTML and scripts run on first paint as they would on the source.
5. **Third-party error tolerance is broad.** `post-emit-multi-react.ts:103-160` ignores anything under `/v/`, `/ac/`, `/api-www/`, `/metrics/`, `/_external/` plus any same-origin path not under `/assets/`. That filter exists for good reason on apple.com, but it dilutes the verify-render signal.

---

## 5. Target 3 — webapp

### 5.1 What it produces

A Vite + React + TS + React Router + MSW project, optionally driven by a Playwright crawl graph rather than a static clone (`engine/targets/webapp/scaffold.ts`):

```
<outDir>/
  package.json
  vite.config.ts
  tsconfig.json
  index.html                           # head + #root + main.tsx
  src/
    main.tsx                           # React + BrowserRouter + MSW
    App.tsx                            # <Routes> tree
    router.ts | router.tsx             # nav between stateful pages
    pages/<RoutePathPage>.tsx          # stateful component per route
    components/                        # currently empty in Phase 1
    lib/post-hydration-sync.ts         # shared with React
    jsx-custom-elements.d.ts
    mocks/
      browser.ts                       # MSW worker
      handlers.ts                      # API handlers from captured traffic
      socket.ts                        # websocket mocks
    fixtures/*.json                    # per-endpoint fixture
  public/
    mockServiceWorker.js
  OUTPUT.md                            # Library swap report
```

Confirmed against `clones/app.omnisocials.com-2026-05-22T05-59-30-232Z/OUTPUT.md` — emits MSW handlers, websocket fixtures, library detection reports.

### 5.2 Code path (webapp-specific — by far the most code)

| Directory                                        | Concern                                                  |
|--------------------------------------------------|----------------------------------------------------------|
| `engine/targets/webapp/index.ts`                 | `webappAdapter`, `crawlDir` smuggle                      |
| `engine/targets/webapp/types.ts`                 | `WebappBuildOptions`, `WebappBuildSummary`               |
| `engine/targets/webapp/build.ts`                 | Crawl-driven OR clone-driven orchestrator                |
| `engine/targets/webapp/emit.ts`                  | App / Page / IndexHtml / Main emit                       |
| `engine/targets/webapp/emit-router.ts`           | React Router stateful main + per-route wiring            |
| `engine/targets/webapp/extract-body-root.ts`     | Extract body root from a captured state DOM              |
| `engine/targets/webapp/strip-runtime-tags.ts`    | Strip captured runtime tags before emit                  |
| `engine/targets/webapp/scaffold.ts`              | Compose per-concern scaffold writers                     |
| `engine/targets/webapp/scaffold/*.ts`            | package.json, vite, ts, msw, router stub, static files   |
| `engine/targets/webapp/crawler/*.ts`             | Phase 2: Playwright BFS crawl, blocklist, state capture  |
| `engine/targets/webapp/crawler/route-recapture.ts`| Re-capture canonical per-route DOM after crawl          |
| `engine/targets/webapp/inference/*.ts`           | Phase 3: state groups, toggles, dismiss strategy         |
| `engine/targets/webapp/emit-stateful/*.ts`       | Phase 3 emit: useState/useEffect wiring                  |
| `engine/targets/webapp/emit-mocks/*.ts`          | Phase 4: MSW handlers from captured network traffic      |
| `engine/targets/webapp/emit-realtime/*.ts`       | Phase 5: websocket stubs from frame logs                 |
| `engine/targets/webapp/detect-libs/*.ts`         | Phase 6: signature-based library detection               |
| `engine/targets/webapp/emit-libs/*.ts`           | Phase 6: wrapper components, attribute rewrites          |
| `engine/targets/webapp/emit-assets/*.ts`         | Asset extraction from trace                              |

The webapp target is by line count ~3-5x bigger than astro or react. It is closer to a separate product.

### 5.3 Pipeline diffs vs other targets

| Stage              | Webapp                                                                          |
|--------------------|---------------------------------------------------------------------------------|
| Extract            | Forked: `scripts/crawl-webapp.ts` (Playwright BFS) instead of single-page capture|
| Analyze            | Inference: state groups, dismiss strategies, library signatures                 |
| Generate           | Stateful per-route components + MSW handlers + websocket stubs + lib wrappers   |
| QA                 | **None.** No post-emit pipeline. No parity gate.                                 |

`scripts/clone-urls.ts:48` types `target` as `'astro' | 'react'` only — webapp cannot use the end-to-end driver. Webapp must be invoked through `scripts/build.ts --target=webapp --crawl-dir=...`.

### 5.4 Input contract

Two modes:
- **Clone mode**: same as react/astro (`cloneDir` with `index.html` + `manifest.json`).
- **Crawl mode**: `crawlDir` with a crawl graph. Validated at `engine/targets/webapp/build.ts:217-225`. Produces stateful per-route components.

### 5.5 Output contract

`WebappBuildSummary` (`engine/targets/webapp/types.ts:54-77`) extends `TargetBuildSummary` with optional `mocksGenerated`, `realtime`, `libs`, `assets` blocks. These extensions are **not** part of the shared `TargetBuildSummary`, so a generic caller cannot read them through the adapter contract.

### 5.6 Known good runs

- 13 clones under `clones/app.omnisocials.com-*` (timestamps 2026-05-21 to 2026-05-22) — repeated runs against omnisocials.
- The most recent clone has 60+ fixture files, MSW handlers, websocket fixtures, and a Library Swap Report (`OUTPUT.md`).
- `docs/blocklists/omnisocials.txt` and `omnisocials-phase1.txt` exist per the policy in `CLAUDE.md`.

### 5.7 Known issues

- No `buildMulti` (intentional per `engine/targets/webapp/index.ts:8-9`). Every "page" is a route inside one SPA bundle, derived from the crawl graph.
- `crawlDir` is **not** part of the shared `TargetBuildOptions` interface; it is smuggled through a structural cast at `engine/targets/webapp/index.ts:117`.
- No CSS aggregation, no media-preserve, no centralise-content, no edit-playbook, no parity gate, no render-verification post-emit step.
- The OUTPUT.md flags many `manual-only` libraries (Radix, Framer Motion, shadcn/ui, Uppy, Recharts). The static clone cannot replay them — they require manual rewiring.
- Captured Tailwind / shadcn / Radix dynamic classes (e.g. `data-[state=active]:text-black`) appear in the captured DOM but the runtime state machine is captured by inference, not by replaying JS.

### 5.8 Why it is partial (hypothesis)

1. **Different problem class.** Marketing sites (astro / react path) need pixel parity. Web apps need interactive parity — state, network mocks, websockets, library identity. The two targets share `htmlToJsx` and the head/body slicer but the rest is genuinely different.
2. **Hard validation gap.** There is nothing equivalent to `verify-render` or `parity-check` for webapp. The pipeline emits and ends. Whether MSW boots, whether routes render, whether state toggles fire — all unverified.
3. **`scripts/clone-urls.ts` doesn't know about it.** The end-to-end command shape that operators learned for astro and react does not apply.
4. **Library detection is reportage, not action.** OUTPUT.md flags 5+ libraries as `manual-only`. The pipeline produces a SPA shell + MSW mocks + library detection report; the operator does the actual rewiring.

---

## 6. Side-by-Side Comparison

| Dimension                    | astro                                           | react                                                      | webapp                                                  |
|------------------------------|-------------------------------------------------|------------------------------------------------------------|---------------------------------------------------------|
| Output framework             | Astro 5 static                                  | Vite + React 18 multi-entry (+ prerender)                  | Vite + React + React Router + MSW                       |
| Extract path                 | `capture.ts` + parse:har + parse:trace + complete:assets | Same as astro                                       | Forked: `crawl-webapp.ts` (Playwright BFS)              |
| Analyze path                 | Post-emit CSS aggregation + media-preserve      | None                                                       | State inference + library detection + URL pattern infer |
| Generate path                | `.astro` SFC emit (no JSX conversion)           | `htmlToJsx` + multi-entry HTML + prerender                 | `htmlToJsx` + stateful useState/useEffect emit + MSW    |
| QA path                      | `runPostEmitMulti` (6 phases) + `parity-check`  | `runPostEmitMultiReact` (3 phases) + `parity-check`        | None                                                    |
| Parity gate wired            | Yes                                             | Yes                                                        | No                                                      |
| End-to-end driver            | `scripts/clone-urls.ts --target=astro`          | `scripts/clone-urls.ts --target=react`                     | `scripts/build.ts --target=webapp --crawl-dir=...`      |
| `buildMulti` support         | Yes                                             | Yes (multi-entry Vite)                                     | No (SPA with router)                                    |
| Prettify pass                | Yes (`prettifyEmittedDir`)                      | No                                                         | No                                                      |
| Content centralisation       | Yes (`src/content/site.ts`)                     | No                                                         | No                                                      |
| Edit playbook (`EDIT.md`)    | Yes                                             | No                                                         | No (but emits `OUTPUT.md` library report)               |
| Fixture / clone evidence     | `clone-enerblock/` referenced in tests          | None on disk under `clones/`                               | 13 omnisocials clones under `clones/`                   |
| Lines of target-specific code| ~10 files                                       | ~12 files                                                  | ~50+ files (Phase 2-6)                                  |
| Last-known-good run          | Stable                                          | One historic (apple.com per bugs.md), not replicable       | Repeated omnisocials clones, validation unproven         |

---

## 7. Target Abstraction Critique

**Are these three targets implementing a common interface, or three bespoke pipelines that share some scripts?**

The latter, dressed as the former.

**The interface (`TargetAdapter`) is genuine but shallow.** It standardises `build(options) → summary` and `buildMulti?(options) → summary`. Every target really does implement it; `scripts/build.ts` dispatches uniformly. The shared layer (`engine/targets/shared/`) is genuinely target-agnostic for head extraction, body slicing, and asset copying.

**Below the interface, the pipelines diverge in three ways:**

1. **The input shape diverges.** Astro and React take a `cloneDir`. Webapp takes a `cloneDir` OR a `crawlDir` (smuggled). The shared contract has no concept of crawl-driven input.
2. **The post-emit shape diverges.** Astro has a six-phase pipeline. React has a three-phase pipeline that explicitly skips Astro phases. Webapp has none. These are not implementations of a common interface — they are three separate scripts (`post-emit-multi.ts`, `post-emit-multi-react.ts`, no equivalent for webapp).
3. **The driver script diverges.** `scripts/clone-urls.ts` is hardcoded to `'astro' | 'react'` (`scripts/clone-urls.ts:48`). Webapp is invoked through `scripts/build.ts` with different flags.

**Where the seam is:** the body slice (`ComponentDef[]` + `ExtractedHead`). Astro emits one way from that, React emits another, webapp emits a third. Below the slice the targets behave like adapters; above the slice (input shape) and after the emit (post-emit) they are bespoke pipelines.

**The honest framing:** the seam works for *converting captured HTML into framework-specific files*. It does not work for *running the captured site as a runnable framework project*. The seam should be wider.

---

## 8. What Would It Take For React To Reliably Hit 99% Like Astro

Drawn from the code, not speculation. In rough order of impact:

1. **Move post-emit closer to Astro's.** React's `runPostEmitMultiReact` has 3 phases (install / build / verify-render). Astro has 6. The missing phases that matter for parity:
   - `extract-css` aggregation across pages → `analysis/css-rules.json`. Today React has no CSS analysis.
   - `media-preserve` → `src/styles/responsive.css`. Astro's `MULTI_VIEWPORT_FINDINGS.md` is exactly the bug this fixes; React almost certainly has the same problem.
   - `centralise-content` is nice-to-have not parity-critical.
   - `prettify` is nice-to-have but reduces diff noise during debug.
2. **Tighten verify-render's ignorable error list.** `post-emit-multi-react.ts:103-160` filters too broadly. Same-origin paths not under `/assets/` are all treated as "captured third-party". Real bugs in the prerendered app code can hide behind that. At minimum log a count of suppressed errors per page.
3. **Snapshot test the JSX converter.** `engine/targets/react/html-to-jsx.ts` has accumulated five lookup tables (`NUMERIC_HTML_ATTRS`, `IE_ONLY_ATTRS`, `BOOLEAN_ATTRS`, `ATTR_MAP`, `VOID_ELEMENTS`). Without snapshot tests on representative captured HTML, each new site is a fresh game of whack-a-mole. The Astro path doesn't have this problem because it doesn't transform attribute names.
4. **Verify bug-2 fix on apple.com.** `slice-body.ts:166-178` was added to address Apple-style tile subdivision. The fact that bugs.md reports it as open suggests the fix landed but the React run still failed for an unrelated reason (build error from `tabIndex`, then verify-render error from suppressed-but-shouldn't-have-been third-party noise). Confirm by re-running apple.com and inspecting the parity report.
5. **Confirm inline style escape-hatch (GAP C).** Re-read `html-to-jsx.ts:413` `parseInlineStyle`. If it still `JSON.stringify`s `url(...)` values, hero backgrounds and any `style="background-image: url(...)"` break.
6. **Wire the prerender output into the parity diff.** The current parity gate uses `vite preview`, which serves the bundled SPA. Make sure the prerendered HTML is what gets compared, not the post-hydration React output. Otherwise an SSR mismatch shows up as a parity diff with no obvious cause.
7. **Add a fixture clone in `clones/`** representing a known-good React output, with the parity threshold passing. Cameron remembers one success — capturing what made it work as a regression fixture would change "one-time success" into "regression test".

---

## 9. Gap List For Webapp

What is missing for webapp to be production-ready by V2.0 standards:

1. **No post-emit pipeline.** There is nothing analogous to `post-emit-multi.ts` / `post-emit-multi-react.ts`. The build emits and ends. At minimum:
   - `npm install` + `npm run build` to confirm the project compiles.
   - Render-verification: boot dev server, navigate to each inferred route, confirm `#root` populated and MSW handlers responded.
2. **No parity gate.** `engine/qa/parity-check.ts:38` does not accept `'webapp'`. Pixel parity may not be the right metric for an SPA — but route-by-route screenshot diffing against captured states would still surface regressions.
3. **No multi-page through clone-urls.** `scripts/clone-urls.ts` hardcodes `'astro' | 'react'`. Webapp users must learn a second command shape. V2.0 should unify the entry point.
4. **`crawlDir` smuggled through structural cast.** Either widen `TargetBuildOptions` to include an optional `crawlDir`, or split into target-specific options types. The smuggle works but breaks the abstraction.
5. **`WebappBuildSummary` extensions invisible to generic callers.** `mocksGenerated`, `realtime`, `libs` are webapp-only fields that the dispatcher in `scripts/build.ts` doesn't surface. The reporting layer treats every target identically and drops webapp-specific data on the floor.
6. **Library detection is informational only.** `OUTPUT.md` says "manual-only" for Radix, Framer Motion, shadcn/ui, Uppy, Recharts. The pipeline does not actually wire wrappers for these. The user is left with a SPA shell + a checklist.
7. **No fixture / golden output.** Despite 13 omnisocials clones on disk, none of them have been validated as "this is what a correct webapp clone looks like". Without a fixture, there is no regression target.
8. **The crawler is hard-mode.** `crawler/blocklist.ts:6-37` is conservative by default (delete / logout / publish blocked), but real apps need per-app extras files. The policy is documented (`docs/blocklists/`) but every new app starts from zero.
9. **No prettify or post-format.** Webapp inherits the React `htmlToJsx` converter and inherits all the same numeric-attribute / boolean-attribute / SVG-attribute fragility. None of that is webapp-specific but webapp has no validation to catch it before the user runs the project.
10. **No documentation surface.** `CLAUDE.md` documents the capture / clone pipeline for astro/react and the crawler blocklist policy for webapp, but there is no "what does a webapp clone look like, and how do you know it worked" doc.

---

## 10. The Single Most Surprising Thing

`engine/targets/shared/slice-body.ts` is named target-agnostic, lives in `targets/shared/`, and its own docblock (L26-27) **explicitly says it emits Astro-style frontmatter** that other targets must rewrite. The Astro frontmatter (`---\nimport X from './X.astro'\n---`) is baked into the IR at line 193-204 and every non-Astro target has to undo it. This is the single largest contract violation in the targets layer — the shared layer is leaking Astro shape into every consumer, and the bug-2 tile subdivision fix (also in this file) means the leak is getting actively maintained rather than refactored.

If V2.0 widens the seam, this file is exhibit A for why.

---

## Appendix — File Reference (absolute paths)

Target adapters:
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/types.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/astro/index.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/react/index.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/webapp/index.ts`

Shared layer:
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/index.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/types.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/slice-body.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/extract-head.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/targets/shared/asset-copy.ts`

Orchestrator / post-emit:
- `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/post-emit-multi.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/orchestrator/post-build/post-emit-multi-react.ts`
- `/Users/cameronmcallister/Github/dr-parity/engine/qa/parity-check.ts`

Entry-point scripts:
- `/Users/cameronmcallister/Github/dr-parity/scripts/build.ts`
- `/Users/cameronmcallister/Github/dr-parity/scripts/clone-urls.ts`
- `/Users/cameronmcallister/Github/dr-parity/scripts/clone-site.ts`
- `/Users/cameronmcallister/Github/dr-parity/scripts/crawl-webapp.ts`

Reference outputs:
- `/Users/cameronmcallister/Github/dr-parity/clones/app.omnisocials.com-2026-05-22T05-59-30-232Z/`
- `/Users/cameronmcallister/Github/dr-parity/docs/research/enerblock/EXTRACTION_SUMMARY.md`
- `/Users/cameronmcallister/Github/dr-parity/engine/tests/MULTI_VIEWPORT_FINDINGS.md`

Known issues:
- `/Users/cameronmcallister/Github/dr-parity/bugs.md`

---

## Round 2: Follow-up Answers

### A. The Astro-frontmatter leak in `engine/targets/shared/slice-body.ts`

#### A.1 The lines that emit Astro frontmatter

`engine/targets/shared/slice-body.ts:193-204` (inside `sliceMain`):

```
193    const importLines = mainImportTokens
194      .map((n) => `import ${n} from './${n}.astro';`)
195      .join('\n');
196
197    const composed = mainImportTokens.map((token) => `  <${token} />`).join('\n');
198
199    const mainBody = [
200      '---',
201      importLines,
202      '---',
203      composed.length > 0 ? `${mainOpen}\n${composed}\n${mainClose}` : `${mainOpen}${mainClose}`,
204    ].join('\n');
```

The string `import ${n} from './${n}.astro';` is hard-coded with the `.astro` extension. The `---` fence is hard-coded. Both are Astro-specific. The result lands on `ComponentDef.html` for the `Main` component at L207, and is returned from `sliceBody` as if it were neutral IR.

The contract at `engine/targets/shared/types.ts:5-8` even claims the IR "contain[s] no framework-specific syntax (no `.astro` frontmatter, no JSX) so a React (or any other) target can consume the same output." That comment is contradicted by L193-204.

#### A.2 The lines that undo it in react / webapp

**React single-page:** `engine/targets/react/emit.ts:49-68` (`parseAstroFrontmatter`) and `engine/targets/react/emit.ts:120` (call site inside `writeComponent`). Specifically:

```
49  function parseAstroFrontmatter(html: string): ParsedBody {
50    if (!html.startsWith('---')) {
51      return { imports: [], html };
52    }
53    const closing = html.indexOf('\n---', 3);
54    ...
62    const re = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+['"]\s*;?/g;
```

Plus `preservePascalTags` (`emit.ts:77-90`) and `restorePascalTags` (`emit.ts:92-102`), which exist only to round-trip the PascalCase `<SectionNN_Foo />` references that the Astro composition emits at L197 of `slice-body.ts` through cheerio's HTML lowercasing.

**React multi-page:** the exact same three helpers duplicated at `engine/targets/react/emit-multi.ts:210-250` (`parseAstroFrontmatter`, `preservePascalTags`, `restorePascalTags`). Verbatim copy-paste of the single-page code.

**Astro emit:** `engine/targets/astro/emit.ts:38-46` (`applyIsInlineToComponentHtml`) and `emit.ts:53-55` (`stripTrailingFrontmatter`). Even Astro has to defensively split frontmatter from body before transforming, because the IR carries TypeScript and HTML in the same string.

**Webapp:** `engine/targets/webapp/build.ts:264-265`:

```
264    const pageHtml = components.map((c) => c.html).join('\n');
265    const pageJsx = htmlToJsx(pageHtml);
```

Webapp dodges the leak by accident — it concatenates every component's `html` (including the Main wrapper's `---\nimport ... ---` block) and runs the whole thing through `htmlToJsx`. Cheerio parses the `---` block as a text node and the `import` statements as text. The result is that the Astro frontmatter ends up rendered as **literal text on the page** in the JSX output. That is a real bug, not a clean workaround — it just hasn't been caught yet because nobody pixel-diffs webapp output (gap E in §5.7 of the original audit).

So: react undoes it explicitly with ~80 lines of duplicated helpers across two files; webapp leaks it as visible text; astro tolerates it but still has to split-and-restitch in two places.

#### A.3 Proposed refactor — a truly target-agnostic slicer

The IR should describe the **composition**, not the **source code**. New shape:

```typescript
// engine/targets/shared/types.ts
export interface ComponentDef {
  name: string;
  role: ComponentRole;
  /** Raw outerHTML for THIS node only — never composition syntax. */
  html: string;
  /** Names of child components composed into this one (Main wraps sections). */
  childComponentNames?: string[];
  /** The wrapper tag/attrs if this component composes children
   *  (e.g. <main class="x"> ... </main>). Null when html is the whole node. */
  wrapper?: { openTag: string; closeTag: string } | null;
}
```

`sliceMain` returns `{ main: { name: 'Main', role: 'main', html: '', wrapper: { openTag, closeTag }, childComponentNames: [...] }, sections }`. No `---`, no import string, no `.astro` extension. Just the data each target needs to compose its own output in its own syntax.

**How each target consumes it:**

| Target | Consumption |
|---|---|
| astro | `writeComponent` emits `---\n${childComponentNames.map(n => `import ${n} from './${n}.astro';`).join('\n')}\n---\n${wrapper.openTag}\n${childComponentNames.map(n => `<${n} />`).join('\n')}\n${wrapper.closeTag}` |
| react | `writeComponent` emits `${childComponentNames.map(n => `import { ${n} } from './${n}';`).join('\n')}\n\nexport function Main() { return (<>\n${wrapper.openTag}\n${childComponentNames.map(n => `<${n} />`).join('\n')}\n${wrapper.closeTag}\n</>); }` |
| webapp | Same as react. (Webapp inherits the react emitter.) |

Each target now writes a composition string in its own syntax. No string surgery on `---` blocks. No PascalCase preservation through cheerio. No duplicated `parseAstroFrontmatter` helpers.

#### A.4 Blast radius

Consumer files that change:

| File | Change | Lines |
|---|---|---|
| `engine/targets/shared/slice-body.ts` | Replace L189-204 with structured return | -16, +6 |
| `engine/targets/shared/types.ts` | Extend `ComponentDef` with `wrapper`, `childComponentNames` | +6 |
| `engine/targets/astro/emit.ts` | Add composition path in `writeComponent`; remove `applyIsInlineToComponentHtml` frontmatter sniff (L38-46) and `stripTrailingFrontmatter` (L53-55) | -19, +12 |
| `engine/targets/astro/emit-multi.ts` | Same shape: drop frontmatter splitter at L191-193, L202-214 | -25, +18 |
| `engine/targets/astro/prettify.ts` | Frontmatter splitter at L82-87 can be retired or made the only owner | -10 (or unchanged if kept for safety) |
| `engine/targets/astro/centralize-content.ts` | Frontmatter splitter at L283-288 stays (centralisation is genuinely about astro frontmatter) — no change |
| `engine/targets/react/emit.ts` | Delete `parseAstroFrontmatter` L49-68, `preservePascalTags` L77-90, `restorePascalTags` L92-102; rewrite `writeComponent` to consume `wrapper + childComponentNames` | -54, +20 |
| `engine/targets/react/emit-multi.ts` | Delete `parseAstroFrontmatter` L210-224, `preservePascalTags` L226-238, `restorePascalTags` L240-250; rewrite `writeReactComponentFile` L257-285 | -55, +25 |
| `engine/targets/webapp/build.ts` | Drop the `components.map((c) => c.html).join('\n')` hack at L264; emit a real composition with imports (currently webapp emits one component per route — needs to actually use children) | -2, +12 |
| `engine/targets/webapp/emit.ts` | `writeComponent` learns to take `wrapper + childComponentNames` for composition cases | +15 |

Net: ~−180 / +120 lines. Removes one bug (webapp literal frontmatter text), removes 80+ lines of duplicated helpers, and the shared IR finally matches its own docblock at `types.ts:5-8`.

#### A.5 The Apple tile-subdivision fix on top of the clean slicer

Yes, the tile-subdivision fix at `slice-body.ts:166-178` sits **directly on top of** the leaky `sliceMain` (the `for (const node of childNodes)` loop). It is logically independent of the frontmatter emission though — it modifies which sections get emitted, not how the Main wrapper is composed.

Re-landing on the clean slicer is mechanical:

1. Keep the entire L160-187 loop body unchanged. It already calls `emitSection` which pushes onto `sections[]` and `mainImportTokens[]`.
2. Rename `mainImportTokens` → `childComponentNames`.
3. At the bottom, instead of building the `---`-fenced `mainBody` string, return:

```
return {
  main: {
    name: 'Main',
    role: 'main',
    html: '',
    wrapper: { openTag: `<${mainTag}${attrsString}>`, closeTag: `</${mainTag}>` },
    childComponentNames,
  },
  sections,
};
```

The tile-subdivision logic does not move. Zero behaviour change for the subdivision pass.

---

### B. React: closing the gap to astro-grade reliability

#### B.1 What `media-preserve` does in astro

**File:** `engine/scope-styles/media-preserve.ts:36-61` (`preserveMediaRules`).

**What it preserves:**
1. Reads `analysis/css-rules.json` (the aggregated CSS rule list produced by `extract-css` at `post-emit-multi.ts:174-179`).
2. Filters to rules whose `mediaQuery` field is non-null and non-empty (`media-preserve.ts:45`).
3. Groups them by media query in source order (`groupByMedia` at L81-94) so the cascade matches the capture.
4. Serialises each group as `@media (max-width: 680px) { .foo { ... } }` blocks (`serialiseMediaRules` L96-107).
5. Writes them to `<outDir>/src/styles/responsive.css` (L116-122).
6. Upserts the same block between idempotent markers into `base.css` so the SiteLayout import picks it up without wire-layout changes (L129-141).

**Integration:** wired as phase 2 of 5 in `engine/orchestrator/post-build/post-emit-multi.ts:184-197`.

#### B.2 Why react breaks without it

`MULTI_VIEWPORT_FINDINGS.md` documents the failure mode on the astro path before `media-preserve` was added:

- Source enerblock.com shipped **202 `@media` rule groups** across 22 unique queries (`MULTI_VIEWPORT_FINDINGS.md:36-44`).
- After rebuild: **1 `@media` rule** survived (the hand-authored `prefers-reduced-motion` block from the base-css emitter). That is a 100% loss of responsive CSS (`MULTI_VIEWPORT_FINDINGS.md:62-71`).
- Visual consequence at 1440px desktop viewport: **88.85% pixel diff** vs reference (`MULTI_VIEWPORT_FINDINGS.md:25`), driven by hard-coded `1440px` widths with no responsive collapse (L74-84).
- Root cause cited at `MULTI_VIEWPORT_FINDINGS.md:108-114`: the orchestrator phases walk a single desktop clone's HTML and CSS only. Media queries that target widths other than desktop are present in the captured stylesheets but never emitted into the project.

React today has **the same problem**. `runPostEmitMultiReact` (`post-emit-multi-react.ts:1-18` docblock) explicitly skips the `extract-css` + `media-preserve` phases — "those phases are Astro-shaped". There is no react-side equivalent. Whatever stylesheets the captured `index.html` linked to are the only CSS the rebuilt project gets. If those captured stylesheets were already desktop-flattened during the capture step (as enerblock's were), the rebuilt site has zero responsive behaviour.

The 30.56% pixel diff in the on-disk apple.com react clone (`docs/research/captures/www.apple.com/react-site-urls/parity-report.json:14`) is consistent with this. Apple's hero relies on `@media` rules to lay out tiles — those rules are extracted from inline `<style>` blocks during capture but the react path never re-emits them as a responsive bundle.

#### B.3 Proposed react equivalent

**File location:** `engine/orchestrator/post-build/media-preserve-react.ts` (or just reuse `engine/scope-styles/media-preserve.ts` directly — it is target-agnostic; it reads `analysis/css-rules.json` and writes a CSS file).

**Signature:** identical to the astro one. The file writer just changes the output path:
```typescript
export async function preserveMediaRulesReact(opts: {
  analysisDir: string;
  /** React target writes to src/styles/responsive.css next to globals.css. */
  stylesOutDir: string;
}): Promise<MediaPreserveResult>
```

**Integration point:** insert a new phase between react's current Phase 1 (npm install) and Phase 2 (npm run build) in `engine/orchestrator/post-build/post-emit-multi-react.ts:692-712`. Phase order becomes:

1. `extract-css` (new) — aggregate CSS rules across every clone's stylesheets into `<projectDir>/analysis/css-rules.json`. Reuses the same aggregator the astro path uses at `post-emit-multi.ts:171-179`.
2. `media-preserve` (new) — write `<projectDir>/src/styles/responsive.css`.
3. Mutate `<projectDir>/src/main.tsx` (or `globals.css`) to `import './styles/responsive.css'` once. (The react `writeMain` at `emit.ts:206-240` already imports `./styles/global.css` so this is a one-line addition.)
4. npm install (existing).
5. npm run build (existing).
6. verify-render (existing).

**Effort:** small. The `preserveMediaRules` function is already target-agnostic — it takes `analysisDir` + `stylesOutDir`. The astro caller (`post-emit-multi.ts:184-197`) is literally six lines that can be lifted into the react pipeline with the path arg changed.

**Risk:** low. `media-preserve` is purely additive (writes new CSS file, doesn't mutate existing ones except for the marker block in base.css — which doesn't exist in react). The one risk is that `globals.css` cascade order is now `globals.css → responsive.css`, which means responsive rules win on equal specificity. That matches the astro behaviour where `responsive.css` comes after `base.css`. Acceptable.

#### React punch list (every blocker to ~99% parity)

| # | Item | Effort | Risk | Source |
|---|---|---|---|---|
| 1 | Port `extract-css` + `media-preserve` into react post-emit | S | L | §B.3 above |
| 2 | Tighten verify-render's ignorable-error filter (log a count of suppressed errors per page; whitelist instead of broad path-prefix) | S | L | `post-emit-multi-react.ts:103-160` |
| 3 | Snapshot-test `html-to-jsx` against the 15-20 captured HTML shapes that have broken historically (numeric attrs, boolean attrs, SVG attrs, custom elements, void elements, inline url() styles) | M | L | §3 of the bugs.md → react gaps list |
| 4 | Delete the Astro-frontmatter leak (Section A above) — kills 80+ lines of duplicated string surgery and one webapp bug | M | L | §A above |
| 5 | Verify GAP C is closed by reading `html-to-jsx.ts:548-566` `serialiseStyleValue` — it now routes `url(`, backslash, and unbalanced quotes through a backtick literal. **Already fixed**, just needs a regression test fixture | XS | L | `html-to-jsx.ts:548-566` |
| 6 | Verify GAP E (className whitespace collapse). Read `html-to-jsx.ts:439-444` boolean-attr branch + the renderAttributes plain branch at L463. Class is currently passed verbatim with `quoteForJsx` — captured `class="  foo   bar  "` survives with all whitespace. Add a single `.replace(/\s+/g, ' ').trim()` for `class` only | XS | L | `html-to-jsx.ts:463` |
| 7 | GAP F (no prettify pass). Port `engine/targets/astro/prettify.ts` to react. Astro's roundtrip-verified silent-revert pattern is a good template | M | M (prettier can mangle JSX expressions if not carefully gated) | `engine/targets/astro/prettify.ts` |
| 8 | Wire the **prerendered** HTML into the parity diff, not the post-hydration React output. Currently `parity-check.ts` uses `vite preview` which serves the bundled SPA. If prerender output exists at `dist/index.html`, the parity gate should compare against that first | S | M | §8 item 6 of original audit |
| 9 | Add a known-good react fixture clone under `clones/` so regressions have a target. Cameron's "one successful clone" was never preserved | S | L | §C below |
| 10 | Re-run apple.com end-to-end and inspect `parity-report.json` after items 1, 2, 6 land. The on-disk report shows 30.56% diff (`parity-report.json:14`) — items 1+6 should drop that materially | XS | L | `docs/research/captures/www.apple.com/react-site-urls/parity-report.json` |
| 11 | `centralizeContent` / `EDIT.md` for react. Cosmetic. Not parity-critical | M | L | bugs.md GAP G |

XS=<1h, S=2-4h, M=1-2d, L=3-5d.

The big rocks are items 1, 3, and 4. After those: items 2, 6, 8 are each a few hours. The on-disk apple.com report is the canonical regression target.

---

### C. The "one successful react clone" mystery

#### What is on disk

- **One react project on disk:** `docs/research/captures/www.apple.com/react-site-urls/` (a full Vite + React project; `node_modules` is installed, `package-lock.json` exists, `parity-report.json` is present).
- **The parity report says it FAILED:** `parity-report.json:22` reads `"allPassed": false`. Desktop diff was 30.56% (threshold 5%). One viewport. Timestamp `2026-05-22T07:09:33` (today).
- **No older react project exists.** There is no historical `react-site-urls` or equivalent under `clones/`, no other site under `docs/research/captures/*/react*`. The only artefact of a react run is today's apple.com attempt, which failed the gate.

#### Timeline (best-effort, from filesystem + bugs.md + audit)

1. **Pre-2026-05-22.** Cameron remembers running a react clone that "worked." Per the original audit §4.6, that success is referenced in `bugs.md` but no URL is named. No artefact survives on disk.
2. **2026-05-22 (today).** Cameron tried apple.com. The run surfaced three pipeline bugs (`bugs.md` lines 3-30: type=module hoisting into /public; only 3 of ~12 tiles rendered; 153 font 404s) plus four architectural gaps (`bugs.md:34-63`: tabIndex string vs number broke `tsc`; no react post-emit; inline `url()` style mangling; parity harness orphaned).
3. **2026-05-22 (later today).** The gaps were patched (audit §4.7): `tabIndex` numeric attrs, post-emit-multi-react wiring, `serialiseStyleValue` backtick path, parity gate accepts `'react'`. The apple.com run from `react-site-urls/` was produced AFTER these patches — and still diffed 30.56% (i.e. the patches unblocked the build and got verify-render to pass, but the underlying media-preserve / tile-subdivision parity issues are not yet resolved).

#### Hypothesis

Cameron's "one successful clone" was almost certainly run against a **simpler site** (very likely something static like vivre.agency, enerblock.com, or a similar low-JS landing page) at a moment when:

- The site happened to have no `@media` rules captured into inline styles (so the missing media-preserve phase didn't matter).
- The site had no Apple-style tile-nesting (so the missing subdivision logic in `slice-body.ts:166-178` didn't matter).
- The site had no problematic inline `url(...)` background images (so `parseInlineStyle` didn't blow up).
- All script tags were classic scripts, not `type="module"` pointing into `/public`.
- All HTML attributes happened to fall inside React's accepted shapes (no `tabindex`, no exotic boolean attrs).
- The captured DOM was small enough that the 3-section limit from non-subdivided `<section>` wrappers didn't lose visible content.

In other words: the success was a sampling artefact. The react pipeline had ~5 latent failure modes; on a sufficiently simple site, **all five** happened not to fire. On apple.com (the next site Cameron tried), at least three fired simultaneously, and the run failed loudly.

This is consistent with how all the gaps were *only* discovered when bugs.md was written today. Nobody knew GAP A (tabIndex) existed until apple.com hit it.

#### Why it has not been replicable

Because the react path's failure modes are **input-dependent**. Running the same simple site again should still succeed. Running ANY apple-class site fails until items 1, 3, 4 from §B's punch list land.

**Action:** the highest-value diagnostic Cameron can run right now is to re-clone the original "successful" site (whatever it was — vivre.agency is the most likely candidate based on captures on disk at `docs/research/captures/vivre.agency/`) with `--target=react` and confirm it still passes. If it does, the success was real and the failure modes are input-dependent. If it now also fails, something else regressed in the meantime — and the git log between the success window and today is the place to look.

#### Credible explanation

Yes. The mystery is "the failure modes are input-dependent and Apple is a hard target." Not a flaky pipeline that randomly works once. The next simple-site react run should reproduce the success.

---

### D. Webapp: the post-emit gap

#### D.1 What "install / build / verify-render / parity-gate" should do for a webapp target

| Phase | What it does | Why webapp needs it |
|---|---|---|
| 1. **install** | `npm install` in `<outDir>`. Identical to react. | Standard. |
| 2. **build** | `npm run build` (currently `tsc -b && vite build`). Identical to react. Build failure surfaces JSX/TS errors before runtime. | The webapp emit pipeline writes a real Vite project; if it doesn't build, downstream phases are pointless. |
| 3. **msw-boot-check** | Spin up `vite preview`, navigate to `/`, confirm `window.__MSW_WORKER__` or the equivalent registration flag exists and that the MSW worker file responds at `/mockServiceWorker.js`. | Webapp's parity is interactive parity. If MSW didn't boot, every captured API call falls through to the network and the SPA renders as if the user were logged out. |
| 4. **route-render-check** | For each inferred route in the crawl graph, navigate to that route, wait for `#root` to populate, capture a screenshot, and check the route's MSW-handled fetches actually fired (via Playwright route interception). | Different from static parity. A "page" in webapp is a route + a hydrated state. Empty `#root` or unfired MSW handlers = silent failure. |
| 5. **state-toggle-check** | For each inferred state toggle (the Phase-3 `inferStateGroups` output), Playwright-click the toggle and assert the DOM mutated to the inferred post-state. | The captured-vs-emitted state machine is the whole point of webapp. If toggles don't toggle, the clone is dead. |
| 6. **library-wrap-check** | For each library flagged `auto-wrap` (not `manual-only`) in OUTPUT.md, assert the wrapper component mounts without console errors. | The Library Swap Report currently flags 5+ libs as `manual-only`. Anything `auto-wrap` (future) needs verification. |
| 7. **parity-gate** | Pixel-diff each route's rendered screenshot against its captured state DOM screenshot, NOT against a fresh-from-network capture of the original site. | Webapps require auth, cookies, time-varying data — the captured state IS the ground truth, not a live URL. |

#### D.2 Why webapp needs different render verification than a static site

Static-site verify-render (astro / react) checks: HTTP 200, body innerText > 100 chars, no console errors, no failed same-origin requests. That is enough because the page is static HTML — if those four pass, the user will see content.

Webapp is a different beast:

- **Runtime JS is the page.** A passing HTTP 200 + populated `#root` only means React mounted. It does not mean the captured route's state actually rendered. Route `/posts/123` might mount `<PostPage>` with `posts: []` (because MSW didn't intercept the fetch in time) and look identical to a 404 state.
- **MSW boots async.** `await worker.start({ onUnhandledRequest: 'bypass' })` is awaited in `bootstrap()` (`webapp/emit.ts:159-165`) BEFORE React renders. If MSW fails to register the service worker (CSP issue, scope mismatch), the SPA renders against the real network — which means real auth failures, real CORS failures, real data leaks. The static-site checks would still pass.
- **Websockets need their own check.** The captured frame log feeds `mocks/socket.ts`. If the socket mock isn't started, components subscribed to `useSocket()` hang in loading state forever. Static-site checks wouldn't catch that.
- **Library identity matters.** If the captured site uses Radix `<Dialog>` and the clone uses unwrapped HTML, the route renders something — but it isn't the same component tree. A pixel-diff might pass while the interactive semantics are broken.

#### D.3 File-by-file proposal

New files (all under `engine/orchestrator/post-build/webapp/`):

| File | Signature | Responsibility |
|---|---|---|
| `engine/orchestrator/post-build/webapp/install-build.ts` | `runInstallBuild(opts: { projectDir: string }): Promise<{ built: boolean; exitCode: number }>` | npm install + npm run build. Lifted near-verbatim from `post-emit-multi-react.ts:692-712`. |
| `engine/orchestrator/post-build/webapp/msw-boot-check.ts` | `verifyMswBoot(opts: { projectDir: string; port: number }): Promise<{ booted: boolean; reasons: string[] }>` | Boot vite preview, navigate to `/`, evaluate `window.__MSW_READY__` (added by emitted `main.tsx`), confirm `/mockServiceWorker.js` returns 200. |
| `engine/orchestrator/post-build/webapp/route-render-check.ts` | `verifyRoutes(opts: { port: number; routes: RouteEntry[]; crawlGraph: CrawlGraph }): Promise<{ failures: RouteFailure[] }>` | Per route: navigate, wait for `#root` to populate, assert each MSW handler the captured state expected actually fired. |
| `engine/orchestrator/post-build/webapp/state-toggle-check.ts` | `verifyStateToggles(opts: { port: number; toggles: StateToggle[] }): Promise<{ failures: ToggleFailure[] }>` | For each `StateToggle` in the inference output, click and assert the post-state mutation. |
| `engine/orchestrator/post-build/webapp/parity-gate.ts` | `runWebappParity(opts: { projectDir: string; capturedStateDir: string; threshold: number }): Promise<ParityResult>` | Pixel-diff each route's rendered screenshot vs the captured state DOM screenshot. NOT against `originalUrl`. |
| `engine/orchestrator/post-build/post-emit-multi-webapp.ts` | `runPostEmitMultiWebapp(opts: { projectDir: string; crawlDir: string; viewports: string[] }): Promise<void>` | Orchestrator. Mirrors `post-emit-multi-react.ts` shape: composes the six steps above with try/finally cleanup. |

**Integration with `scripts/clone-urls.ts`:** see D.4 below — `clone-urls.ts:48` currently restricts the target type to `'astro' | 'react'`. Webapp needs to be added to that type. Once it is, `scripts/clone-urls.ts:427` (the post-emit dispatch) gets a third branch:

```typescript
} else if (args.target === 'webapp') {
  const { runPostEmitMultiWebapp } = await import(
    '../engine/orchestrator/post-build/post-emit-multi-webapp'
  );
  await runPostEmitMultiWebapp({
    projectDir: projectOut,
    crawlDir: args.crawlDir!,  // requires CliArgs.crawlDir
    viewports: viewportList,
  });
}
```

**Effort per phase:**

| Phase | Effort | Notes |
|---|---|---|
| install-build | XS | Direct copy from react. |
| msw-boot-check | S | Needs a small addition to emitted `main.tsx` to set `window.__MSW_READY__` after `worker.start()` resolves. |
| route-render-check | M | The "did this handler fire" assertion requires Playwright route interception against the preview server. Designable but new code. |
| state-toggle-check | M-L | Depends on how stable the Phase-3 inference output is. The toggles need stable selectors (the inference produces something — needs audit). |
| library-wrap-check | S | For Phase 1 just verify the wrappers mount. Deep semantic checks come later. |
| parity-gate | M | The trickiest part is the per-route reference: we need to capture per-route DOM screenshots during the crawl (`crawler/route-recapture.ts` already exists — needs an explicit screenshot output) and store them next to `network.jsonl`. |

Total: ~2 weeks of focused work for v1 of all six phases. install-build + msw-boot-check + route-render-check (~3 days) would already lift webapp from "no validation" to "smoke-tested per route." Items 4-6 are quality refinements.

#### D.4 `scripts/clone-urls.ts:48` minimum change

Today:

```typescript
type TargetName = 'astro' | 'react';
```

Minimum change to accept webapp:

1. `scripts/clone-urls.ts:48` → `type TargetName = 'astro' | 'react' | 'webapp';`
2. `scripts/clone-urls.ts:150` → update the validation error: `must be astro, react, or webapp`.
3. `scripts/clone-urls.ts:161` (`resolveAdapter`) → import and add `webappAdapter` branch.
4. **The harder part:** webapp doesn't take a `cloneDir` list directly — its multi-page input is a `crawlDir` with a graph. So `clone-urls.ts` needs to either (a) accept `--crawl-dir=<dir>` and skip its own per-URL capture loop (effectively becoming a thin wrapper around `scripts/build.ts --target=webapp --crawl-dir=...` + post-emit), or (b) drive the crawler inline (which means making `crawl-webapp.ts` importable, not just executable).
5. Add `args.crawlDir?: string` to `CliArgs` (`clone-urls.ts:50-65`).
6. Branch the orchestration: when `args.target === 'webapp'`, skip the per-URL capture chain (L402-489 is astro/react-shaped). Either invoke the crawler in-process or require `--crawl-dir=` and run from there.
7. Widen `TargetBuildOptions` in `engine/targets/types.ts:12-23` to include `crawlDir?: string` so the structural cast at `engine/targets/webapp/index.ts:117` becomes a real field. This is small but high-value — it ends the smuggle described in the original audit §5.7.

Items 1-3 are 10 lines. Item 4-6 is a real refactor (the equivalent of porting the multi-page driver to a third input shape). Item 7 is two lines + the cast removal.

---

### E. The unified `PostEmitPipeline` contract

```typescript
// engine/orchestrator/post-build/types.ts

export interface PostEmitContext {
  /** Target project root (output of adapter.buildMulti). */
  projectDir: string;
  /** Site-level manifest written by the driver script. */
  manifestPath: string;
  /** Viewports the user requested (informational; phases may ignore). */
  viewports: readonly string[];
  /** Per-page clone dirs (astro/react) OR crawl graph dir (webapp). */
  inputs:
    | { kind: 'clones'; cloneDirs: readonly string[] }
    | { kind: 'crawl'; crawlDir: string };
}

export interface PhaseResult {
  name: string;
  status: 'ok' | 'skipped' | 'failed';
  durationMs: number;
  /** Optional structured payload for downstream phases. */
  data?: unknown;
  /** Optional one-sentence diagnostic. */
  detail?: string;
}

export interface PostEmitReport {
  target: 'astro' | 'react' | 'webapp';
  projectDir: string;
  phases: PhaseResult[];
  parity: ParityResult | null;
  passed: boolean;
}

export interface PostEmitPipeline {
  target: 'astro' | 'react' | 'webapp';

  /** Stage 1: framework-shaped CSS / content analysis. May no-op. */
  analyze?(ctx: PostEmitContext): Promise<PhaseResult[]>;

  /** Stage 2: install dependencies. Mandatory for all real targets. */
  install(ctx: PostEmitContext): Promise<PhaseResult>;

  /** Stage 3: produce a built artefact. Mandatory. */
  build(ctx: PostEmitContext): Promise<PhaseResult>;

  /** Stage 4: smoke-test the built artefact. Mandatory. */
  renderCheck(ctx: PostEmitContext): Promise<PhaseResult>;

  /** Stage 5: framework-extras. May no-op. */
  extras?(ctx: PostEmitContext): Promise<PhaseResult[]>;

  /** Stage 6: parity gate. Mandatory. May internally skip. */
  parityGate(ctx: PostEmitContext): Promise<ParityResult>;
}

export async function runPostEmit(
  pipeline: PostEmitPipeline,
  ctx: PostEmitContext,
): Promise<PostEmitReport> { /* sequencing, timing, error envelope */ }
```

#### How astro's current six-phase pipeline maps

| Current phase (`post-emit-multi.ts`) | New stage | Notes |
|---|---|---|
| L171-179 `extract-css` | `analyze[0]` | Returns `data: { cssRulesPath, count }`. |
| L184-197 `media-preserve` | `analyze[1]` | Consumes `analyze[0].data`. |
| L202-214 `centralise-content` | `extras[0]` | Astro-only; webapp/react would not implement. |
| L219-249 `npm install` + `npm run build` | `install` + `build` | Two separate stage methods. |
| L255-264 `edit-playbook` | `extras[1]` | Astro-only. |
| L269-287 `verify-render` | `renderCheck` | The shape is identical to react's verify-render. |
| (separate) `runParityCheck` in `clone-urls.ts:469-477` | `parityGate` | Lifted into the pipeline rather than driven by the script. |

#### How react's partial pipeline maps

| Current phase (`post-emit-multi-react.ts`) | New stage |
|---|---|
| Phase 1 (`L692-703`) npm install | `install` |
| Phase 2 (`L705-712`) npm run build | `build` |
| Phase 3 (`L714-724`) verify-render | `renderCheck` |
| `analyze` | (no-op v0; v1 lands media-preserve here per §B) |
| `extras` | (no-op v0; v1 lands prettify + EDIT.md here) |
| `parityGate` | Pull `runParityCheck` call out of `clone-urls.ts` into the pipeline |

#### The no-op shape webapp ships v0 with

```typescript
// engine/orchestrator/post-build/webapp-pipeline.ts (v0)
export const webappPostEmitV0: PostEmitPipeline = {
  target: 'webapp',
  async install(ctx) {
    return spawnAndWrap('npm', ['install', '--no-audit', '--no-fund'], ctx.projectDir, 'install');
  },
  async build(ctx) {
    return spawnAndWrap('npm', ['run', 'build'], ctx.projectDir, 'build');
  },
  async renderCheck(_ctx) {
    return { name: 'render-check', status: 'skipped', durationMs: 0, detail: 'webapp v0: no render check' };
  },
  async parityGate(_ctx) {
    return { allPassed: true, viewports: [], reportPath: '', threshold: 0 };
  },
};
```

v1 lands `renderCheck` (the §D.3 msw-boot + route-render checks) and a real `parityGate`. v2 adds `analyze` (extract CSS from per-route DOM captures) and `extras` (library-wrap-check + state-toggle-check).

**This dovetails with Agent 2's `TargetAdapter` v2** because the post-emit pipeline is the natural other half of the adapter. v2 of the adapter is:

```typescript
export interface TargetAdapter {
  name: 'astro' | 'react' | 'webapp';
  build(options: TargetBuildOptions): Promise<TargetBuildSummary>;
  buildMulti?(options: TargetMultiBuildOptions): Promise<TargetMultiBuildSummary>;
  postEmit: PostEmitPipeline;  // NEW
}
```

The driver script (`scripts/clone-urls.ts`) becomes:

```typescript
const summary = await adapter.buildMulti(...);
const report  = await runPostEmit(adapter.postEmit, ctx);
if (!report.passed) process.exit(1);
```

Three targets, one driver, one contract.

---

### F. Cross-target standardisation — concrete diffs

#### Pattern 1: Driver script accepts all three targets

**Today:**
- `scripts/clone-urls.ts:48` types `target` as `'astro' | 'react'`. Webapp uses `scripts/build.ts` with `--crawl-dir=...`.
- Operators learn two different command shapes.
- The end-to-end flow (capture → parse → clone → emit → post-emit → parity gate) only runs for astro/react.

**V2.0 standardises to:**
- One driver script that accepts all three targets.
- For astro/react: today's per-URL capture chain.
- For webapp: skip capture chain (the crawler produces `crawlDir`), call `adapter.buildMulti` with `inputs: { kind: 'crawl', crawlDir }`, then `runPostEmit(adapter.postEmit, ctx)`.

**Refactor diff:**
- `scripts/clone-urls.ts`: ~80 lines changed (+30 webapp branch, -10 hardcoded type narrowing, ~40 lines refactored for two-input-shape handling).
- `engine/targets/types.ts`: +12 lines (`crawlDir?: string` on `TargetBuildOptions`, new `inputs` discriminated union if v2).
- `engine/targets/webapp/index.ts:117`: −2 lines (the structural cast goes away).

**Risk:** medium. The per-URL capture loop is currently quite linear; carving out a webapp branch that skips it without confusing the resume-on-failure logic at `clone-urls.ts:402-489` needs care. Mitigation: keep the capture loop guarded behind an `if (args.target !== 'webapp')` and exit early into the webapp post-emit branch.

#### Pattern 2: Body slice IR is genuinely target-neutral

**Today:**
- `engine/targets/shared/slice-body.ts:193-204` emits Astro-style `---` frontmatter on the Main wrapper.
- React duplicates `parseAstroFrontmatter` + `preservePascalTags` + `restorePascalTags` in BOTH `emit.ts` and `emit-multi.ts` (~80 lines of duplicated code).
- Webapp silently embeds the frontmatter as visible text.

**V2.0 standardises to:**
- The Section A.3 refactor: `ComponentDef` carries `wrapper` + `childComponentNames`, never composition syntax.
- Each target writes its own composition in its own syntax.

**Refactor diff:** see §A.4. ~−180 / +120 lines across 10 files. Net ~−60 lines.

**Risk:** low. The refactor is mechanical and each target's emit is small enough to update in one pass. The Astro target's existing roundtrip-verified prettify pass (`engine/targets/astro/prettify.ts:95-110`) is a safety net — if the new composition produces structurally identical Astro components, prettify is a no-op; if not, prettify silently reverts and we see byte differences in test diffs.

#### Pattern 3: Post-emit pipeline is a contract, not three scripts

**Today:**
- `engine/orchestrator/post-build/post-emit-multi.ts` (astro, ~290 lines).
- `engine/orchestrator/post-build/post-emit-multi-react.ts` (react, ~726 lines).
- Webapp has nothing.
- The two scripts share concepts (install, build, verify-render) but no code. `runPostEmitMultiReact` invents its own port-finder, vite-preview-watcher, ignorable-error filter. The astro version invents its own equivalent. Neither one is reusable.

**V2.0 standardises to:**
- `engine/orchestrator/post-build/types.ts`: `PostEmitPipeline` contract (Section E).
- `engine/orchestrator/post-build/runner.ts`: `runPostEmit(pipeline, ctx)` — sequencing, timing, error envelope.
- `engine/orchestrator/post-build/shared/`: extract the reusable bits — port finder, vite-preview spawner, playwright session helper, ignorable-error classifier. All three targets share these.
- `engine/orchestrator/post-build/astro-pipeline.ts`, `react-pipeline.ts`, `webapp-pipeline.ts`: implement `PostEmitPipeline` for each target.

**Refactor diff:**
- New files: `types.ts`, `runner.ts`, `shared/preview-server.ts`, `shared/playwright-session.ts`, `shared/error-classifier.ts` — ~400 lines new.
- `post-emit-multi.ts` and `post-emit-multi-react.ts` shrink to ~80 lines each (just their pipeline definition) — net ~−800 lines.
- `webapp-pipeline.ts` is new — ~120 lines for v0, ~300 for v1.
- `scripts/clone-urls.ts:418-460`: three-branch dispatcher collapses to one line: `const report = await runPostEmit(adapter.postEmit, ctx)`. Net ~−40 lines.

**Risk:** medium. The trickiest part is that `post-emit-multi-react.ts` has accumulated very specific error-classifier logic for Apple-flavoured noise (`HYDRATION_MISMATCH_PATTERNS`, `THIRD_PARTY_MESSAGE_PATTERNS`, `THIRD_PARTY_PATH_PREFIXES`). Lifting that into a shared classifier without losing the calibration that was done is the main work. Mitigation: keep the classifier configurable per target (`shared/error-classifier.ts` accepts an options bag), and seed the react pipeline with today's exact patterns.

---

### G. The Astro-grade parity bar

The five technical properties that make astro reliable that the others lack:

#### G.1 No framework syntax conversion

**Astro:** the `.astro` file format is essentially captured HTML with an import block on top. Class names stay `class=`. Attributes stay hyphenated. Boolean attrs stay as-is. SVG attrs stay as-is. Inline styles stay as `style="..."`. The slicer outputs strings; astro writes them to disk.

**React:** every captured DOM node must be re-serialised as JSX. `class` → `className`. `for` → `htmlFor`. `tabindex` → `tabIndex={-1}`. SVG `stroke-width` → `strokeWidth`. Inline `style="..."` → `style={{ ... }}` object literal. Plus boolean attrs (`disabled`, `playsinline`), void elements (`<br />`), custom elements (`<a-link>`, `<swiper-slider>`), `<script>` / `<style>` wrapping in `dangerouslySetInnerHTML`. The converter at `html-to-jsx.ts` has accumulated **five lookup tables** (`NUMERIC_HTML_ATTRS`, `IE_ONLY_ATTRS`, `BOOLEAN_ATTRS`, `ATTR_MAP`, `VOID_ELEMENTS`) and each new site finds a new edge case.

**Portable?** No, not really. The cost of "no conversion" is the cost of switching to a framework that accepts HTML verbatim. There is no React-shaped equivalent. The best portable mitigation is: **(a) snapshot-test the converter against the 20 captured HTML shapes that have broken historically**, so new bugs are caught at test time not at clone time; **(b) treat the converter as a list of known fragilities, not a complete spec.**

Cost to react: M (a one-time investment to build the snapshot harness, then small per-bug).

#### G.2 SSR-by-default static output

**Astro:** the page is static HTML at request time. Scripts run on first paint as they would on the source. There is no hydration step, so no hydration mismatch noise.

**React:** even with the new prerender pass (`scaffold.ts:39` runs `tsx src/prerender.tsx`), the captured HTML still goes through React's renderer, which normalises whitespace, comment ordering, and element ordering differently from the source. The verify-render filter at `post-emit-multi-react.ts:74-86` downgrades React errors #418-#426 to warnings precisely because of this. Real hydration bugs that affect parity hide behind the same filter.

**Webapp:** worse — the SPA mounts after MSW boot, so the initial HTML is `<div id="root"></div>` and everything is post-hydration.

**Portable?** Partially. React has it (prerender pass already lands). Webapp could land a prerender pass for the initial route, but most webapp routes are stateful so static prerender doesn't help. The portable mitigation is **(a) compare against prerendered HTML, not post-hydration React output, in the parity gate** (item 8 of the react punch list); **(b) tighten the hydration-mismatch ignore list to log a count per page instead of silently swallowing**, so real React bugs surface.

Cost to react: S. Cost to webapp: L (per-route prerender of stateful pages is hard; the realistic answer is "webapp uses per-route DOM captures from the crawl as ground truth, not a prerendered string").

#### G.3 Comprehensive post-emit pipeline

**Astro:** six phases (extract-css, media-preserve, centralise-content, install, build, verify-render) — `post-emit-multi.ts:171-287`. Each phase emits artefacts the next phase consumes (`analysis/css-rules.json`, `src/styles/responsive.css`, `src/content/site.ts`).

**React:** three phases (install, build, verify-render). No CSS aggregation, no media-preserve, no content extraction.

**Webapp:** zero phases.

**Portable?** Yes, almost entirely. Section B.3 + Section D.3 + Section E lay out the port. `media-preserve` is already target-agnostic — it reads `analysis/css-rules.json` and writes a CSS file. The orchestrator scaffolding (install, build, verify-render) is mechanical to port.

Cost to react: S-M. Cost to webapp: M-L (the verify-render shape is genuinely different — see §D.2).

#### G.4 Hard parity gate

**Astro:** `runParityCheck` is wired as a hard gate in `clone-urls.ts:462-489`. A diff above threshold = exit 1.

**React:** also wired (today). Same gate, same threshold defaults.

**Webapp:** none. `engine/qa/parity-check.ts:38` doesn't accept `'webapp'`.

**Portable?** Yes. Webapp needs a different reference (captured per-route DOM, not a fresh-from-URL screenshot) but the diff machinery is identical. Section D.3 phase 7.

Cost to webapp: M.

#### G.5 Roundtrip-verified prettify with silent revert

**Astro:** `engine/targets/astro/prettify.ts` runs an AST-safe prettify pass that compares input AST to output AST. If they differ structurally, the change is silently reverted. The result: prettify never breaks parity, even when it doesn't run cleanly.

**React:** no prettify pass at all. Emitted `.tsx` is unreadable, but more importantly, there is no roundtrip safety check on any post-emit modification.

**Webapp:** same as react.

**Portable?** Yes, with adaptation. The pattern is "compare AST before/after, revert on drift." It applies to any string transformation on emitted code. Prettify is the obvious user, but the same scaffolding would protect future passes (e.g. a "rewrite imports for code-splitting" pass).

Cost to react: M. Cost to webapp: M (same code).

#### Bonus G.6: Astro file format is the IR

**Astro:** the IR (`ComponentDef.html`) IS approximately the on-disk file format. Read-write roundtrip is byte-stable. This is why the (admittedly leaky) `---` frontmatter in the IR works at all — astro emit literally writes it to disk.

**React:** the IR is HTML, the output is JSX. Every component goes through a string-rewriting pipeline. There is no "roundtrip" — the conversion is one-way.

**Portable?** No. This is a structural advantage astro has by virtue of being chosen as the target framework. The mitigation is item G.1 — snapshot-test the converter.

---

## Round 2 — TL;DR

- **Clean refactor for `slice-body.ts`:** drop the `---`/`.astro`/`import` string-building from `sliceMain` and return `{ wrapper: { openTag, closeTag }, childComponentNames }`; let each target write its own composition syntax.

- **Highest-leverage react fix:** port `extract-css` + `media-preserve` from astro into `runPostEmitMultiReact`. The `preserveMediaRules` function is already target-agnostic and the apple.com 30.56% pixel diff is almost certainly dominated by lost responsive CSS.

- **Highest-leverage webapp fix:** widen `TargetBuildOptions` to include `crawlDir?: string` (kills the structural cast), add webapp to `scripts/clone-urls.ts:48`'s target type, and ship `engine/orchestrator/post-build/post-emit-multi-webapp.ts` with install + build + msw-boot-check + route-render-check. That single change moves webapp from "zero validation" to "smoke-tested per route" and ends the second-CLI-shape problem.

- **The "one successful react clone" mystery:** has a credible explanation. The success was input-dependent — the react pipeline had ~5 latent failure modes and the original target site happened not to trigger any of them. Apple.com triggers at least three. The next simple-site react run (likely vivre.agency) should reproduce the success and confirm the hypothesis.

- **Realistic in V2.0?** React to ~99% parity is realistic in V2.0 if the media-preserve port, the Astro-frontmatter refactor, and the html-to-jsx snapshot harness all land (~2 weeks). Webapp to astro-grade parity is longer-term — the problem class is different (interactive, not pixel), so the right v2 goal is "route-level smoke + state-toggle assertions pass," not "99.99% pixel diff."

