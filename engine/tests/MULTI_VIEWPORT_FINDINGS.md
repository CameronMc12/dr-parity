# P3.11 — Multi-Viewport Parity Findings

**Date:** 2026-05-15
**Test:** `engine/tests/multi-viewport-parity.spec.ts`
**Subject under test:** `clone-enerblock/` (most recent finished rebuild on disk; safe-mode rebuild-pro output)
**Reference captures:** `docs/research/enerblock/screenshots/full-page.png` (1440 wide desktop only)

---

## TL;DR

The rebuild-pro pipeline **does not preserve responsive `@media` rules**. The captured enerblock site originally shipped 202 `@media` rule groups (22 unique breakpoint queries spanning 352px through 981px). The rebuilt Astro project ships exactly **1** `@media` rule (`prefers-reduced-motion`). That is a 100% loss of responsive CSS.

NEXT.md item P3.11 hypothesised "likely fine, just untested." It is not fine. The pipeline operates on the desktop clone only, as flagged in the P3.11 description itself.

---

## Per-Viewport Results

| Viewport            | Rendered | Reference Present | Diff Ratio | Pass    | Note                                              |
| ------------------- | -------- | ----------------- | ---------- | ------- | ------------------------------------------------- |
| 375x812 mobile      | yes      | no                | n/a        | skipped | No mobile capture exists in `docs/research/`      |
| 768x1024 tablet     | yes      | no                | n/a        | skipped | No tablet capture exists in `docs/research/`      |
| 1024x768 desktop-sm | yes      | no                | n/a        | skipped | No desktop-sm capture exists in `docs/research/`  |
| 1440x900 desktop    | yes      | yes               | **88.850%** | **FAIL** | Reference 1440x11806; rebuilt 1558x23054 — width overflow + ~2x height |

Full machine-readable summary: `engine/tests/out/multi-viewport/result.json`.
Per-viewport screenshots: `engine/tests/out/multi-viewport/<viewport>/rebuilt.png`.
Desktop diff PNG: `engine/tests/out/multi-viewport/1440x900-desktop/diff.png`.

---

## Diagnosis (do not fix — diagnostics only per task brief)

### Failure 1: Responsive CSS stripped during rebuild

`docs/research/enerblock/page-data.json` reports the original site shipped:

```
totalMediaQueries: 202
totalRules:       1336
totalKeyframes:     7
totalVariables:    45
```

Unique media queries in the original capture (top 10 by usage):

```
[46x] (max-width: 680px)
[34x] (min-width: 981px)
[33x] (min-width: 681px)
[22x] (max-width: 980px) and (min-width: 681px)
[15x] (hover: hover)
[14x] (max-width: 980px)
 [5x] (min-width: 981px) and (min-aspect-ratio: 2 / 1)
 [4x] (max-width: 440px)
 [4x] (max-width: 981px) and (min-width: 680px)
 [4x] (max-width: 352px)
```

After rebuild:

```
$ grep -c "@media" clone-enerblock/src/styles/base.css      # 1
$ grep -rc "@media" clone-enerblock/src/components/          # 0 across all section astros + islands
$ grep -c "@media" clone-enerblock/dist/_astro/*.css         # 1
$ grep -oh "@media[^{]*" clone-enerblock/dist/_astro/*.css | sort -u
@media(prefers-reduced-motion:reduce)
```

The single surviving `@media` is the hand-authored `prefers-reduced-motion` block in `clone-enerblock/src/styles/base.css` (it was put there by the base-css emitter, not preserved from the capture). Every single responsive breakpoint from the source is gone.

### Failure 2: Fixed pixel widths bake desktop layout into every section

`clone-enerblock/src/components/sections/Section.astro` (and the rest of the section files) contain inline `<style>` blocks with hardcoded desktop dimensions, eg:

```css
.prefooter__back  { width: 1440px; height: 900px; }
.parallax__container { width: 1440px; height: 900px; }
.image--parallax  { width: 1440px; height: 1080px; }
.tt--ab           { width: 1440px; height: 1080px; }
```

At 1440px viewport these geometries are "right" for the captured layout, but they assume a 1440-wide canvas with no responsive collapse. At 375/768/1024 the page does not reflow — it overflows and (per the 1558 captured width at a 1440 viewport) it actually overshoots horizontally because the cumulative fixed widths inside section containers push the document past the viewport.

The 23054 vs 11806 height delta also indicates either:
1. Images loading later in the rebuilt site stretching containers, or
2. The desktop-clone capture omitted some sections that have since been added back in the rebuild, or
3. Layout collapse caused by missing media-query bounded sizing.

(Visual inspection of `engine/tests/out/multi-viewport/1440x900-desktop/diff.png` will show which.)

### Failure 3: No multi-viewport captures exist to test against

The capture phase ran once at desktop. The vault note at `project_ikonik_tracking_stack` references multi-viewport pipelines for Ikonik, but there is no multi-viewport capture artifact for enerblock — only:

```
docs/research/enerblock/screenshots/full-page.png        # 1440 wide
docs/research/captures/example.com/2026-05-14T12-54-35-266Z/desktop/screenshot.png
```

No `mobile/`, `tablet/`, or `1024/` siblings exist for either site. So even if the rebuild preserved media queries, we could not pixel-diff against original mobile/tablet shots because they were never captured.

---

## Root Cause

NEXT.md item P3.11 already states the cause verbatim:

> Capture currently runs all 4 viewports but the rebuild-pro pipeline today only operates on the desktop clone.

That is the bug. The orchestrator phases (`engine/orchestrator/phases.ts` and the extract-css → scope-styles → wire-layout chain) walk a single `<clone-dir>/desktop/clone/index.html` and only its associated CSS. Media queries that target widths other than desktop are present in the original captured stylesheets, but the safe-mode pipeline (which is what produced `clone-enerblock/`) does not emit them into the project styles — only the section astros' inline `<style>` blocks make it through, and those styles were already desktop-flattened during the capture-clone phase.

Note: `engine/scope-styles/emit.ts` (`groupByMedia` at line 105) DOES correctly preserve `@media` wrappers when it runs. But scope-styles is an aggressive-only phase (NEXT.md P3.10 confirms aggressive mode breaks parity 22-29%), so in safe mode it never runs. Result: no path through safe mode carries `@media` rules into the rebuild.

---

## What "fixing" would require (out of scope for this ticket)

1. Capture: continue running all 4 viewports (already does — `capture.ts` is fine) AND store per-viewport stylesheets, not just per-viewport screenshots.
2. extract-css (Phase 1): consume all 4 viewport stylesheet bundles, merge them by `@media` query, preserve every breakpoint in `analysis/css-rules.json`.
3. wire-layout (Phase 8) or a new responsive-emit phase: emit a `responsive.css` (or fold into `base.css`) that contains every preserved `@media` block, in original cascade order.
4. Section astros: stop hardcoding fixed pixel widths/heights in inline `<style>` blocks. Either move to the global responsive bundle or wrap in `@media (min-width: 981px) { ... }` so they only apply on desktop.
5. Capture per-viewport screenshots as references and store them as `<test>/captures/<viewport>/screenshot.png` so this multi-viewport test has real comparators at 375 / 768 / 1024.

---

## Re-running this test

```bash
cd /Users/cameronmcallister/Desktop/github/dr-parity
npx tsx engine/tests/multi-viewport-parity.spec.ts
```

The test serves `clone-enerblock/dist/` statically (via the bundled `serve`), drives Chromium at four viewports, writes screenshots and a diff PNG, and exits non-zero if any diff exceeds 2%.
