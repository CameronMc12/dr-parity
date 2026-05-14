@AGENTS.md

## Playwright Capture Pipeline (multi-mode)

A fast, additive capture pipeline lives alongside the existing extractor. It does NOT touch `engine/extract/playwright/*`, `engine/analyze/*`, `engine/generate/*`, or `engine/qa/*`.

### Components

- `scripts/capture.ts` — main CLI. Three modes: `launch` (default), `cdp`, `persistent`.
- `scripts/parse-har.ts` — parses each viewport's `network.har` OR manual `network.json` into `parsed/styles/`, `parsed/scripts/`, `parsed/assets/`, plus the primary `document.html`.
- `scripts/parse-trace.ts` — unzips each `trace.zip` and emits `parsed/dom-snapshots.jsonl` for downstream analysis.
- `engine/extract/browser/cdp-attach.ts` — `openBrowser({ mode })` strategy. Returns a discriminated handle for `launch | cdp | persistent`.
- `engine/extract/browser/viewports.ts` — the four canonical viewports.
- `engine/extract/capture/recording.ts` — builds the per-context recording options (HAR + video + trace).
- `engine/extract/capture/network-recorder.ts` — manual response recorder for CDP / persistent modes (writes `network.json`).
- `engine/extract/capture/tour.ts` — programmatic scroll + hover pass to wake lazy content and animations.

### Modes

| Mode | Browser | HAR | Video | Trace | Viewports |
|------|---------|-----|-------|-------|-----------|
| `launch` (default) | Fresh headless Chromium, cached binary | full HAR | yes | yes | all four (per-viewport context) |
| `cdp` | Attach to Chrome on `:9222` (e.g. Image Studio) | manual `network.json` | no | yes | single (CDP profile is fixed) |
| `persistent` | `launchPersistentContext` with `channel: chrome` and shared user-data-dir | manual `network.json` | no | yes | single |

Why three modes: Playwright cannot create new isolated contexts on a CDP-attached browser (the existing user context does not accept recording options, and `newContext` against a remote browser is rejected). The default `launch` mode gives the full-fidelity capture; `cdp` and `persistent` exist for cases where a logged-in profile is required.

### CAVEAT: profile lock (persistent mode only)

Only one process can own the `~/.config/playwright-pinterest` profile at a time. If Chrome is already using that profile, `persistent` mode will fail on profile lock. Fully quit the conflicting Chrome window before running `--mode=persistent`.

### Example

```
npm run capture https://example.com
npm run capture https://example.com -- --mode=launch --viewport=desktop
npm run capture https://example.com -- --mode=launch --viewport=desktop,mobile --headed
npm run capture https://example.com -- --mode=cdp
npm run capture https://example.com -- --mode=persistent

npm run parse:har -- docs/research/captures/example.com/2026-05-14T...
npm run parse:trace -- docs/research/captures/example.com/2026-05-14T...
```

Output structure:

```
docs/research/captures/<host>/<iso-timestamp>/
  manifest.json
  <viewport>/                # 'cdp' or 'persistent' for those modes
    screenshot.png
    network.har              # launch mode
    network.json             # cdp / persistent mode
    trace.zip
    video/                   # launch mode only
    parsed/                  # after parse:har / parse:trace
      document.html
      document.url
      styles/{<sha8>.css, index.json}
      scripts/{<sha8>.js, index.json}
      assets/{<sha8>.<ext>, index.json}
      asset-manifest.json
      skipped.json
      trace-unpacked/
      dom-snapshots.jsonl
      trace-manifest.json
    clone/                   # after `clone` step (static 1:1 snapshot)
      index.html
      styles/<sha8>.css
      scripts/<sha8>.js
      assets/<sha8>.<ext>
      manifest.json
```

## Full Clone Pipeline (Playwright capture → static 1:1)

Single end-to-end command:

```
npm run clone-site -- https://example.com
npm run clone-site -- https://example.com --viewport=desktop --no-tour
npm run clone-site -- https://example.com --out=./my-captures --no-preview
```

This runs the full chain in order: `capture` → `parse:har` → `parse:trace` → `clone`. Output for each viewport lives at:

```
<out>/<host>/<timestamp>/<viewport>/clone/index.html
```

Preview a clone locally:

```
npx serve "<out>/<host>/<timestamp>/<viewport>/clone"
```

Then open the printed URL in a browser. The exact preview command is printed at the end of `clone-site` for every viewport that produced output.

### Ad-hoc steps

For partial runs (e.g. re-clone an existing capture without re-fetching):

```
npm run capture -- <url> [--mode=...] [--viewport=...]
npm run parse:har -- <capture-dir>
npm run parse:trace -- <capture-dir>
npm run clone -- <capture-dir> [--viewport=desktop]
```

### Capture modes inside the clone pipeline

`clone-site` always uses the default `launch` mode (fresh headless Chromium with full HAR + trace + video). If you need a logged-in profile, run the steps manually with `--mode=cdp` (against Image Studio Chrome on :9222) or `--mode=persistent`.

### What the clone rewriter does

- Builds `Map<originalAbsoluteUrl, localCloneRelativePath>` from parsed indexes
- Copies every captured CSS / JS / asset into `clone/<bucket>/<sha8>.<ext>`
- Walks the captured HTML with cheerio and rewrites every reference (`link`, `script`, `img`, `srcset`, `source`, `video`, `audio`, same-origin `iframe`, same-origin captured `a`, inline `style=`, inline `<style>`)
- Rewrites `url(...)` and `@import` inside every captured CSS file using a regex pass (URLs resolved against the CSS's own absolute URL before lookup)
- Strips `<meta http-equiv="content-security-policy">`, `integrity`, `crossorigin`, and any existing `<base href>`; injects a fresh `<base href="./">` at the top of `<head>`
- Leaves uncaptured external URLs intact so the clone still loads them when served online
- Writes per-viewport `clone/manifest.json` with counts, byte totals, and a sample of unresolved external URLs

### Limitations

- The clone is a literal static snapshot of the first paint plus whatever the capture tour exercised. Server-rendered HTML and pre-hydrated content work fine; deep SPA navigation and lazy-loaded code paths that the tour did not trigger will not be in the clone. Keep `--no-tour` off to maximise capture.
- External CDN URLs that the capture did not record remain online references. The clone needs network access for those to load.
- Same-origin `<a href>` is only rewritten when the link target was captured. Multi-page cloning needs separate captures per page (future enhancement).
- Scripts run unmodified inside the clone. Scripts that hard-code production hostnames (analytics, CSRF endpoints, etc.) may still fail in the cloned page. This is expected and not a clone bug.
