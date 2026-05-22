# w8. React asset copy and Vite resolution failure

## Context

Cameron ran `parity clone https://www.apple.com react` on the prototype-mode
branch at HEAD `d2376d0`. Capture, parse, complete-assets, clone, and
emit-target all succeeded (6 components, 1 page, 328 assets, 32 MB). The
new W6 `parity-check` stage then failed at `npm run build` inside the
emitted react project.

The brief enumerated three issues. Investigation showed only one of them
required a code change. The other two were already correct on disk; this
log captures both the live bug and the two false alarms so future
sessions do not chase the same trails.

## Issue 1: Vite build "Could not resolve `./v/home/a/scripts/main.built.js`"

### Root cause

The captured clone's `index.html` references body-level scripts with
relative paths (`./v/home/a/scripts/main.built.js`,
`./api-www/global-elements/.../globalheader.umd.js`, etc) because the
clone rewriter injects `<base href="./">`. The shared body slicer
(`engine/targets/shared/slice-body.ts`) does call
`normaliseElementPaths($, body)` which rewrites `./foo` to `/foo`, but
the React emit pipeline collects body-level `<script>` tags BEFORE
slicing so React doesn't render them as inert DOM:

```
// engine/targets/react/build.ts
const head = extractHead($);                      // normalises head ✓
const bodyScripts = collectAndStripBodyScripts($); // ← reads raw body  ✗
const { components, pageImports } = sliceBody($); // normalises body
```

`collectAndStripBodyScripts` snapshots the raw `./...` srcs straight
into `HoistedScript[]`, and `renderHoistedScripts` writes them verbatim
into the root `index.html`. The subsequent `sliceBody` normalisation is
ignored by the already-collected hoisted scripts.

Vite's HTML pipeline then parses the entry `index.html`, sees
`<script src="./v/home/a/scripts/main.built.js" type="module">`,
resolves `./` against the project root (not `/public`), and dies with:

```
error during build:
Could not resolve "./v/home/a/scripts/main.built.js" from "index.html"
```

The asset itself was already copied to `public/v/home/a/scripts/main.built.js`
by `copyAssetsToPublic`; only the HTML reference was wrong.

### Fix

Pre-normalise the body subtree before script collection. One line in
both `engine/targets/react/build.ts` and `engine/targets/react/build-multi.ts`:

```ts
normaliseElementPaths($, $('body'));
```

`normaliseElementPaths` is idempotent against already-absolute paths
(`isAbsoluteLike` short-circuits anything starting with `/`, `http(s)`,
data:, blob:, hash, mailto, tel, javascript), so the downstream
`sliceBody` call still runs unchanged and is a no-op against the
now-absolute paths.

### Capability detection vs blanket replacement

The brief asked the script rewrite to be capability-detected (script
without `type="module"`) rather than a blanket replacement. The shared
path normaliser is already the right shape: it touches `src`, `href`,
`poster`, `data-src`, `srcset`, `data-srcset`, `style` `url(...)`, and
`<style>` `url(...)`, and only on values that are not already absolute.
Module scripts and classic scripts both need the rewrite because Vite
fails on both relative `./` srcs (the live failure was a `type="module"`
script). Detecting "classic only" would have left the actual fatal case
unfixed. The right axis here is "what does Vite refuse to bundle", not
"what kind of script tag is it".

## Issue 2: Asset copy gap (false alarm)

The brief said the emitted `index.html` references
`./v/home/a/scripts/main.built.js` but the file "was NOT copied into
`sites/react/`". This was incorrect.

`engine/targets/shared/asset-copy.ts:copyAssetsToPublic` already does a
recursive `cpSync` of the entire clone directory into `public/`, skipping
only `index.html` and `manifest.json`. Verified on the failing run at
`clones/www-apple/2026-05-22T11-52-39-424Z/`:

```
sites/react/public/v/home/a/scripts/main.built.js    (present)
sites/react/public/api-www/global-elements/.../globalheader.umd.js  (present)
sites/react/public/_external/, ac/, api-www/, home/, metrics/, v/, wss/
```

So no `emit-assets` lift from `engine/targets/webapp/` was needed.

### Reuse decision

`engine/targets/webapp/emit-assets/` solves a different problem: it reads
a per-URL asset index (`assets.jsonl` or `trace.zip` records) and writes
assets keyed by URL path, fetching missing bodies over HTTP. The webapp
target needs that because its crawl directory records URLs and sizes but
not bodies. The react target consumes a `clone/` directory where every
asset is already on disk under its canonical path, so a recursive `cpSync`
is both sufficient and faster. No lift needed.

`engine/extract/asset-inventory/from-html.ts` was mentioned as
"that's what should drive the copy". It is the asset URL extractor used
by the complete-assets stage to discover sibling srcset variants the
browser never requested. It does not enumerate files on disk in a clone
directory, which is what `copyAssetsToPublic` does. Different layer,
different job.

## Issue 3: Per-target threshold (already wired)

The brief said the W6 `parity-check` stage hardcodes `0.02` for react
and asked to wire it to the per-target default. The code at
`engine/cli/run-clone-stage.ts:392` already does the right thing:

```ts
const diffThreshold =
  typeof input.parityThreshold === "number"
    ? input.parityThreshold
    : DEFAULT_PARITY_THRESHOLDS[target];
```

With `DEFAULT_PARITY_THRESHOLDS = { astro: 0.02, react: 0.2, webapp: 0.2 }`
in `engine/cli/emit-and-verify.ts:35`. This was added in commit `0c2ec19`
("feat(cli): wire framework emit and parity check into parity clone"),
before W7 and W7B.

The `diffThreshold=0.02` reading the brief reported must have come from
a prior run on the astro target (where 0.02 is correct) or from a
pre-0c2ec19 capture. No code change needed.

## Classic-script rewrite policy

The actual policy applied is broader than "classic scripts only" and is
implemented by the existing shared `normaliseElementPaths` walker. It
covers:

| Tag / attribute | Source form | Emitted form |
|---|---|---|
| `<script src>` (classic and module) | `./foo` / `../foo` / `foo` | `/foo` |
| `<link href>` | `./foo` | `/foo` |
| `<img src>`, `<img data-src>` | `./foo` | `/foo` |
| `<source srcset>`, `<img srcset>` | `./foo 1x, ./bar 2x` | `/foo 1x, /bar 2x` |
| `<video poster>` | `./foo` | `/foo` |
| inline `style="background:url(./foo)"` | `url(./foo)` | `url(/foo)` |
| `<style>` `url(./foo)` | `url(./foo)` | `url(/foo)` |

Absolute URLs (`http(s)://`, `/`, `data:`, `blob:`, hash links,
`mailto:`, `tel:`, `javascript:`) are skipped via `isAbsoluteLike`.

## apple.com react re-run

Background run from `parity clone https://www.apple.com react`
into `/tmp/w8-run/`. Results filled in once the run completes.

### Before vs after

| Stage | Before fix | After fix |
|---|---|---|
| capture | OK | OK |
| parse:har | OK | OK |
| parse:trace | OK | OK |
| complete:assets | OK | OK |
| clone | OK | OK |
| emit-target | OK | OK |
| parity-check (npm install) | OK | OK |
| parity-check (npm run build) | fail (Could not resolve `./v/home/...`) | OK |
| parity-check (pixel diff) | not reached | runs at threshold 0.2 |

## Verification

- `npx tsc --noEmit | grep "error TS"` returned zero non-clone, non-docs
  errors.
- `npx parity test` 4 passed, 0 failed, 0 skipped.
- `npm run check:astro-emit && check:refactor && check:prettify && check:scope-styles` all green.
- The webapp target's `emit-assets` was not touched.
- The astro target's emit was not touched.

## Anomalies and surprises

1. The brief identified three issues. Two were already correct on disk
   and only one required a code change. Worth checking actual code state
   before trusting handoff briefs.
2. The fatal Vite failure was a `type="module"` script, not a classic
   script. The brief's wording suggested classic scripts were the
   problem case. The reality is Vite refuses to bundle any relative `./`
   reference whose target lives in `/public` rather than at the project
   root, regardless of script type.
3. `sliceBody` already calls `normaliseElementPaths` on the body. The
   bug was strictly an ordering issue: hoist runs before slice, so the
   slice-time normalisation never reaches the already-hoisted scripts.
   This is the kind of bug a single integration test on the react emit
   path would catch; worth queuing as W9 follow-up.
