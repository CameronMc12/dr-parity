# W7B — Astro image 404 investigation

Date: 2026-05-22
Branch: prototype-mode
Reference run: `clones/www-apple/2026-05-22T11-23-38-769Z/`

## Symptom

`parity clone https://www.apple.com astro` reports 100% parity but the previewed Astro site shows broken images. The capture log line was:

```
complete:assets desktop fetched=41 failed=153
```

Most of the 153 failures are Apple's gated SF Pro font endpoints (expected). The remaining failures are images, and they manifest as 404s in the previewed Astro build.

## Root cause audit

Static clone manifest (`captures/desktop/clone/manifest.json`) reports 107 successfully captured asset rows. The parsed asset index (`parsed/assets/index.json`) contains 89 entries with `image/*` MIME types — they were all fetched.

Counted distinct local image references across the emitted Astro components (excluding the static `_external/...` prefix, which is intentional):

```
existing in public/ : 23
missing  in public/ : 78
total distinct refs : 101
```

77% of the local image references emitted into the Astro components do not exist on disk.

### Five-image matrix

| URL fragment | in_har | parsed | fetched | rewritten_in_static | rewritten_in_astro | served |
|---|---|---|---|---|---|---|
| `hero_iphone_family__fuz5j2v5xx6y_largetall.jpg` | yes | yes | yes | yes (local) | yes (local) | yes |
| `hero_iphone_family__fuz5j2v5xx6y_large.jpg`     | no  | n/a | no  | left as `/v/home/...` | passed through | no (404) |
| `hero_iphone_family__fuz5j2v5xx6y_largetall_2x.jpg` | no | n/a | no | left as `/v/home/...` | passed through | no (404) |
| `hero_iphone_family__fuz5j2v5xx6y_medium.jpg`    | no  | n/a | no  | left as `/v/home/...` | passed through | no (404) |
| `hero_iphone_family__fuz5j2v5xx6y_small_2x.jpg`  | no  | n/a | no  | left as `/v/home/...` | passed through | no (404) |

Every captured image is the `_largetall` variant only (the one Apple's `<picture>` matched at the desktop viewport during capture). Every other variant referenced in the same `<source srcset="...">` was never requested, so the HAR never saw it, so the parsed asset index lacks it, so the html rewriter has no map entry and leaves the relative path intact, so Astro serves a 404 from `public/`.

## Gap classification

| Gap class | Share of broken refs | Notes |
|---|---|---|
| srcset sibling variants | ~95% | Each captured image has 6–9 unrequested siblings (small/medium/mediumtall/large/largetall × 1x/2x). This is the dominant cause. |
| `<picture>` `<source>` children | overlapping | Same family of URLs, expressed as `<source srcset>` rather than `<img srcset>`. Already covered by the same fix. |
| lazy-loaded out-of-fold images | minor | The capture tour scrolls but the variants of in-fold heroes account for almost all 404s. |
| background-image CSS | none observed for apple.com homepage | `complete-assets.ts` already scans CSS `url(...)` and `@import`. Not the cause here. |
| Astro emit dropping path rewrite | not a separate gap | Astro emit faithfully carries through what the static clone produced. The hole is upstream. |

## Fix design

Smallest fix that resolves the dominant class: extend `complete-assets.ts` to scan the parsed `document.html` for image-bearing references and add the resolved absolute URLs to the candidate set, alongside the existing CSS `url(...)` scan.

New module: `engine/extract/asset-inventory/from-html.ts`
- exports `collectHtmlAssetCandidates({ html, documentUrl }): string[]`
- walks the parsed document with cheerio
- collects URLs from: `img[src]`, `img[srcset]`, `source[src]`, `source[srcset]`, `video[src]`, `video[poster]`, `audio[src]`, `link[rel=preload][href]`, plus common lazy attrs (`data-src`, `data-srcset`, `data-image`, `data-image-source`)
- collects URLs inside inline `style="..."` and `<style>...</style>` blocks via the existing CSS regex
- resolves every URL against `documentUrl`, returns absolute http(s) URLs only
- emits the full srcset variant list (splits on `,`, keeps the URL part)

Edits to `scripts/complete-assets.ts`:
- read `parsed/document.html` and `parsed/document.url`
- feed those into `collectHtmlAssetCandidates` and merge into the candidate map
- raise `MAX_CANDIDATES` from 500 to 2000 (Apple's homepage has roughly 800 distinct sibling variants; 500 is too low)

Capability-detection: the new pass runs whenever `parsed/document.html` and `parsed/document.url` both exist. No new CLI flag. This is additive: sites without unrequested srcset siblings see zero new fetches.

Tour pass remains untouched. The fix is at the asset-completer layer, not the capture layer.

## Before vs after measurement

Before (reference run on 2026-05-22):
- distinct local image refs in astro `src/`: 101
- missing in `public/`: 78
- broken-ref rate: 77%

After (re-run pending — see commit log for hash):
- to be measured

## Anomalies and surprises

- Astro emit is faithful. The components carry exactly what `clone/index.html` produced, including the unrewritten variants. Earlier suspicion that astro emit dropped the rewrite map was wrong.
- `parse:har` already records every captured asset correctly. The hole is purely "the browser never asked for the sibling variants".
- The static clone's html-rewriter does the right thing per-URL (lookup → rewrite if hit, leave alone if miss). Leaving alone is fine for an externally-loadable URL, but the variants are relative root paths (`/v/home/...`) which become 404s when served locally. A second fix option would be to absolutise unrewritten same-origin paths back to the original host. Decided against it because (a) the user wants images downloaded, not externally served, and (b) absolutising would create an inconsistent experience (some refs local, some live).
- `complete-assets.ts` already had the machinery for this — CSS scanning, concurrency, dedup, MIME classification, ext inference. The fix is a 60-line additive module plus a small wiring change.

## Hard-constraint compliance

- additive only: new module + small extension to existing one; no removal
- capability-detected: trips only when parsed/document.html exists
- Playwright CLI only: no browser changes
- atomic commits planned: (1) `feat(extract): scan parsed DOM for srcset and picture variants`, (2) `feat(complete-assets): fetch HTML-derived assets`

## React parity

The same gap exists for the react target. The fix lives entirely in `complete-assets.ts`, which runs before any framework emit, so the same fetched siblings end up in the parsed asset index and propagate through every downstream emit (astro, react, webapp).
