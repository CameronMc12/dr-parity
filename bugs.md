# Bugs / Workflow Issues

## 2026-05-20 — `/clone-website` skill steers users away from `build:react` deterministic pipeline

### Symptom
When invoked on an authenticated SPA (e.g. https://app.omnisocials.com),
the `/clone-website` skill in `.claude/skills/clone-website/SKILL.md`
directs agents straight to Phase 3.2 "Dispatch Builder Agents" — i.e.
AI agents reading `builder-prompts/` and **handwriting** JSX.

This bypasses the existing deterministic React emitter:

```
npm run build:react                                      # tsx scripts/build.ts --target=react
npx tsx scripts/clone-urls.ts --target=react ...         # multi page (was build:react:multi)
```

backed by `engine/targets/react/{build,emit,emit-multi,html-to-jsx,scaffold,scaffold-multi}.ts`
— which **slices the captured HTML into JSX without any AI involvement**,
the same way `build:astro` works.

### Impact
- For app-style clones (sidebars, dashboards, lots of repeated layout)
  the AI-builder path produces lower-fidelity output and costs
  significantly more (token + wallclock).
- Users who used `build:astro` previously expect `build:react` to be the
  default for "give me this site in React". The skill quietly takes a
  different path.
- The skill never mentions `build:react`, `build:react:multi`,
  `engine/targets/react/`, `html-to-jsx.ts`, or `parse:har`/`parse:trace`/
  `clone` as a chain. Phase 1 jumps from `extract.ts` directly to
  "Dispatch Builder Agents".

### Correct chain for the deterministic path
```
1. npm run capture -- <url> [--mode=persistent for authed]
2. npm run parse:har -- <capture-dir>
3. npm run parse:trace -- <capture-dir>
4. npm run clone -- <capture-dir>
5. npx tsx scripts/clone-urls.ts --target=react \
     --clone-dir=<clone-dir-1>:/  \
     --clone-dir=<clone-dir-2>:/route-2 \
     --out-dir=<out>
```

### Suggested fix
1. Update `.claude/skills/clone-website/SKILL.md` so Phase 3 presents
   **two paths** explicitly:
   - **Deterministic (default)** — `build:react` / `build:react:multi`
     from clone dirs. Fast, automated, no AI for the translation. Use
     for app shells, dashboards, multi-route SaaS, anything where the
     value is "this looks identical in React".
   - **AI-builder (opt-in)** — `extract.ts` + `builder-prompts/` +
     parallel AI builders. Use for marketing pages where component
     naming and structure benefit from judgment.
2. Add a one-liner in `CLAUDE.md` / `AGENTS.md` calling out the two
   modes so new contributors don't pattern-match the skill straight to
   the AI path.
3. The skill should mention that captures from a previous `extract.ts`
   run are NOT reusable as inputs to `build:react` — that needs
   `clone/` dirs produced by `clone.ts`. This was the trap that wasted
   work on the omnichannel-clone setup on 2026-05-20.

### Related secondary bug
`scripts/extract.ts` writes builder prompts to
`<outputDir>/docs/research/prompts/` (double-nested path) when
`--output` is a non-default value. The prompts directory is resolved
relative to a hardcoded base instead of the supplied output dir, so
multiple per-route extractions overwrite each other in
`docs/research/docs/research/prompts/`. See
`engine/generate/builder-prompts.ts` for the path resolution.

### Reproduced on
- dr-parity HEAD as of 2026-05-20
- Cloning https://app.omnisocials.com into /Users/cameronmcallister/Github/omnichannel-clone
- Node 25.9.0, Playwright 1.60


## 2026-05-20 — Clone pipeline emits empty HTML for client-rendered SPAs

### Symptom
Running the deterministic chain `capture` → `parse:har` → `parse:trace` →
`clone` → `build:react:multi` on a client-rendered React SPA (e.g.
https://app.omnisocials.com) produces a Vite + React project where every
page body is empty — only the cookie banner / pre-React placeholder shows
up. The `screenshot.png` captured by Playwright shows the **full hydrated
app** (sidebar, calendar, user menu), but the emitted JSX has none of it.

### Root cause
`parse-har.ts` derives `parsed/document.html` from the **document
response in the captured network log** (`network.json` for persistent /
cdp modes, `network.har` for launch mode). For SPAs that response is the
initial empty shell — typically `<body><div id="root"></div></body>`
plus a `<script type="module" src="/assets/index-*.js">` tag.

`clone.ts` uses that empty shell as the source of truth for HTML
rewriting. The React/JSX emitter (`html-to-jsx.ts`) then has nothing to
slice, so each page emits a near-empty component.

### Why the screenshot still looks right
Playwright takes the screenshot **after** hydration. So
`docs/research/captures/<host>/<ts>/<viewport>/screenshot.png` is the
real app — but the screenshot is never fed into `parse-har` or `clone`.

### Suggested fix
Capture a **post-hydration DOM snapshot** alongside the screenshot, and
prefer it as the document source when present:

1. In `engine/extract/capture/tour.ts` (or wherever the tour ends),
   after the wait/scroll/hover pass, call
   `const html = await page.content()` and write it to
   `<capture-dir>/<viewport>/dom-snapshot.html`.
2. In `scripts/parse-har.ts` (or `engine/extract/parse/...`), when
   writing `parsed/document.html`, prefer `dom-snapshot.html` from the
   capture dir if it exists, fall back to the network-recorded document
   if not.
3. Optional: skip the rewriting entirely for the document body when the
   hydrated snapshot already has resolved local asset paths — but for
   the first pass, just running the existing URL rewriter against the
   hydrated HTML is enough to produce a working clone.

### Workaround (used on 2026-05-20)
Wrote `scripts/snapshot-hydrated.ts` that re-visits each route using the
persistent profile, waits for hydration, runs `page.content()`, and
overwrites `<capture>/<viewport>/parsed/document.html`. Then re-runs
`npm run clone` and `build:react:multi`. This restores the real DOM in
the emitted React project.

### Reproduced on
- dr-parity HEAD as of 2026-05-20
- Cloning https://app.omnisocials.com into /Users/cameronmcallister/Github/omnichannel-clone
- Node 25.9.0, Playwright 1.60


## 2026-05-20 — Bug 3: React emitter produces TSC errors on captured inline `style="..."` values

### Symptom
After running the deterministic React chain, `npx tsc --noEmit` in the emitted react-app reported ~140 `TS2322` errors against inline `style={{...}}` objects (numeric CSS values rejected as strings, numeric HTML attrs rejected as strings, and `!important` strings rejected as invalid React CSSProperties values).

### Diagnosis history
1. **Phase 1 fix** — coerced unitless numeric CSS values (`zIndex`, `opacity`, `fontWeight`, etc.) from string to number in `coerceUnitlessNumeric` (component-gen.ts) and `coerceStyleNumerics` (html-to-jsx.ts). Dropped errors from ~140 to ~100.
2. **Phase 2 fix** — coerced numeric HTML attributes (`tabIndex`, `rowSpan`, etc.) from string `"0"` to numeric `{0}` in attribute emitter. Dropped errors to 72.
3. **Phase 3 fix (2026-05-21)** — **RESOLVED.** Stripped trailing `!important` (case-insensitive, optional whitespace) from inline style values in both `coerceUnitlessNumeric` (engine/generate/component-gen.ts) and `coerceStyleNumerics` (engine/targets/react/html-to-jsx.ts). Also stripped from the gradient fallback path in `stylesToInline`. While regenerating, surfaced 18 follow-on errors from `allowtransparency` being passed through as the literal lowercase string instead of React's `allowTransparency` boolean prop — added it (plus the `webkit-`/`moz-` variants of `allowfullscreen`) to the attribute name map and to `BOOLEAN_ATTRS` so `"true"` collapses to bare boolean. **Final: 0 tsc errors.**

### Rationale for stripping `!important` rather than preserving it
React's `CSSProperties` type doesn't accept `!important` inline. The captured OmniSocials CSS bundle (`react-app/public/assets/index-CIOQiHtN.css`, 485 KB) wins via specificity, and inline styles still beat stylesheet rules by default, so dropping `!important` is visually equivalent for this clone target.

### Reproduced on
- dr-parity HEAD as of 2026-05-21
- Cloning https://app.omnisocials.com into /Users/cameronmcallister/Github/omnichannel-clone
- Node 25.9.0, Playwright 1.60
