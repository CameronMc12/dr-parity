# W5A.4 Emit-Time CSS Injection + Cross-Page Aggregation

## Goal

Close two gaps W2B flagged after porting media-preserve to react:

1. Move the responsive sheet `<link>` injection from post-emit HTML
   patching into `ReactPageSlice.extraStylesheetHrefs` at emit time. The
   patch-based approach was a silent regression risk: re-running emit
   after a code change would drop the `<link>` because the patch lived
   downstream of the emit step.
2. Aggregate captured stylesheet hrefs across sibling pages, not just
   per-page, so the shared cascade survives even when a given URL did
   not link a sibling's stylesheet.

## Before / After Architecture

### Before (W2B baseline)

```
buildReactMulti
  copyAssetsToPublic
  slice each page  -> per-page extraStylesheetHrefs (per-page sources only)
  emit HTML        -> writes <link> tags for those per-page hrefs
runPostEmitMultiReact (post-build, separate call from clone-urls.ts)
  aggregateCssRules across clone dirs
  preserveMediaRules -> src/styles/responsive.css
  copy responsive.css to public/dr-parity-responsive.css
  PATCH each <page>.html: inject <link rel="stylesheet" data-dr-parity="responsive">
```

The patch step (last line) wrote into already-emitted HTML. Any re-emit
overwrote that HTML and dropped the link silently.

### After (W5A.4)

```
buildReactMulti
  copyAssetsToPublic
  buildResponsiveSheet:
    aggregateCssRules across clone dirs
    preserveMediaRules -> src/styles/responsive.css
    copy responsive.css to public/dr-parity-responsive.css
    return publicHref = "/dr-parity-responsive.css"
  read every captured index.html up-front
  compute union of source stylesheet hrefs across pages (step 2)
  planCssLinks(union, publicCssFiles)  ->  aggregated planned list
  slice each page:
    extraStylesheetHrefs = filterAlreadyLinked(head, aggregatedPlanned)
    append responsive.publicHref (when produced and not already linked)
  emit HTML -> writes ALL of those <link> tags inline at emit time
runPostEmitMultiReact (now a thin shim)
  re-runs buildResponsiveSheet idempotently (refreshes analysis json,
  responsive.css, public copy) and writes the summary file
  does NOT touch any <page>.html anymore
```

The emit step is now the only writer of the `<link>` tag. Re-emitting
deterministically reproduces the same HTML byte-for-byte.

## New Modules and Wiring Changes

| File | Change |
|------|--------|
| `engine/targets/react/responsive-sheet.ts` | NEW. Exports `buildResponsiveSheet()` and `RESPONSIVE_PUBLIC_HREF`. Owns the aggregate-CSS + media-preserve + publish steps that used to live inside the post-emit module. |
| `engine/targets/react/build-multi.ts` | Calls `buildResponsiveSheet` after asset copy, computes the union of source stylesheet hrefs across pages, then appends the responsive href to each slice's `extraStylesheetHrefs`. Adds a small `unionInOrder` helper. |
| `engine/orchestrator/post-build/post-emit-multi-react.ts` | Stripped down to a shim that re-invokes `buildResponsiveSheet` for idempotent refresh and writes the legacy summary file. The HTML-patching code is gone. `pagesPatched` stays in the result shape but is always 0 (CLI logging in `scripts/clone-urls.ts` keeps working without a coupled change). |

## Aggregation Semantics (Step 2)

- Each captured page's `<link rel="stylesheet">` hrefs are extracted via
  the existing `extractSourceStylesheetHrefs(rawHtml)` helper.
- The N per-page arrays are folded through `unionInOrder`, a stable
  first-occurrence-wins reducer. Earlier pages win ordering; later
  pages contribute only new hrefs.
- `planCssLinks` then layers any orphan `/public/*.css` files the source
  never linked, in the same source-then-orphan order it always used.
- Per-page filtering still happens: `filterAlreadyLinked` drops any
  href already present verbatim in that page's head, so emitting the
  same href twice on a page that already had it is impossible.

### Why aggregation matches the source cascade

A site like apple.com loads several global stylesheets that are
referenced from a parent template, plus per-section stylesheets that
only appear on the URL that needs them. When the crawler captures page
A on its own, A's HTML carries only A's links. But A's content still
relies on cascade rules that the source browser loaded from page B's
stylesheet (because both pages live behind the same parent template
and the source cascade is shared). Per-page-only injection drops those
rules. Linking the UNION across siblings restores the shared cascade.

The risk of over-injection (loading sheet B on page A even when A
never needed it) is real but bounded: the only side effect is some
extra style rules that may never apply. The aggregated set is still
a subset of what the source cascade would have loaded if the browser
had visited both pages in a single session, which is the closest
analogue to the source's runtime behaviour.

## Apple.com Measurement

The existing apple capture has only one URL (`/`), so the union-across-
pages step is a no-op on this fixture (the union of one set equals the
set). What the apple test DOES exercise:

| Aspect | Before W2B | After W2B (HTML patch) | After W5A.4 (emit-time + agg) |
|--------|-----------:|-----------------------:|------------------------------:|
| diff ratio | 30.561% | 18.621% | not re-measured. See below. |
| `<link rel="stylesheet" href="/dr-parity-responsive.css">` written | no | yes, via post-emit HTML patch (marker `data-dr-parity="responsive"`) | yes, via emit step (no marker; pure emit output) |
| Re-emit drops link | n/a | YES (silent regression) | NO (link is part of the slice) |

Why apple wasn't re-measured end-to-end: pixel-diff requires a full
`vite build` plus a Playwright capture loop. That run is dominated by
build/install time and gives the same answer either way (apple has one
URL, so step 2 is a no-op and step 1 produces byte-identical output to
the W2B patched HTML modulo the marker attribute, which has no visual
effect). Verified separately that:

- Re-emitting twice into the same `outDir` produces byte-identical
  `index.html` files.
- The emitted `index.html` contains exactly one
  `<link rel="stylesheet" href="/dr-parity-responsive.css">` tag.
- The emitted `index.html` does NOT carry the legacy
  `data-dr-parity="responsive"` marker, confirming the link comes
  from the emit path, not from a post-emit patch.

Expected: parity stays at or improves from 18.62%. The improvement is
zero on a 1-URL capture because the union step has nothing to add. On
a multi-URL capture (the W2B note's motivating case for step 2) the
aggregated set strictly contains the per-page set, so the parity
delta is non-negative.

## Re-Emit Safety

Verified directly: running `buildReactMulti` twice into the same
`outDir` produces byte-identical `index.html` files. The number of
`<link rel="stylesheet" href="/dr-parity-responsive.css">` occurrences
is exactly 1 after each run.

The link is now visible in the emit pipeline. Future regressions in
the link would require breaking the slice shape or the emit writer,
both of which are covered by the type system (`extraStylesheetHrefs:
string[]` is required on `ReactPageSlice`).

## Regression Gates (after step 2)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` filtered count | 0 |
| `npx parity test` | 2 passed, 0 failed |
| `npm run check:astro-emit` | All 12 cases passed |
| `npm run check:refactor` | 4/4 cases ok |
| `npm run check:prettify` | 4/4 cases ok |
| `npm run check:scope-styles` | safe + aggressive OK |

Astro byte-identity confirmed. Astro pipeline imports nothing from the
react target.

## Anomalies / Surprises

1. **Parallel-agent commit collision.** While I was preparing the
   step-2 commit, another agent's session committed a docs file
   (`w5a2-tsc-zero.md`) and accidentally swept my staged
   `build-multi.ts` step-2 diff into their commit (HEAD
   `6b0b8b9`: `docs: w5a2 observation log for tsc baseline to zero`).
   The code is correct and in HEAD, but the commit message does not
   reflect its scope. Step 1 (`7ec1f92 refactor(react): move
   responsive sheet injection to emit time`) is cleanly attributed.
   Step 2 lives inside the docs commit but the diff is correct.

2. **The legacy `data-dr-parity="responsive"` marker is gone from
   freshly emitted HTML.** Before, the post-emit patch added the
   attribute so the patch step could be detected and stay idempotent.
   Now the link comes from the emit path which has no need to detect
   itself. Existing dists built before W5A.4 still carry the marker;
   re-emitting them will drop it without changing the visual output.

3. **`runPostEmitMultiReact` now duplicates work that `buildReactMulti`
   already did.** It re-runs `buildResponsiveSheet`, which re-aggregates
   CSS and rewrites `public/dr-parity-responsive.css` with the same
   bytes. This is intentional: the shim keeps the post-emit CLI path
   usable for partial pipeline runs (e.g. someone running post-emit
   alone after manually tweaking a clone). The duplicated work is
   idempotent and bounded by aggregate parse time.

4. **`pagesPatched` is permanently 0** in the post-emit summary now.
   The field is kept for CLI-log compatibility. Anyone reading the
   summary JSON should treat it as a leftover artefact.

5. **Single-URL captures don't exercise step 2.** The apple fixture
   currently has only `/`. To measure the union-aggregation gain
   properly we need a multi-URL re-capture of apple (the W2B note
   already flagged this). Out of scope here.

## Files Touched

- `engine/targets/react/responsive-sheet.ts` (new)
- `engine/targets/react/build-multi.ts` (step 1 + step 2 changes)
- `engine/orchestrator/post-build/post-emit-multi-react.ts` (shim
  rewrite, HTML patch removed)

## Commits

- `7ec1f92 refactor(react): move responsive sheet injection to emit time`
- `6b0b8b9 docs: w5a2 observation log for tsc baseline to zero` (carries
  my step 2 build-multi.ts diff alongside an unrelated docs file due
  to a parallel-agent commit race; see Anomaly 1)
