# w9a. Residual missing images in apple.com react clone

## Context

Cameron previewed the apple.com react clone at
`/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/` after
the w7b noscript+srcset fix that brought broken-ref count from 78 to 0.
The clone looked "almost perfect but some images are still missing."
Branch `prototype-mode`, HEAD around `a6384f5`, v2.1.0 tagged.

The brief enumerated five hypothesis buckets. Investigation found a sixth
one that explains the entire residue, and it is fixable without touching
the capture stage, the asset inventory, or the tour pass.

## Missing-image audit

### Initial preview readout (before fix)

Boot `npx vite preview --port 4400` in the user's preview path, drive it
with Playwright at three viewports, log every failed request and every
`<img>` whose `naturalWidth === 0`:

| Viewport | Failed image requests (excl. analytics pixels) | `<img>` with `naturalWidth=0` |
|---|---|---|
| desktop 1440x900 | 0 | 0 |
| mobile 390x844   | 0 | 0 |
| tablet 820x1180  | 0 | 0 |

Zero broken images at any viewport when the preview is loaded with a
full network-idle wait and a scroll-tour. The only failed requests at
runtime are analytics pixels going to `https://localhost/b/ss/...`
because Apple's ac-analytics JS replaces its egress host with the
preview's hostname. Those are not images.

### Where the user's "missing images" complaint came from

Snapshot the same preview at `1280x800` with NO scroll (the viewport
the parity test uses, single shot, no tour):

| Tile | Result before w9a |
|---|---|
| iphone-family hero  | OK  (srcset already real, no `data-empty`) |
| macbook-neo hero    | BLANK (renders 1x1 gif placeholder) |
| real-madrid hero    | BLANK |
| wwdc26-announce     | BLANK |
| college-students    | BLANK |
| ipad-air-m4 promo   | BLANK |
| macbook-pro promo   | BLANK |
| apple-card-airpods  | BLANK |
| iphone-tradein      | BLANK |
| TV+ media gallery items | BLANK until the carousel cycles |

Nine visible tiles render their 1x1 transparent gif placeholder instead
of their real image. Each one matches the same source DOM shape.

### Root cause: `<source data-empty>` placeholder + `<noscript>` siblings

Every blank tile has the same `<picture>` shape in the captured HTML:

```html
<picture class="static" data-anim-lazy-image="">
  <source data-empty="" srcset="data:image/gif;base64,R0lGOD..." media="(min-width:0px)" />
  <img src="/v/home/cm/.../hero_macbook_neo__gnm3snkti4a6_large.jpg" alt="..." />
</picture>
<noscript>
  <picture class="static">
    <source srcset="/v/home/cm/.../small.jpg, /v/home/cm/.../small_2x.jpg 2x" media="(max-width:734px)" />
    <source srcset="/v/home/cm/.../medium.jpg, /v/home/cm/.../medium_2x.jpg 2x" media="(max-width:1068px)" />
    <source srcset="/v/home/cm/.../large.jpg, /v/home/cm/.../large_2x.jpg 2x" media="(min-width:0px)" />
    <img src="/v/home/cm/.../large.jpg" alt="..." />
  </picture>
</noscript>
```

In a real browser, Apple's runtime JS finds every
`<picture data-anim-lazy-image>` and rewrites the `<source data-empty>`'s
`srcset` to point at the responsive variants. The static clone does not
ship that JS, so the browser's `<picture>` algorithm matches the empty
source (its `media="(min-width:0px)"` is satisfied at every viewport) and
picks the data-URI placeholder.

The real responsive variants are sitting in the `<noscript>` next to the
visible picture. `<noscript>` is never rendered when JS is on, so they
were going to waste.

### Bucket classification

| Bucket from brief | Count | Notes |
|---|---|---|
| 1. JS-loaded images (data-image-* swapped at runtime) | ~9 visible tiles | This is the dominant bucket. The "JS" here is Apple's lazy-image runtime, not the asset URL. The asset URLs are already in the DOM, just on the wrong source. |
| 2. Behind interaction (carousel / tabs) | TV+ gallery only | The media-gallery cycles through items; non-active ones intentionally render dim. Not actually broken. |
| 3. CSS background-image | 0 | Zero unmatched CSS `url()` references at runtime. |
| 4. data-image-* attributes | 0 | Apple does NOT use `data-image-*`. The lazy marker is the empty class attribute `data-anim-lazy-image=""`. The asset URL is on the inner `<img src>`. |
| 5. Cross-viewport srcset variants | 0 | Already handled by w7b. |

So the dominant bucket is a sibling of #1: not "JS fetches a URL we don't
have" but "JS rewrites a `<source>` we already have, so the browser picks
the right variant." The URLs are present, just inert.

## Fix design

New target-agnostic shared util at
`engine/targets/shared/hoist-noscript-picture.ts`. Walks every
`<picture>` whose direct child is a `<source data-empty>`. For each:

1. Look at the next non-whitespace sibling. If it is a `<noscript>` whose
   serialised body contains a `<picture>`, parse that picture in fragment
   mode (cheerio's `null, false` form, since the outer document mode
   treats `<noscript>` contents as opaque text).
2. Remove every `<source data-empty>` child of the visible picture.
3. Insert each real `<source>` from the noscript picture before the
   visible picture's inner `<img>` (or append if no inner img exists).
4. Copy missing `srcset` / `sizes` from the noscript `<img>` to the
   visible `<img>` so the no-source fallback path stays accurate.
5. Leave the `<noscript>` block intact: react still emits it as
   `<noscript dangerouslySetInnerHTML>` for runtime SEO compatibility.

The function is idempotent (a second pass finds no `<source data-empty>`
children and returns zero) and capability-detected (every other site
shape leaves the DOM alone because the selector `source[data-empty]`
does not match).

Wire it into both react entry points immediately after
`normaliseElementPaths`:

- `engine/targets/react/build.ts` (single-page build)
- `engine/targets/react/build-multi.ts` (multi-page build)

Astro and webapp targets are not touched. Astro hit 100% byte parity and
its emit byte-identity is preserved by leaving its pipeline alone.

## Before vs after measurement

### `data-empty` survivors in emitted JSX

| Component | Before w9a | After w9a |
|---|---|---|
| `Section01_Iphone.tsx`    | 1 | 0 |
| `Section02_Wwdc26.tsx`    | 3 | 0 |
| `Section03_EndlessEntertainment.tsx` | 0 | 0 |
| Other components          | 0 | 0 |
| **Total**                 | **4** | **0** |

The build-pipeline before-vs-after says it dropped all four residual
`data-empty` placeholders inside the visible `<picture>`. The 12
captured noscript `<picture>` blocks still preserve their `data-empty`
markers inside `<noscript dangerouslySetInnerHTML>`, which is intended:
those blocks are inert when JS runs.

### Visible tile readout at 1280x800 no-scroll

Before fix: nine blank tiles (1x1 transparent gif placeholder rendered).
After fix:  every tile renders its real image. Only the TV+ media
gallery still shows three dim panels at the no-scroll snapshot, and
those are intentional in Apple's design (inactive carousel tiles are
themed dark while the active one is bright).

### Astro byte-identity check

Re-build astro target from the same clone dir after the change. Astro
still emits 12 `data-empty` markers in its `.astro` components (count
unchanged from previous run). The hoist util is a no-op in the astro
build path because it lives only in the react build entry points.

### Parity regression suite

- `npx parity test` 4/4 PASS (`enerblock-net`, `example-com`,
  `example-com-mobile`, `example-com-rebuild-pixel`).
- `npx tsc --noEmit | grep "error TS" | grep -v "^clones/" | grep -v "^docs/research/" | wc -l` -> 0.
- `npm run check:astro-emit`, `check:refactor`, `check:prettify`,
  `check:scope-styles` all green.

### Fresh apple.com react clone path

The user's existing preview at
`/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/` was
re-emitted in-place using the same captured clone dir. Vite build OK.

Preview command:

```bash
cd /tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react && npx vite preview --port 4400
```

## Anomalies / Surprises

1. **The brief's hypothesis #4 (data-image-* attributes) is wrong for
   apple.com.** Apple uses an empty `data-anim-lazy-image=""` attribute
   as a marker only. The image URLs live on the inner `<img src>` and on
   the sibling `<noscript><picture>` block. So extending the asset
   inventory to scan `data-image-*` would have found nothing here.
2. **The brief's hypothesis #1 (JS-loaded images) is half right.** The
   image URLs are present in the static DOM; the JS only rewrites the
   `<source>`'s srcset. Fetching everything is fine; rendering it is the
   gap. Capture pipeline and asset inventory were already correct.
3. **W7b's noscript-aware asset inventory fetched all the variants but
   nothing rendered them.** W7b was necessary (the variants would not
   be in `/public` without it) but not sufficient (the emitted HTML
   still picked the placeholder). W9a closes the loop.
4. **At 1440x900 with scroll the audit shows zero broken images.** The
   user's complaint surfaced because they were comparing against the
   parity test's 1280x800 no-scroll capture, where the lazy-load JS
   never gets a chance to fire. A proper static-emit fix removes the
   dependence on JS entirely.
5. **Cheerio's `noscript` opacity in document mode is annoying but
   workable.** With `scriptingEnabled` true (the default for
   `cheerio.load(html, null, true)`), `<noscript>` shows up as a single
   text child. Re-parsing its `.html()` in fragment mode
   (`cheerio.load(raw, null, false)`) cleanly exposes the inner
   `<picture>` without changing the load mode of the whole document.

## Files touched

- `engine/targets/shared/hoist-noscript-picture.ts` (new)
- `engine/targets/shared/index.ts` (export)
- `engine/targets/react/build.ts` (invoke after path normalisation)
- `engine/targets/react/build-multi.ts` (invoke after path normalisation)
- `docs/V2.0/observations/w9a-react-image-residual.md` (this log)
