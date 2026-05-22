# W11 — Carousel parity in React dev mode

Date: 2026-05-22
Target capture: `/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/`
Branch: prototype-mode
Predecessors: W9a (Shape A: noscript-picture hoist), W10 (Shape B: data-lazy picture with data-URI source)

## Summary

After W10 closed the lazy-image gap, the remaining dev/preview delta was
isolated to the Apple TV + FAM carousels (`<div data-media-gallery>`
inside `Section03_EndlessEntertainment`). Carousel images all loaded in
both modes, but the carousel layout was frozen on slide 1 in dev while
working in preview. Pixel-diff of full-page screenshots in dev vs
preview: **88.30%** (1.06 M differing pixels concentrated in the
y=4000-5000 carousel band).

The fix seals off `data-media-gallery` subtrees from React via
`dangerouslySetInnerHTML` at emit time, then re-runs the static-emit. New
pixel-diff dev vs preview: **100.0000%**. TS errors: 0. Parity 4/4. All
four astro byte-identity smokes green.

## Shape C definition

Pattern: an element whose inner DOM is mutated by a captured runtime
script AFTER React hydration, where React's StrictMode dev double-render
would otherwise overwrite the runtime mutation with the original JSX.

Marker observed on Apple: `data-media-gallery=""` attribute on the
carousel root container. The `ac-gallery` UMD bundle Apple ships writes:

- `class="media-gallery-item ... current current-item"` on the active slide
- inline `style="--progress: N; opacity: 1; transform: translate(Npx, 0px);"`
  on every descendant `.media-gallery-item`

Captured DOM excerpt (TV gallery root):

```html
<div id="tv-media-gallery"
     class="media-gallery tv-media-gallery"
     role="group"
     data-media-gallery=""
     data-analytics-section-engagement="name:tv-plus-gallery"
     data-analytics-gallery-id="Tv Plus Gallery"
     aria-label="Gallery of Apple TV shows, movies, and sports.">
  <ul class="media-gallery-items">
    <li class="media-gallery-item theme-dark"
        data-media-gallery-item="1"
        data-ac-gallery-item=""
        data-ac-gallery-item-duration="4.16">
      ...
    </li>
    ...
  </ul>
</div>
```

Runtime-applied state on slide 1 in production:

```
class="media-gallery-item theme-dark current current-item"
style="--progress: 0; opacity: 1; transform: translate(0px, 0px);"
```

## Why W9a + W10 did not catch it

W9a (Shape A) and W10 (Shape B) both target `<picture>` placeholder
patterns where the captured DOM literally contains a data-URI source and
a sibling `<noscript><picture>` carrying the real responsive srcset. The
hoist resolves the lazy placeholder at static-emit time so first paint
ships the real srcset.

In Shape C the captured `<picture>` source srcsets are already real
absolute URLs (Apple resolves them server-side). The lazy behaviour is
on the carousel container itself (slide layout, autoplay state,
className additions, inline transforms) and is applied by the
`ac-gallery` runtime, not by a picture-source swap. The noscript hoist
finds nothing to do here, which is correct: the issue is not lazy media,
it is React reconciliation race.

## Sample image walk-through

Cameron's initial report claimed "carousel images are STILL missing in
dev". A coarse image-count survey confirmed otherwise:

```
dev:     total imgs 49, in-gallery 36, placeholders 0
preview: total imgs 49, in-gallery 36, placeholders 0
```

The first carousel `<img>` in dev:

- src=`/_external/is1-ssl.mzstatic.com/.../1250x668sr.jpg`
- currentSrc=`https://is1-ssl.mzstatic.com/.../980x522sr.jpg`
- naturalWidth=980, complete=true

So every image was loaded. The "missing" perception came from the
carousel layout collapse: slides 2-9 had `style=""` (no transform), so
they rendered stacked at translate(0, 0) instead of laid out
horizontally at translate(943px, 0), translate(1886px, 0), etc. Only
slide 1 appeared in the viewport; the rest were either overlapping or
clipped by the carousel's overflow:hidden.

Slide 0 state captured side-by-side (dev paused vs preview paused):

```
dev:     class="media-gallery-item theme-dark"
         style=null
preview: class="media-gallery-item theme-dark current current-item"
         style="--progress: 0; opacity: 1; transform: translate(0px, 0px);"
```

## Fix

`engine/targets/react/html-to-jsx.ts`: extended the escape-hatch branch
to preserve the matched element's outer tag and attributes. Inner
subtree is emitted as `dangerouslySetInnerHTML`. Previously the entire
match (outer + inner) was replaced with a bare `<div
dangerouslySetInnerHTML={{ __html: inner }} />`, which would have lost
the original element's className / id / data-* selectors.

`engine/targets/react/escape-hatch-predicates.ts`: new file. Houses the
target-specific predicates. Initial registration: any element carrying
`data-media-gallery` is sealed. Other patterns can be added here when
discovered, without touching the build orchestrators.

`engine/targets/react/emit.ts`: `EmitOptions` now exposes
`shouldEscapeHatch?: (el: Element) => boolean`, forwarded into both
`htmlToJsx` calls (leaf components and composition wrappers).

`engine/targets/react/emit-multi.ts`: same predicate wired into
`writeReactComponentFile` + `renderCompositionReact`. Both single-page
and multi-page React entries now seal the same subtrees.

`engine/targets/react/build.ts` + `build-multi.ts`: pass
`reactEscapeHatchPredicate` as the `shouldEscapeHatch` option on every
component write.

The fix is **capability-detected**. Sites without `data-media-gallery`
attributes see zero behaviour change. example-com and enerblock-net
emit byte-identically before and after.

## Before / after counts (TV + FAM galleries)

Dev mode, captured at viewport=1440x900, after scrolling the carousel
into view and pausing autoplay:

| Metric | Dev BEFORE | Dev AFTER | Preview (unchanged) |
| ------ | ---------: | --------: | ------------------: |
| TV slides with inline style applied        | 0 / 9 | 9 / 9 | 9 / 9 |
| FAM slides with inline style applied       | 0 / 9 | 9 / 9 | 9 / 9 |
| TV slide 0 has `current current-item` cls  | no    | yes   | yes |
| FAM slide 0 has `current current-item` cls | no    | yes   | yes |
| Carousel imgs loaded (combined)            | 36/36 | 36/36 | 36/36 |
| Full-page pixel-diff dev vs preview        | 88.30% | 100.00% | n/a |

The image count was always 36/36 in dev. W11 was never about missing
images, it was about runtime-applied slide layout being clobbered.

## Anomalies / Surprises

- The user-reported symptom ("carousel-specific images STILL missing in
  dev") was wrong about images and right about the carousel. Direct
  image counts in dev have been 36/36 since W10 shipped. The visual
  symptom that looked like "missing images" was the carousel collapsed
  onto slide 1: most of the carousel surface was either Apple TV branding
  with no image (slide 0) or whitespace where slide 2-9 would have been.
- The initial coarse pixel-diff (88.30%) included the 4.16-second
  autoplay rotation: even after both modes were "loaded", the two
  screenshots caught them at different autoplay positions. Pausing the
  autoplay before screenshot did not close the gap, which is what
  pinpointed the className/style mutation as the real culprit rather
  than animation-frame skew.
- `<React.StrictMode>` is the only thing different between dev and
  preview. We considered just deleting it from the generated
  `src/main.tsx`, but that loses dev-only safety checks across the
  entire emitted project. The escape hatch fixes only the subtrees we
  know are runtime-mutated, leaves the rest of the project under
  strict-mode coverage.
- The existing escape-hatch branch in `html-to-jsx.ts` was emitting a
  bare `<div>` and dropping the original element's outer attributes.
  Fixing this is technically a small behaviour change for anyone using
  `escapeHatchTags`, but no callers currently use it (it was a future
  hook), so no regressions are possible.
- More shapes may lurk for animation-heavy components on other Apple
  sections (gsap, ScrollTrigger, custom `<gallery>` widgets); none
  surfaced in this capture but the predicate pattern is now in place
  if they do.
