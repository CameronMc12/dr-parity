# Suggested Edits & Opportunities

Gaps and opportunities discovered during implementation of the roadmap features.

---

## Discovered during Tier 1 Items 1.5 & 1.6 (2026-03-30)

### Gaps

1. **Font metric browser extraction depends on page fonts being loaded**: The `extractMetricsViaBrowser` function calls `document.fonts.ready` but if fonts were loaded via `@font-face` on a cross-origin stylesheet that was blocked, the Canvas API measurement will fall back to a system font. Consider adding a retry mechanism or checking `document.fonts.check()` for each family before measuring.

2. **Stagger pattern detection limited to CSS-declared delays**: The `detectStaggerPatterns` function only detects stagger patterns that use CSS `animation-delay` or `transition-delay`. JavaScript-driven staggers (e.g., GSAP `stagger` property, Framer Motion staggerChildren) are not captured. The GSAP tween wrapper could be extended to capture the `stagger` option from `gsap.to/from/fromTo` calls.

3. **Stagger direction detection is binary**: Currently only `forward` and `reverse` are detected based on delay ordering. The `center` and `edges` directions (common in GSAP staggers) would require checking if delays form a V-shape or inverted V-shape pattern, which is not yet implemented.

4. **Font metric fallback `size-adjust` is hardcoded to 100%**: The `buildFontMetricFallbacks` function emits `size-adjust: 100%` for all fonts. For more accurate fallback matching, `size-adjust` should be calculated based on the ratio of the custom font's x-height to the fallback font's x-height. This requires either measuring the fallback font in the browser or maintaining a lookup table for common system fonts.

### Opportunities

1. **GSAP stagger capture from runtime monitoring**: The existing GSAP tween wrapper could extract `stagger` options (e.g., `gsap.to(".cards", { opacity: 1, stagger: 0.1 })`) and produce `StaggerPattern` entries automatically. This would complement the CSS-based detection with JS-library-driven staggers.

2. **Font metric `xHeight` and `capHeight` from Canvas API**: The `extractMetricsViaBrowser` function could be extended to measure x-height (height of lowercase 'x') and cap-height (height of capital 'H') using Canvas `measureText()` ascent values at different font sizes. These values are useful for more accurate `size-adjust` calculations.

3. **Stagger pattern integration with IntersectionObserver**: Many staggered animations are triggered by scroll visibility (IO-driven stagger). Cross-referencing detected stagger patterns with IO observer records would enable generating more accurate reveal-on-scroll-with-stagger code in components.

## Discovered during Tier 1 Items 1.3 & 1.4 (2026-03-30)

### Gaps

1. **Pre-existing type errors in `asset-collector.ts`**: The `DiscoveredImage` interface was expanded (adding `srcset`, `sizes`, `dataSrc`, `dataLazy`, etc.) but the `page.evaluate` return in `discoverAssets` still returns the old shape. Needs a migration pass to emit the new fields from the browser context.

2. **Pre-existing errors in `font-extractor.ts`**: References to `estimateFontMetrics` and `extractMetricsViaBrowser` are unresolved. These functions are likely planned but not yet implemented — the `FontMetrics` interface was added to `extraction.ts` but the extraction logic is incomplete.

3. **GSAP `gsap.from` and `gsap.fromTo` wrapping**: The runtime script wraps `gsap.to`, `gsap.from`, and `gsap.fromTo` via a generic loop, but `fromTo` takes 3 args (targets, fromVars, toVars) where `scrollTrigger` lives in `toVars` (the 3rd arg). The current implementation uses `method === "fromTo" ? args[2] : args[1]` to handle this, but edge cases exist where users pass scrollTrigger in `fromVars` — consider adding a check for both arg positions.

4. **IO effect capture timing**: The MutationObserver-based approach captures class/style changes caused by the IO callback, but if the callback uses `requestAnimationFrame` or `setTimeout` internally, changes may be missed. Consider adding a secondary delayed check (e.g., 500ms after intersection) to catch async callback effects.

### Opportunities

1. **GSAP Timeline capture**: Currently we capture individual `ScrollTrigger.create()` calls and `gsap.to/from/fromTo` with `scrollTrigger` options, but GSAP timelines (`gsap.timeline()`) with attached ScrollTriggers are not intercepted. This would capture more complex scroll-driven animation sequences.

2. **ScrollTrigger `onUpdate` progress value**: When `scrub` is used, the `onUpdate` callback receives a `self` parameter with `self.progress` (0-1). Capturing this would enable more accurate scroll-progress-based animation reconstruction.

3. **IO effect aggregation across multiple elements**: Currently `mergeIOEffectsIntoSpecs` matches by exact selector. If the same IO callback observes multiple elements that get different classes, we only capture one. Consider grouping by class pattern similarity to generate more accurate component-level code.

4. **Component-gen GSAP cleanup**: The generated GSAP `useEffect` doesn't return a cleanup function that kills ScrollTrigger instances. Should generate `return () => { ScrollTrigger.getAll().forEach(st => st.kill()); };` for proper cleanup on unmount.

## Discovered during Tier 1 Items 1.7 & 1.8 (2026-03-30)

### Gaps

1. **Gradient token naming is positional, not semantic**: `GradientToken.cssVariable` auto-names gradients as `--gradient-0`, `--gradient-1`, etc. A future pass could infer semantic names from DOM context (e.g. `--gradient-hero` if the gradient appears inside a hero section, `--gradient-cta` if on a button).

2. **Radial/conic gradient Tailwind mapping not supported**: `mapGradientToTailwind` only handles `linear-gradient` since Tailwind's native gradient utilities are direction-based. Radial and conic gradients always fall back to CSS custom properties. Consider generating utility classes via `@theme` extension in globals.css for commonly-seen radial patterns.

3. **`<picture>` element code generation emits plain `<Image>`**: When `pictureSources` are present, the generator could emit a `<picture>` element wrapping `<source>` elements with their `media` and `type` attributes for art-direction use cases that `next/image` alone cannot handle.

### Opportunities

1. **Gradient stop colors could cross-reference color tokens**: Gradient stop colors are parsed independently and not linked to the extracted `ColorToken` palette. Cross-referencing would allow emitting gradient stops as `from-primary to-accent` Tailwind classes rather than arbitrary values.

2. **srcset download size budget**: When downloading all srcset variants, total asset size can balloon. Consider a config option to only download the largest and smallest variants, or to skip intermediate sizes that `next/image` can generate on-the-fly.

3. **Non-standard lazy-load attribute detection**: Some sites use custom lazy-load libraries (lazysizes, vanilla-lazyload) with attributes like `data-srcset`, `data-sizes`, or `data-bg`. The scanner could be extended to check for these.

4. **Gradient deduplication across similar values**: Two gradients that differ only in stop positions by a few percent could be considered duplicates. Currently deduplication is exact-string-match only.

## Discovered during Tier 1 Items 1.1 & 1.2 (2026-03-30)

### Gaps

1. **`::placeholder` and `::marker` pseudo-elements not yet captured**: The `pseudoStyles` field on `ElementSpec` supports `placeholder` and `marker` keys, but the page scanner currently only extracts `::before` and `::after`. Adding `::placeholder` for `<input>`/`<textarea>` elements and `::marker` for `<li>` elements would improve form and list styling fidelity.

2. **Variable reference tracking not yet consumed downstream**: `StylesheetExtractionResult.variableReferences` now captures where `var(--xxx)` is used, but no downstream consumer (component-gen, builder-prompts) yet uses this data. Potential uses include: annotating builder prompts with original variable references so builders use `var()` instead of hardcoded values, and emitting `var(--xxx)` in generated inline styles.

3. **CSS variable scoping: dark mode overrides not handled**: `collectOriginalCssVariables` deduplicates by `name@scope` but does not separate `:root` variables from `.dark`-scoped ones. The foundation generator could emit a `.dark { }` block with dark-mode variable overrides when detected.

4. **Pseudo-element Tailwind class generation is best-effort**: `buildPseudoElementClasses` maps common properties to Tailwind `before:`/`after:` modifiers. Complex pseudo-elements (multi-layer backgrounds, transforms with multiple functions) may produce invalid arbitrary value syntax. Consider falling back to a generated CSS class in `@layer components` for complex cases.

### Opportunities

1. **Enrich builder prompts with variable reference context**: For each element whose computed styles were derived from CSS variables, the builder prompt could include a "CSS Variables Used" section listing the original `var(--xxx)` references. This would enable builders to produce more maintainable code using CSS custom properties rather than hardcoded values.

2. **Pseudo-element content in text extraction**: Currently `collectTextContent` in builder-prompts only captures element text. Pseudo-element `content` values (especially decorative characters like arrows, bullets, or quotes) could be listed separately to ensure builders reproduce them faithfully.

## Discovered during Tier 2 Items 2.5, 2.6 & 2.7 (2026-03-30)

### Gaps

1. **Asset waiter does not detect dynamically injected images**: `waitForAssetsToLoad` queries `document.querySelectorAll('img')` once. If JavaScript injects images after the initial query (e.g., lazy-load libraries that swap `data-src` to `src`), those images may not be awaited. Consider using a MutationObserver to watch for new `<img>` elements during the wait period.

2. **Content masker regex runs twice per text node**: The `regexMasks` loop calls `regex.test(text)` and then `text.replace(regex)`. Since `RegExp` with the `g` flag is stateful (`lastIndex`), the `test` call advances the internal cursor, which can cause `replace` to miss the first match on even-count occurrences. The current implementation works around this by constructing a fresh `RegExp` for `replace`, but this pattern is fragile. Consider using only `replace` and checking if the result differs.

3. **Spatial diff analysis in fix-loop lacks raw pixel data**: `generateFixSuggestions` in the viewport-level path does not have access to the actual diff image pixel buffer (only `PixelDiffResult` metadata). The `analyzeDiffRegions` function exists but cannot be called without reading the diff PNG back from disk. Consider passing the diff `PNG` data through `ViewportDiff` or reading the file lazily.

4. **Content masks are not applied in fix-loop's `captureScreenshots` call**: `runFixLoop` calls `captureScreenshots` but does not forward content mask options. Users must pass `contentMasks` via `ScreenshotOptions` manually. Consider adding `contentMasks` to `FixLoopOptions` and threading it through.

### Opportunities

1. **Per-section content masks**: Different sections may have different dynamic content (e.g., a "latest posts" section has dates, a pricing section has currency amounts). Allowing `ContentMask` to be specified per `SectionInfo` would enable more precise masking without over-suppressing.

2. **Asset wait telemetry**: `waitForAssetsToLoad` could return a report of how many assets were waited on and how many timed out, enabling QA reports to flag pages with broken asset loading as a separate concern from styling differences.

3. **Diff image spatial analysis as a shared utility**: `analyzeDiffRegions` and the quadrant analysis in `section-comparator.ts` (`analyzeQuadrants`) perform overlapping work. These could be unified into a single `diff-analysis.ts` module that both `fix-loop.ts` and `section-comparator.ts` consume, reducing duplication and ensuring consistent spatial heuristics.

4. **Auto-suggest component file from section ID**: The fix suggestion currently guesses `src/components/{sectionId}.tsx` as the component file. Cross-referencing with the project's actual file listing (via glob) would produce accurate file paths and could even include the relevant line range.

## Discovered during Tier 2 Items 2.8, 2.9, 2.10 (2026-03-30)

### Gaps

1. **SVG sprite external references unresolved**: When `<use href="/sprites.svg#icon-name">` references an external SVG file (not inline on the page), the sprite symbols cannot be resolved without fetching the external file. The asset collector currently only handles inline sprite sheets. Consider adding a fetch step for external sprite URLs discovered via `<use>` `href` attributes.

## Discovered during Tier 2 Items 2.1, 2.2, 2.3, 2.4 (2026-03-30)

### Gaps

1. **Lenis easing function capture is lossy**: The Lenis config capture calls `easing.toString()` on the easing function, which for arrow functions yields the source code string but for native/minified functions yields `"function() { [native code] }"`. A future enhancement could detect common easing curves (e.g., cubic-bezier equivalents) by sampling the function at several points and matching against known curves.

2. **CSS-in-JS extraction regex parser is shallow**: The `parseCssTextToRules` regex parser handles single-level `selector { properties }` blocks but does not parse nested at-rules (`@media`, `@keyframes`, `@container`) within CSS-in-JS output. Styled-components and Emotion can emit media queries and keyframes inside their `<style>` elements. Consider a recursive parsing approach or reusing the CSSOM via `CSSStyleSheet.replace()` for more accurate extraction.

3. **CSS Grid `grid-template-areas` not roundtripped to Tailwind**: `grid-template-areas` is emitted as an inline style since Tailwind has no direct utility class. However, the corresponding `grid-area` on child elements is not captured in the Tailwind mapper either. Adding `grid-area` mapping (e.g., `[grid-area:header]`) would make the grid area system usable in generated components.

4. **Variable font `ital` axis not captured**: The `parseFontFaces` function detects `wght` ranges from `font-weight` and generic axes from `font-variation-settings`, but the `ital` axis (italic) is often expressed via `font-style: oblique 0deg 12deg` rather than `font-variation-settings`. This pattern is not yet parsed.

### Opportunities

1. **Lenis config propagation to GlobalBehavior**: The captured `LenisConfig` could be stored on the `GlobalBehavior` entry (where `type === 'smooth-scroll'`) as its `config` field, making it available to the foundation generator for more accurate Lenis CSS and initialization code in `layout.tsx`.

2. **CSS-in-JS class name deobfuscation**: Styled-components and Emotion generate hashed class names (e.g., `.sc-bdnylx`, `.css-1a2b3c`). Cross-referencing these with the extracted `CSSRuleData` selectors and DOM element class lists could map hashed classes to semantic component roles, improving builder prompt quality.

3. **Grid auto-fit/auto-fill responsive pattern detection**: When `grid-template-columns` uses `repeat(auto-fit, minmax(Xpx, 1fr))`, this is a responsive grid that needs no media queries. Detecting this pattern and generating the appropriate Tailwind arbitrary class (already supported) with a comment explaining the responsive behavior would improve generated code readability.

4. **Variable font `opsz` axis for optical sizing**: Many variable fonts include an `opsz` (optical size) axis. When detected, the generated CSS could include `font-optical-sizing: auto` and appropriate `font-variation-settings` for different text sizes (headings vs body), improving typographic quality.

2. **Container query Tailwind mapping is simplified**: The `container-type` and `container-name` mappings in `component-gen.ts` produce `@container` and `@container/{name}` classes, but Tailwind v4's container query utilities use `@container` as a class on the parent and `@sm:`, `@md:`, `@lg:` as responsive variants on children. The current mapping only handles the container definition side, not the responsive child selectors inside `@container` blocks.

3. **Container query rules not consumed downstream**: The `ContainerQueryData` captured in `StylesheetData.containerQueries` is extracted but not yet consumed by the component generator or builder prompts. A future pass should map these rules to Tailwind container query variant classes (`@sm:`, `@md:`, etc.).

4. **OKLCH/Lab to RGB conversion is approximate**: The `oklchToRgb` and `labToRgb` functions use simplified matrix math. Edge cases with very high chroma values or out-of-gamut colors may produce clamped or slightly inaccurate RGB results. For production-grade fidelity, consider using the `culori` npm package.

5. **Modern color space original values not preserved in globals.css**: The `buildGlobalsCss` function emits color token values as-is (which may already be oklch if the target site used it), but does not emit a paired RGB fallback variable (e.g. `--color-primary-rgb`) for browsers that do not support oklch. Consider adding `@supports` blocks or fallback variables.

### Opportunities

1. **SVG sprite deduplication with inline SVGs**: Some sites use both inline SVGs and `<use>` references to the same icons. Cross-referencing sprite symbol content hashes with inline SVG content hashes could eliminate duplicate icon components in `icons.tsx`.

2. **Container query breakpoint extraction**: When container queries include size conditions like `(min-width: 400px)`, these breakpoints could be collected alongside viewport breakpoints to give the generation pipeline a complete picture of responsive behavior.

3. **HSL/OKLCH color token preservation**: When the target site uses oklch or hsl natively, the design token system could preserve the original color space in `ColorToken.value` and add an `originalColorSpace` field. This would enable the foundation generator to emit tokens in the same color space the designers intended, rather than converting everything to RGB for deduplication.

## Discovered during Tier 3 Items 3.1, 3.2, 3.3, 3.4 (2026-03-30)

### Gaps

1. **`smartWait` DOM stability check depends on `document.body` existing**: The MutationObserver-based DOM stability check in `smartWait` assumes `document.body` is available. On pages where navigation leads to a blank document (e.g., client-rendered SPAs with a slow shell), `document.body` may be null, causing the `observer.observe()` call to throw. Consider adding a guard that waits for `document.body` before observing.

2. **Checkpoint phase data may exceed JSON serialization limits**: Large extraction results (e.g., `assets` with many base64-encoded images or `stylesheets` with thousands of rules) are stored in `.checkpoint.json` as nested JSON. On very large sites this file could grow to tens of MB, slowing checkpoint reads/writes. Consider storing each phase in a separate file (similar to the cache approach) or compressing the checkpoint.

3. **Cache TTL is not configurable via CLI**: The 1-hour TTL in `ExtractionCache` is hardcoded. For iterative development workflows where the target site changes frequently, a shorter TTL (or a `--cache-ttl` flag) would be useful.

4. **Screenshot batch optimization is sequential within batches**: The current batched screenshot approach still processes sections sequentially within each batch (since Playwright cannot take multiple screenshots on the same page simultaneously). The only gain is the reduced wait time (100ms vs 300ms). True parallelism would require multiple browser contexts rendering the same page, which trades memory for speed.

### Opportunities

1. **Selective phase re-extraction**: The `--resume` flag currently skips all completed phases. A `--rerun <phase>` flag could force re-extraction of a specific phase (e.g., `--rerun fonts`) while keeping other cached results, useful when debugging a single extraction step.

2. **Cache warming across URLs**: When extracting multiple pages from the same domain, font and stylesheet results are likely identical. A domain-level cache key (in addition to per-URL) could avoid redundant font/stylesheet extraction across pages of the same site.

3. **Progress reporting with ETA**: With checkpoint data tracking timestamps per phase, the resume output could estimate remaining time based on historical phase durations from the checkpoint file.

4. **Atomic checkpoint writes**: The current `writeFile` for checkpoints is not atomic. If the process crashes mid-write, the checkpoint JSON could be corrupted. Writing to a `.checkpoint.tmp.json` and then renaming would provide crash-safe persistence.

## Discovered during Tier 3 Items 3.5, 3.6, 3.7, 3.8 (2026-03-30)

### Gaps

1. **`--from-cache` does not validate cache freshness**: When `--from-cache` loads a `page-data.json` from a previous run, there is no check that the cached data matches the current target URL or that the site has not changed since the cache was written. Adding a URL and timestamp validation against the cached `PageData.url` and `PageData.extractedAt` fields would prevent stale data reuse.

2. **`--only-sections` matches by name are case-sensitive and exact**: The section name filter uses `Array.includes()` which requires an exact case-sensitive match. Users may not remember exact section names from extraction. A fuzzy or case-insensitive match (e.g., `hero` matching `HeroSection`) would improve usability.

3. **Dry-run animation detection still scrolls the page**: The `detectAnimations` call in dry-run mode performs scroll probing and hover probing, which mutates page state. If the user subsequently runs a full extraction without `--dry-run`, the page state may differ from a clean load. Consider using a fresh page context for dry-run or only running static analysis (CSS keyframes/transitions) in dry-run mode.

4. **`writePromptWithRetry` retry delay is fixed at 500ms**: The retry backoff in `builder-prompts.ts` uses a flat 500ms delay. For disk I/O errors caused by temporary filesystem pressure, an exponential backoff (500ms, 1000ms) would be more robust without adding significant complexity.

### Opportunities

1. **ProgressReporter could emit structured JSON events**: For CI/CD integration, ProgressReporter could optionally emit newline-delimited JSON events (`{"phase": "scan", "status": "complete", "durationMs": 450}`) when a `--json-progress` flag is passed. This would enable build systems to parse extraction progress programmatically.

2. **Dry-run could output a machine-readable summary**: The dry-run summary is currently human-readable console output. Adding a `--dry-run --json` mode that writes a `dry-run-summary.json` file would enable scripted workflows (e.g., estimating extraction cost before committing to a full run).

3. **Per-section re-extraction could merge into existing page-data.json**: Currently `--only-sections` generates a fresh `page-data.json` with only the filtered sections. Instead, it could merge re-extracted sections back into an existing `page-data.json`, preserving data for unmodified sections. This would enable incremental section updates without losing the full extraction context.

4. **Builder dispatch error recovery could track failure history**: When a builder fails and is retried, the failure reason and retry count could be appended to a `docs/research/prompts/build-log.json` file. This would provide a persistent record of which sections are problematic and why, enabling smarter dispatch strategies on subsequent runs.

## Discovered during Tier 4 Items 4.4, 4.5, 4.6 (2026-03-30)

### Gaps

1. **CSS scroll-timeline detection depends on browser support in Playwright's Chromium**: The `animation-timeline` CSS property may not be fully reflected in `getComputedStyle()` if the Playwright-bundled Chromium version lags behind the spec. Consider also scanning raw stylesheet text for `animation-timeline:` declarations as a fallback, similar to the keyframes rule scraper.

2. **Framer Motion gesture props are not observable from DOM inspection**: Framer Motion's `whileHover`, `whileTap`, `drag`, and `variants` props are React-internal and not serialized to the DOM. The current detection relies on `data-framer-*` attributes (Framer Sites) and `--framer-*` CSS variables, which only exist on Framer-published sites — not on custom React apps using framer-motion directly. A more robust approach would require intercepting the `motion` component factory at runtime.

3. **Hover tester selector deduplication is shallow**: The auto-detected selectors use `tag.class1.class2` format, which may not be unique on the page. Two different buttons with the same classes will produce the same selector, and `page.locator(selector).first()` will only test the first one. Consider appending `:nth-of-type(N)` or using a unique attribute (id, data-testid) when available.

4. **CSS scroll-timeline fallback in component-gen is minimal**: The generated `@supports` fallback only adds an `in-view` class via IntersectionObserver. It does not replicate the scroll-progress-linked animation behavior. For scroll() timelines (where animation progress tracks scroll position), the fallback should use a scroll event listener that sets a CSS custom property (e.g., `--scroll-progress`) proportional to the element's position.

### Opportunities

1. **Framer Motion variant extraction via React DevTools protocol**: If the page uses React, Playwright can connect to the React DevTools protocol via `page.evaluate` to walk the Fiber tree and extract `motion` component props (initial, animate, exit, variants, transition). This would capture the full animation specification without relying on DOM attributes.

2. **Hover test comparison between original and clone**: The current hover tester runs on a single page. A comparative mode could run hover tests on both the original URL and the clone URL, then diff the style changes to flag missing or incorrect hover effects. This would integrate naturally with the existing section comparison pipeline.

3. **CSS scroll-timeline keyframe extraction from stylesheet rules**: When `animation-timeline` is used, the associated `@keyframes` rule may use percentage-based stops that map to scroll progress rather than time. Annotating the extracted keyframes with a `scrollDriven: true` flag would help the code generator and builder prompts treat them differently (no duration needed, progress-linked).

4. **Hover test result visualization**: The hover tester captures before/after style diffs but not screenshots. Adding per-element screenshots (clipped to the element bounding box) before and after hover would enable visual diff reports, similar to the section comparison pipeline.

## Discovered during Tier 4 Items 4.1, 4.2, 4.3 (2026-03-30)

### Gaps

1. **Multi-page shared layout detection uses shallow fingerprinting**: `detectSharedLayout` matches sections across pages by name and normalized class name. Sites that render the same header/footer with different class names per page (e.g., CSS modules with page-specific hashes) will not be detected as shared. A content-hash-based comparison (comparing the first N characters of `outerHTML` after stripping dynamic attributes) would be more robust.

2. **Multi-page crawl does not follow JavaScript-rendered links**: `discoverPages` only collects `<a href>` elements present in the initial DOM. SPAs that render navigation links via client-side JavaScript after hydration will be missed. Consider waiting for network idle and re-querying links, or using Playwright's route interception to capture navigation requests.

3. **Batched scanner re-discovers sections for each batch**: `scanPageBatched` calls `discoverSections` once to get all handles, then processes them in batches. However, the underlying `extractSection` function still runs a full `page.evaluate` per section. For truly large pages (200+ sections), the overhead of individual evaluate calls becomes significant. A future optimization could pass multiple section indices into a single evaluate call per batch.

4. **Video scroll sync detection requires the scroll handler to be registered before monitoring begins**: The `addEventListener` wrapper for scroll events is injected via `addInitScript`, which runs before page scripts. However, if a scroll listener is added asynchronously (e.g., after a dynamic import), the `__drp_inScrollHandler` flag may not be set correctly because the original `addEventListener` reference was already captured before the wrapper was installed. The current implementation re-wraps `addEventListener` for video detection, but the earlier scroll listener tracker's wrap is still the one that fires for pre-existing listeners.

5. **Video scroll sync mapping type detection is approximate**: The linearity check uses a simple average ratio deviation threshold (0.15). Custom easing functions that are "mostly linear" (e.g., ease-in-out with small deviation) may be misclassified. Capturing more data points during the scroll probe and fitting a curve would improve accuracy.

### Opportunities

1. **Multi-page extraction could reuse browser context for fonts and stylesheets**: When extracting multiple pages from the same domain, font files and global stylesheets are likely identical. A domain-level deduplication pass after extraction could merge font and stylesheet data, reducing redundant downloads and output size.

2. **Route pattern detection could infer param names from content**: Currently all dynamic segments are named `[slug]`. Analyzing the page content (e.g., if the page contains a date, the param might be `[date]`; if it contains a category name, `[category]`) would produce more meaningful route patterns for Next.js code generation.

3. **Batched scanner could emit progress events**: For very large pages, the batch processing loop could emit structured progress events (batch number, sections processed, estimated remaining time) that integrate with the `ProgressReporter` utility, giving users real-time feedback during long scans.

4. **Video scroll sync data could inform section interaction model classification**: When a section contains a scroll-synced video, the section's `interactionModel` should be classified as `scroll-driven` even if no other scroll animations are detected. Currently the merge module classifies interaction models based on animation types, but video scroll syncs are just `scroll-listener` type animations and may not trigger the classification correctly.

5. **Multi-page shared layout could generate a Next.js layout.tsx**: When shared header/footer/sidebar sections are detected across multiple pages, the generation pipeline could automatically produce a `layout.tsx` file that renders these shared components, with `{children}` for page-specific content. This would eliminate duplication across generated page components.

---

## Tier 4 Items 4.7–4.10 Gaps & Opportunities

5. **Lottie animation data extraction from lottie-web instances (4.7)**: When `window.lottie` or `window.bodymovin` is detected but no `<lottie-player>` element exists, the engine flags it but cannot extract the animation JSON. A future improvement could intercept network requests for `.json` files during page load (via `page.route`) and auto-classify Lottie payloads by inspecting the JSON schema (`v`, `fr`, `ip`, `op`, `layers` keys).

6. **Template matching with extraction-data scoring (4.8)**: The current `matchTemplate` only uses section name and element count. Enriching the heuristic with actual element tag distribution (e.g., "has `<video>` child" boosts hero-with-video confidence, "has `<form>` child" boosts contact-form confidence) would improve match accuracy and reduce false-positive template assignments.

7. **Confidence score aggregation for full-page reporting (4.9)**: Individual section confidence scores are now available, but there is no page-level rollup. Adding a weighted average (by section height or element count) to `PageData` would give a single number for "extraction quality" that the CLI can gate on (e.g., refuse to generate if overall confidence < 70%).

8. **DOM comparator semantic-role awareness (4.10)**: The current tree diff is purely structural (tag + text). Extending it to compare ARIA roles and landmark elements (`nav`, `main`, `footer`, `aside`) would catch cases where the clone uses `<div>` where the original uses semantic HTML, which affects accessibility but not visual output.

9. **Lottie component code generation with actual asset paths (4.7)**: The Lottie hook in component-gen.ts currently emits a placeholder TODO for the animation JSON import. Once `LottieEntry.localPath` is populated, the generator could emit `import animationData from "../../public/animations/foo.json"` and pass it directly to the `<LottiePlayer>` component, eliminating the manual step.
