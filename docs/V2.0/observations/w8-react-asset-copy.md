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

## Issue 3: Per-target threshold defeated by CLI default

The brief said the W6 `parity-check` stage hardcodes `0.02` for react
and asked to wire it to the per-target default. The threshold lookup at
`engine/cli/run-clone-stage.ts:392` looked correct on first read:

```ts
const diffThreshold =
  typeof input.parityThreshold === "number"
    ? input.parityThreshold
    : DEFAULT_PARITY_THRESHOLDS[target];
```

With `DEFAULT_PARITY_THRESHOLDS = { astro: 0.02, react: 0.2, webapp: 0.2 }`
in `engine/cli/emit-and-verify.ts:35` (added in `0c2ec19`).

### Actual root cause

The first re-run of apple.com react with the body-path fix landed at
`diffThreshold: 0.02` in the manifest. Tracing showed the bug was one
level up at `bin/parity.ts:98`:

```ts
"parity-threshold": {
  type: "string",
  description: "Pixel diff threshold for parity verification.",
  default: "0.02",   // ← CLI default unconditionally applied
  valueHint: "ratio",
},
```

The arg parser fills in `"0.02"` whenever the user omits the flag, the
bin layer converts it to a number, validates it, and passes it through
as `input.parityThreshold = 0.02`. The "explicit override wins" branch
of the run-clone-stage ternary therefore fires for every clone, and the
per-target default never gets a chance.

### Fix

Remove the CLI default. When `--parity-threshold` is omitted,
`args["parity-threshold"]` is undefined, `parityThreshold` stays
undefined down the call chain, and `DEFAULT_PARITY_THRESHOLDS[target]`
wins. Astro keeps its 0.02 floor by virtue of the per-target table, not
the CLI default. Explicit overrides via the flag still work as before.

This is the classic "default is too clever" CLI bug. Per-target
behaviour should never be expressed at the surface layer.

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

First re-run after the body-path fix only (commit `f5d4b7e`):

| Field | Value |
|---|---|
| Run ID | `2026-05-22T12-08-09-466Z-3c34` |
| Run dir | `/Users/cameronmcallister/Github/dr-parity/.runs/2026-05-22T12-08-09-466Z-3c34` |
| Capture dir | `/tmp/w8-run/www-apple/2026-05-22T12-08-09-499Z/captures` |
| Sites dir | `/tmp/w8-run/www-apple/2026-05-22T12-08-09-499Z/sites/react` |
| emit-target | OK (127ms, 6 components, 1 page, 328 assets, 32.1 MB) |
| npm install | OK |
| npm run build | OK (Vite resolved every script src cleanly) |
| Pixel score | 99.95 percent |
| diffThreshold | 0.02 (revealed the CLI-default bug above) |
| mismatchedPixels | 3874 / 8044800 |
| Total duration | 8m 42s |

Apple.com is genuinely close to byte-identical between the captured
clone and the React rebuild because the React emit preserves the
captured CSS / JS / assets verbatim under `/public`. The 99.95 percent
score reflects that almost every pixel matches. The brief expected a
"15 to 25 percent" diff and an exploratory pass against the 0.2
threshold; the actual measurement is well under the 0.02 floor.

The CLI default fix (`20df709`) ensures react clones now run with the
correct 0.2 threshold even though apple.com would happily pass at 0.02.
Sites with more JS-driven post-load DOM (carousels, lazy hero swaps,
conditional rendering) will produce real react vs clone deltas and need
the 0.2 headroom.

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
| parity-check (npm run build) | fail (Could not resolve `./v/home/...`) | OK (99.95 percent pixel match) |
| parity-check (pixel diff threshold) | n/a (build failed before pixel diff) | 0.2 for react via per-target default (was 0.02 due to CLI default bug) |

## Verification

- `npx tsc --noEmit | grep "error TS"` returned zero non-clone, non-docs
  errors.
- `npx parity test` 4 passed, 0 failed, 0 skipped.
- `npm run check:astro-emit && check:refactor && check:prettify && check:scope-styles` all green.
- The webapp target's `emit-assets` was not touched.
- The astro target's emit was not touched.

## Anomalies and surprises

1. The brief identified three issues. The first surface read suggested
   only one needed a code change, but the first re-run revealed the
   threshold bug was real and lived one level up at the CLI default,
   not in the run-clone-stage lookup the brief pointed at. Worth
   following the data all the way back to the surface, even when an
   inner layer looks correct.
2. The fatal Vite failure was a `type="module"` script, not a classic
   script. The brief's wording suggested classic scripts were the
   problem case. The reality is Vite refuses to bundle any relative `./`
   reference whose target lives in `/public` rather than at the project
   root, regardless of script type.
3. `sliceBody` already calls `normaliseElementPaths` on the body. The
   bug was strictly an ordering issue: hoist runs before slice, so the
   slice-time normalisation never reaches the already-hoisted scripts.
   A single integration test on the react emit path (parse-clone fixture
   plus expected hoisted `<script>` srcs) would catch this whole class.
   Worth queuing as W9 follow-up.
4. apple.com clones to 99.95 percent pixel parity in react, well inside
   the astro-tier 0.02 threshold. The W5B.2 measurement that informed
   the 0.2 react floor (18.62 percent) must have included a regression
   that no longer applies, or measured a different page state. Worth
   re-baselining the per-target thresholds against the current emit
   pipeline before the next session expands the corpus.
