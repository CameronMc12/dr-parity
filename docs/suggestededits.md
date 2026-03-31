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

