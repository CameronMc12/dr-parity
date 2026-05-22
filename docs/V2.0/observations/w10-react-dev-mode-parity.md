# w10. React dev-mode parity with preview for apple.com

## Context

Cameron flagged that `npm run dev` in an emitted apple.com react clone
renders broken lazy-loaded images (carousel tiles, TV gallery logos),
while `npm run preview` of the same project renders them correctly.
Fixture: `/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/`.
Branch `prototype-mode`, HEAD `4e71513`, v2.1.0 tagged.

The brief listed six hypothesis buckets. Investigation rejected five and
landed on a sixth, fixable cleanly in the shared emit-time hoist with no
target-specific branching.

## Dev-mode vs preview audit

### First-paint readout (no scroll)

| Aspect | DEV (5173) | PREVIEW (4173) |
|---|---|---|
| imgsTotal | 49 | 49 |
| imgsBroken | 36 | 36 |
| Visual (above-the-fold screenshot) | identical | identical |
| hasAC global | object | object |
| Module scripts loaded | 6 | 4 |
| Body scripts | 11 | 10 |
| Console errors | identical set (CORS, ac-target ssl) | identical set |
| 404s / MIME mismatches | none | none |

First-paint is byte-identical visually. All apple scripts download with
correct MIME types in both modes. The 36 broken images are already
present at first paint in both modes because the lazy gallery section is
below the fold and renders placeholder srcsets until the runtime swaps
them.

### After scroll-tour readout

| Aspect | DEV (5173) | PREVIEW (4173) |
|---|---|---|
| imgsBroken after scroll | **36** | **0** |
| One sample picture outerHTML | `<source srcset="data:image/gif;base64,...">` (placeholder still in DOM) | `<source srcset="/v/home/cj/images/.../small.png, ... 2x">` (real srcset) |

Same DOM at first paint, divergent DOM after scroll. The runtime
`endless-entertainment-gallery.built.js` runs in both modes and tries to
mutate the visible `<picture data-lazy>` to swap the placeholder
`<source srcset="data:image/gif;...">` for the real responsive set. In
preview the mutation sticks; in dev it gets overwritten on the next
React render and the placeholder returns.

## Root cause

`engine/targets/shared/hoist-noscript-picture.ts:54-65` only matches the
`<source data-empty>` placeholder pattern. Apple's home page uses TWO
equivalent lazy patterns:

Shape A (matched today):
```html
<picture data-anim-lazy-image>
  <source data-empty srcset="data:image/gif;..." media="...">
  <img src="/real.jpg" alt="">
</picture>
<noscript><picture>...real sources...</picture></noscript>
```

Shape B (NOT matched today, 36 of 36 broken images on apple home):
```html
<picture data-lazy>
  <source srcset="data:image/gif;..." media="(min-width:0px)">
  <img src="/real.jpg" alt="">
</picture>
<noscript><picture>...real sources...</picture></noscript>
```

The captured clone HTML has 48 total lazy pictures: 12 Shape A (already
hoisted at emit time, work in both modes) and 36 Shape B (left as
placeholders in the emitted React JSX, runtime-dependent).

Why preview "works" and dev does not despite the JSX being identical:

1. Apple's `endless-entertainment-gallery.built.js` runs on
   IntersectionObserver and overwrites each placeholder `<source
   srcset>` with the real responsive set.
2. In preview (`vite preview` of the production bundle) React's
   StrictMode dev-only double-render is OFF, so once apple's runtime
   has swapped the srcset, React never re-renders that node and the
   real value sticks.
3. In dev (`vite dev`) StrictMode double-renders every component in
   development. The second render re-applies the original JSX
   (`srcSet="data:image/gif;..."`) on top of apple's mutation, blanking
   the tile again.

Evidence: `src/main.tsx` line 10 wraps `<App />` in `<React.StrictMode>`,
and the React 19 dev-only double-render is documented to re-apply props
to host elements. Apple's runtime mutates the DOM; React's reconciler
treats the mutation as drift and snaps it back.

The proper fix is to do the substitution at EMIT time, not depend on
runtime mutation. Shape A already does this; Shape B should too.

## Fix design

`engine/targets/shared/hoist-noscript-picture.ts` extended to also
match Shape B by introducing `collectPlaceholderSources($picture)`:

| Condition | Treated as placeholder? |
|---|---|
| `<source data-empty>` (any parent) | yes (Shape A, unchanged) |
| `<source srcset="data:image/gif;...">` on `<picture data-lazy>` | yes (Shape B, new) |
| `<source srcset="data:image/gif;...">` on a plain `<picture>` | no |
| Anything else | no |

The `data-lazy` gate keeps the match narrow: only pictures explicitly
marked lazy get the data-URI srcset treatment, so genuine inline gif
sources on unrelated sites stay untouched. The downstream substitution
logic (read noscript, splice real sources, copy fallback img srcset) is
unchanged.

Why the same change works in dev AND preview symmetrically: the
substitution happens at emit time before React or Vite ever sees the
JSX. The emitted component carries the real responsive `<source>` set
in its initial JSX, so:

- Vite dev serves the JSX with real srcsets, React renders them,
  StrictMode double-render re-applies the same real values, and apple's
  runtime mutation (if it still happens) is a no-op against an already
  correct picture.
- Vite build inlines the same JSX into the production bundle, preview
  renders identically, and again apple's runtime is redundant.

No capability check on environment, no branching on `import.meta.env`,
no special-case for StrictMode. The fix is purely static.

## Before / after

### Before (this commit's parent, `4e71513`)

| Mode | Broken images at first paint | Broken images after scroll-tour |
|---|---|---|
| dev | 36 / 49 | 36 / 49 |
| preview | 36 / 49 | 0 / 49 |

### After (this commit)

| Mode | Broken images at first paint | Broken images after scroll-tour |
|---|---|---|
| dev | 0 / 49 | 0 / 49 |
| preview | 0 / 49 | 0 / 49 |

Visual proof: side-by-side screenshots of the "Endless entertainment"
section at mid-page scroll show identical renders in dev and preview,
both displaying the full carousel imagery (Apple TV+ tiles with Marisa
Robertson, Maximum Pleasure, Margo, Ted Lasso shows).

The 99.95% production-parity score is preserved (preview unchanged in
broken-image count, just now matched by dev).

## Anomalies / Surprises

1. **The bug premise was half right.** Cameron described dev as broken
   and preview as faithful, which framed the investigation toward
   "dev-mode HTML transform / module type / MIME / path resolution"
   hypotheses. None of those held: the dev-served HTML is functionally
   identical to preview, every script and asset serves with correct
   MIME and 200 status. The actual divergence is downstream, in how
   React's StrictMode dev-only double-render interacts with apple's
   runtime DOM mutation.

2. **Preview was never "really" rendering the images correctly.** It
   was relying on apple's lazy-load runtime to monkey-patch the DOM
   after first paint. That works in preview only because StrictMode is
   inert in production builds, not because preview is more faithful.
   The "fidelity" of preview was a happy accident of build mode, not
   the intended behaviour of the clone.

3. **StrictMode's drift-correction is real and visible.** When apple's
   runtime swaps a srcset and React then re-renders the host element,
   React really does re-apply the JSX-defined `srcSet` attribute on
   top of the mutation. This is documented behaviour but rarely
   demonstrated this clearly. The lesson generalises: any clone that
   embeds a third-party DOM-mutating script will hit the same problem
   under StrictMode. The cure is to render the FINAL state in JSX, not
   rely on the script to converge to it.

4. **Two lazy patterns on one apple page.** apple.com home ships both
   Shape A and Shape B on the same render. The split is roughly:
   12 Shape A on hero / fixed content, 36 Shape B on the endless
   entertainment carousel. There may be a third shape on other apple
   pages; that's a future enhancement candidate.

5. **No need to ship a custom Vite plugin.** The first instinct was to
   write a Vite plugin that strips StrictMode in dev, or a custom HTML
   transform that re-injects apple scripts. Both would have been more
   complex and would have diverged dev from preview. The hoist
   extension is six lines of logic, fully shared across targets.

## Files touched

| File | Change |
|---|---|
| `engine/targets/shared/hoist-noscript-picture.ts` | Extend placeholder detection to cover Shape B (`<picture data-lazy>` with `<source srcset="data:image/gif">`). Pure static rewrite at emit time. |
| `docs/V2.0/observations/w10-react-dev-mode-parity.md` | This document. |

No changes to the react emitter, react scaffold, or vite config: the
fix is in the shared hoist pass that both astro and react targets call
during build.

## Verification

- `npx tsc --noEmit | grep "error TS" | grep -v clones | grep -v docs/research | wc -l` → 0
- `npx parity test` → 4/4 PASS
- `npm run check:astro-emit && check:refactor && check:prettify && check:scope-styles` → all green
- Re-emit apple.com react against existing capture: 326 assets / 30.17 MB / 6 components / 1 page
- Boot dev server + preview server: both report 0 broken images and visually identical screenshots at mid-page scroll
- Side-by-side `<picture class="tv-gallery-atvplus-logo">` outerHTML in dev and preview: now identical, both with real `/v/home/cj/images/tv-gallery/logo_hero_light_small.png` srcset
