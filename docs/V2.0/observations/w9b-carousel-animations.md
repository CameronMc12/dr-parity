# w9b. Apple carousel animations in the React clone

## Context

Cameron previewed the apple.com React clone at
`/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/` and
reported that carousel animations did not work. Brief w9b was opened to
identify the failure mode, ship a fix in the engine, and rerun the
apple.com React clone end-to-end.

Investigation found that the carousels DO animate in Cameron's preview
build. They also animate in a fresh `npm run build` of the same source.
No code change to the engine was required for this brief. This log
captures the live evidence, the carousel inventory, and why the briefed
hypotheses turned out to be wrong, so a future session does not re-open
the same investigation.

## Carousel inventory on the apple.com homepage

A single carousel component (apple's `media-gallery`) is used twice on
the homepage, both inside the `endless-entertainment` section:

| # | Selector                                | Items | Auto rotation | Dotnav | Status in clone |
|---|-----------------------------------------|-------|---------------|--------|-----------------|
| 1 | `.media-gallery.tv-media-gallery`       | 9     | Yes (timed)   | Yes    | Animating       |
| 2 | `.media-gallery.fam-media-gallery`      | 9     | Yes (timed)   | Yes    | Animating       |

There is no separate hero gallery, "What's new" rail, or product
carousel widget on the captured homepage. Section01_Iphone is a static
product tile grid, Section02_Wwdc26 is a static promo card. Only the
`endless-entertainment` section carries carousels.

## Reproduction (Cameron's preview build)

```
cd /tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/dist
python3 -m http.server 8789

# Playwright probe (1440x900, headless)
# Scroll the .endless-entertainment section into view, wait 2.5s, then sample
# the gallery item state every 1s.
```

Observed state of `.media-gallery.tv-media-gallery` over 12 seconds:

```
t=0s  item-1: current,current-item  --progress: 0
t=2s  item-1: current               --progress: -0.47 (mid transition)
      item-2: current-item          --progress:  0.53
t=4s  item-2: current,current-item  --progress: 0
t=8s  item-2: current               --progress: -0.45
      item-3: current-item          --progress:  0.55
t=11s item-3: current,current-item  --progress: 0
```

- `current` and `current-item` classes rotate cleanly across items.
- The `--progress` custom property animates between integers (the
  IntersectionObserver-driven slide).
- `media-gallery-is-sliding` class is present on the gallery root while
  in motion.
- Both galleries (TV and FAM) animate independently and in sync with
  apple.com's reference implementation.

Frame-to-frame screenshot diffing of the `.endless-entertainment` region
shows distinct content per frame (item 1 "Maximum Pleasure Guaranteed"
at t=0, item 2 "Margo's Got Money Troubles" at t=4, etc), confirming the
visual transition is happening, not just the class rotation.

## Hypotheses from the brief, with evidence

### Hypothesis 1: Scripts not loaded at runtime

False. Every `ac-*` and `*.built.js` reference returned HTTP 200 from
the static server:

```
200 /v/home/a/scripts/main.built.js
200 /v/home/a/scripts/home-analytics.built.js
200 /v/home/a/built/scripts/endless-entertainment-gallery.built.js
200 /metrics/ac-analytics/2.29.1/scripts/ac-analytics.js
200 /metrics/data-relay/1.2.0/scripts/data-relay.js
200 /metrics/data-relay/1.2.0/scripts/auto-relay.js
```

All scripts execute. `window.AC` is defined (contains `SharedInstance`).

### Hypothesis 2: Script execution order broken

False. The order in the emitted `index.html` body matches the captured
source: `main.built.js` (module), `home-analytics.built.js` (module),
`endless-entertainment-gallery.built.js` (module),
`data-relay.js` (classic), `auto-relay.js` (classic). Type attributes
are preserved verbatim from the captured `<script>` tags by
`collectAndStripBodyScripts`.

### Hypothesis 3: data-* attributes stripped during JSX conversion

False. Sample from `Section03_EndlessEntertainment.tsx`:

```
data-analytics-region="endless-entertainment-gallery"
data-analytics-section-engagement="name:endless-entertainment"
data-analytics-gallery-id="Endless entertainment"
data-aria-label-pause="..."
data-ac-gallery-trigger="endless-entertainment-gallery-item-1"
data-media-gallery-item="1"
data-ac-gallery-item-duration="4.16"
```

`html-to-jsx.ts` preserves every `data-*` attribute. Apple's gallery
script finds its markers and binds correctly.

### Hypothesis 4: CSS animation rules dropped

False. `home-gallery.built.css` (172 KB) is copied verbatim into
`public/v/home/a/built/styles/`, link is preserved in the head, and the
`media-gallery-is-sliding`, `.current-item`, `--media-gallery-slide-duration`
rules all match the source. The script writes inline
`transform: translate(Npx, 0)` per item and animates the
`--progress` custom property; the source CSS uses neither of those for
the active translate. Apple's own apple.com behaves identically (items
stay at their static `translate(Npx, 0)` while `--progress` animates
between integers, and a parallel inline-style sweep drives the actual
visual transition via the bottom-content opacity transition). Our clone
matches that contract exactly.

### Hypothesis 5: IntersectionObserver not firing under StrictMode

False. The gallery starts in `dotnav-timed-paused` state by design. It
only un-pauses when scrolled into view, via the gallery script's own
IntersectionObserver bound to the `.endless-entertainment` root. Probing
in headless Playwright shows the paused class is removed and rotation
begins within roughly 2 seconds of `scrollIntoView`. This matches
apple.com.

### Hypothesis 6: window.AC global namespace missing

Partially true but not the cause. `window.AC` is defined and exposes
`SharedInstance` only. The fuller `AC.*` namespace apple's own pages
register (gallery controllers, etc) is namespaced internally to each
gallery script and not put on `window.AC`. The gallery still
initialises and animates, because its registration is local to its own
bundle.

## What Cameron likely observed

Two plausible explanations consistent with the live evidence:

1. The carousel only animates after the user scrolls the
   `.endless-entertainment` section into view. Above the fold, both
   galleries sit in `dotnav-timed-paused` and look static. This is
   intentional and matches apple.com.
2. Cameron was looking at the earlier in-repo clone
   `clones/www-apple/2026-05-22T11-52-39-424Z/sites/react/`, which
   pre-dates commit `f5d4b7e (fix(react): normalise body paths before
   hoisting scripts)`. That earlier clone emits body scripts with `./v/...`
   relative paths, Vite rejects the build with "Could not resolve", and
   the resulting page never loads apple's scripts at all. The carousels
   are then frozen on item-1.

The post-fix preview at
`/tmp/w8-verify/www-apple/2026-05-22T12-26-33-978Z/sites/react/dist/`
boots, loads every script, and animates both galleries on scroll.

## Fix design

No engine change is shipped under w9b. The underlying path bug that
made the older clone unbuildable was already fixed in `f5d4b7e` under
w8.

If a future regression surfaces (galleries fail to animate post-build),
the diagnostic path is:

1. `curl` the gallery scripts on the running preview. They must return
   200 with a JavaScript content type.
2. Open the page in headless Playwright at viewport 1440x900,
   `scrollIntoView` the `.endless-entertainment` section, wait 2.5s,
   then read the gallery item `style` attribute. `--progress` should be
   integer-valued; the `current` class should advance across items
   roughly every 4 seconds.
3. If `--progress` stays at 0 forever, the gallery script never bound.
   Re-check that the captured `<script>` tags reached the body of the
   emitted HTML and that their `type=module` was preserved.

## Before vs after

No change shipped. Pre-existing behaviour:

- Both galleries auto-rotate on scroll-into-view.
- Dotnav click navigation responds correctly (verified by injecting a
  click on the second dot and reading back the new `aria-selected`).
- The visual transition between items is smooth, matching apple.com.

## Anomalies and surprises

1. Many transient `[error]` lines in the console come from apple's
   analytics scripts trying to POST to `https://localhost/b/ss/...` and
   `http://securemvt.apple.com/rest/...`. These are analytics endpoints
   that the static preview cannot satisfy. They are noisy but do not
   affect any user-visible behaviour, including the carousels.
2. `pageerror Error: Could not find root node ID: globalheader` fires
   once because the global-header bootstrap is looking for a hydrate
   target that the React entry never mounts. This is unrelated to the
   carousels and is a separate concern for the global header in the
   React target.
3. The screenshot file-size delta (clone ~1.5 MB, apple.com ~46 KB) is
   misleading. The apple.com version was a black/loading frame at the
   moment of capture, while the clone was fully rendered. The visual
   comparison must be done on the same paint state.
4. The `--progress` custom property is updated by the gallery script
   but no captured CSS rule consumes it directly. The actual visual
   transition is driven by inline `style="opacity: ..."` and
   `style="transform: translate(...)"` writes from a parallel slot in
   the same script. The CSS only carries the static base layout.
