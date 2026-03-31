# Dr Parity Feature Roadmap

## Current State

- **26 engine files**, ~11,062 lines
- **Extraction**: `page-scanner`, `animation-detector`, `font-extractor`, `asset-collector`, `interaction-mapper`, `stylesheet-scraper`
- **Analysis**: `topology`, `design-tokens`, `component-tree`, `behavior-model`
- **Generation**: `foundation`, `component-gen`, `page-assembler`, `builder-prompts`
- **QA**: `screenshotter`, `pixel-diff`, `section-comparator`, `fix-loop`
- **CLI**: `extract.ts`, `qa.ts`, `qa-sections.ts`

---

## Priority Tiers

### Tier 1: Critical (Must-Have for 1:1 Parity)

Items that directly prevent achieving pixel-perfect, animation-accurate clones.

---

#### 1.1 Capture pseudo-elements (::before, ::after)

- **What**: Extract computed styles for `::before` and `::after` pseudo-elements and emit them as Tailwind `before:` / `after:` utilities or inline CSS.
- **Why**: ~30% of design intent lives in pseudo-elements (decorative lines, overlays, icons, gradients). Missing them breaks visual parity on nearly every site.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/analyze/design-tokens.ts`
- **Effort**: Medium
- **Impact**: +25-30% visual accuracy on decoration-heavy sites

---

#### 1.2 Capture CSS custom properties (var(--xxx)) instead of resolved values only

- **What**: Record both the custom property name and its resolved value during extraction. Emit CSS custom properties in the generated theme so the token system stays semantic.
- **Why**: Resolved values lose the design system's intent. Two elements sharing `var(--brand-blue)` become two unrelated hex values, breaking theming and dark mode.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/analyze/design-tokens.ts`, `engine/generate/foundation.ts`
- **Effort**: Medium
- **Impact**: +15-20% theme accuracy; enables dark mode parity

---

#### 1.3 GSAP ScrollTrigger pin/scrub configuration capture

- **What**: Detect GSAP ScrollTrigger instances and extract their `pin`, `scrub`, `start`, `end`, `snap`, and tween parameters from the runtime.
- **Why**: 70%+ of animation-heavy marketing sites use GSAP. Without pin/scrub data, scroll-driven sections collapse or float incorrectly.
- **Where**: `engine/extract/playwright/animation-detector.ts`
- **Effort**: High
- **Impact**: +40-50% animation accuracy on GSAP-heavy sites

---

#### 1.4 IntersectionObserver callback code capture

- **What**: Intercept `IntersectionObserver` instantiation, capture the callback logic (class toggles, style mutations, attribute changes), and map each to a concrete animation definition.
- **Why**: Currently only a generic `animate-in` class is emitted. The actual reveal animations (fade, slide, scale, stagger) are lost.
- **Where**: `engine/extract/playwright/animation-detector.ts`, `engine/analyze/behavior-model.ts`
- **Effort**: High
- **Impact**: +20-25% animation accuracy across all sites

---

#### 1.5 Font metrics generation (ascent-override, descent-override, size-adjust)

- **What**: After downloading fonts, compute `ascent-override`, `descent-override`, `line-gap-override`, and `size-adjust` CSS descriptors to match the target's text metrics.
- **Why**: Without these, text reflows during font swap causing Cumulative Layout Shift (CLS) and misaligned baselines. Typography parity is impossible without metric matching.
- **Where**: `engine/extract/playwright/font-extractor.ts`, `engine/generate/foundation.ts`
- **Effort**: Medium
- **Impact**: +10-15% layout accuracy; eliminates CLS from font loading

---

#### 1.6 Stagger timing capture between sibling elements

- **What**: Detect stagger patterns in animation sequences (GSAP stagger, CSS animation-delay arithmetic progressions, Framer Motion staggerChildren) and record the delta and direction.
- **Why**: Staggered reveals are the most common animation pattern on modern sites. Without stagger data, all siblings animate simultaneously, breaking the choreography.
- **Where**: `engine/extract/playwright/animation-detector.ts`
- **Effort**: Medium
- **Impact**: +15-20% animation accuracy

---

#### 1.7 Complex gradient mapping to Tailwind

- **What**: Parse multi-stop linear, radial, and conic gradients from computed styles and emit them as Tailwind arbitrary values or CSS custom properties.
- **Why**: Gradients are used heavily for backgrounds, overlays, and text effects. Current extraction either drops them or outputs broken shorthand.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/analyze/design-tokens.ts`
- **Effort**: Medium
- **Impact**: +10-15% visual accuracy on gradient-heavy designs

---

#### 1.8 Responsive images (srcset, sizes) and lazy-loaded images (data-src)

- **What**: Capture `srcset`, `sizes`, and `data-src` / `data-lazy` attributes. Download all resolution variants. Emit proper `<Image>` components with responsive props.
- **Why**: Without srcset, clones serve wrong-sized images. Without data-src capture, lazy-loaded hero images are simply missing.
- **Where**: `engine/extract/playwright/asset-collector.ts`, `engine/generate/component-gen.ts`
- **Effort**: Medium
- **Impact**: +10-15% visual accuracy; prevents missing images

---

### Tier 2: High Impact (Major Quality Improvement)

Items that significantly improve clone quality or developer experience.

---

#### 2.1 Lenis smooth scroll options capture

- **What**: Detect Lenis instances and extract configuration (lerp, duration, smoothWheel, orientation, wrapper/content selectors).
- **Why**: Bare-bones Lenis init produces different scroll feel than the target's tuned configuration. Scroll behavior is a defining characteristic of premium sites.
- **Where**: `engine/extract/playwright/animation-detector.ts`
- **Effort**: Low
- **Impact**: +5-10% feel accuracy on smooth-scroll sites

---

#### 2.2 CSS-in-JS extraction (styled-components, Emotion)

- **What**: Detect CSS-in-JS runtimes, iterate injected `<style>` sheets at extraction time, and merge their rules into the design token pipeline.
- **Why**: Sites using styled-components or Emotion inject all styles at runtime. The stylesheet scraper currently misses dynamically injected `<style>` tags.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`
- **Effort**: Medium
- **Impact**: +15-20% accuracy on CSS-in-JS sites (significant portion of React ecosystem)

---

#### 2.3 CSS Grid properties complete capture

- **What**: Capture `grid-template-columns`, `grid-template-rows`, `grid-template-areas`, `grid-auto-flow`, `gap`, and per-item `grid-column`/`grid-row` placement.
- **Why**: Incomplete grid capture causes layout collapse on sites using named grid areas or complex track sizing.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/generate/component-gen.ts`
- **Effort**: Medium
- **Impact**: +10-15% layout accuracy on grid-based sites

---

#### 2.4 Variable font axes capture

- **What**: Extract `font-variation-settings` and individual axis values (wght, wdth, slnt, ital, opsz, plus custom axes) from computed styles and @font-face descriptors.
- **Why**: Variable fonts with custom axis values produce distinct weight/width rendering. Using static fallback weights loses typographic nuance.
- **Where**: `engine/extract/playwright/font-extractor.ts`, `engine/generate/foundation.ts`
- **Effort**: Low
- **Impact**: +5-10% typography accuracy on variable-font sites

---

#### 2.5 Asset load verification before screenshots

- **What**: Before taking comparison screenshots, wait for all fonts to load (`document.fonts.ready`), images to decode (`img.decode()`), and critical CSS to apply.
- **Why**: Screenshots taken before assets load show FOUT/FOUC, producing false pixel-diff failures and masking real layout issues.
- **Where**: `engine/qa/screenshotter.ts`
- **Effort**: Low
- **Impact**: +20-30% QA accuracy (eliminates false positives from unloaded assets)

---

#### 2.6 Dynamic content masking in pixel diff

- **What**: Detect and mask regions with dynamic content (timestamps, counters, random testimonials, ads) before pixel comparison.
- **Why**: Dynamic regions cause persistent false failures, eroding trust in the QA pipeline and wasting fix-loop iterations.
- **Where**: `engine/qa/pixel-diff.ts`, `engine/qa/section-comparator.ts`
- **Effort**: Medium
- **Impact**: +15-20% QA reliability

---

#### 2.7 Specific fix suggestions (not vague "review diff")

- **What**: When pixel diff detects a mismatch, emit actionable fix instructions: "Change `padding-top` from `16px` to `24px` on `.hero-section`" instead of "review the diff."
- **Why**: Vague suggestions waste builder iterations. Specific CSS property + value suggestions let the fix loop converge in 1-2 passes instead of 4-5.
- **Where**: `engine/qa/fix-loop.ts`, `engine/qa/section-comparator.ts`
- **Effort**: High
- **Impact**: +30-40% fix-loop efficiency (fewer iterations to converge)

---

#### 2.8 SVG sprite handling (symbol + use)

- **What**: Detect `<svg><symbol>` sprite sheets and `<use href="#id">` references. Extract each symbol as a standalone React component.
- **Why**: SVG sprites are invisible to the current icon extraction. Sites using sprite sheets end up with blank icon slots.
- **Where**: `engine/extract/playwright/asset-collector.ts`, `engine/generate/component-gen.ts`
- **Effort**: Medium
- **Impact**: +5-10% visual accuracy on icon-heavy sites

---

#### 2.9 Container queries detection

- **What**: Detect `@container` rules and `container-type` / `container-name` properties. Emit Tailwind `@container` utilities.
- **Why**: Container queries are increasingly used for responsive components. Missing them causes components to render at wrong sizes inside flexible containers.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/generate/component-gen.ts`
- **Effort**: Low
- **Impact**: +5-10% layout accuracy on modern sites using container queries

---

#### 2.10 Modern color space parsing (oklch, hsl, lab, lch)

- **What**: Parse `oklch()`, `hsl()`, `lab()`, `lch()` color functions from stylesheets and preserve them (or convert accurately to Tailwind oklch tokens).
- **Why**: Modern sites increasingly use oklch for perceptually uniform gradients and palettes. Dropping to hex loses gamut and intent.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/analyze/design-tokens.ts`
- **Effort**: Low
- **Impact**: +5-8% color accuracy on sites using modern color spaces

---

### Tier 3: Speed & DX (Faster, Better Experience)

Items that make the tool faster and easier to use.

---

#### 3.1 Replace hardcoded 3s waits with smart waits

- **What**: Replace all `waitForTimeout(3000)` calls with event-driven waits: `networkidle`, `document.fonts.ready`, `MutationObserver` settling, and custom readiness checks.
- **Why**: Hardcoded waits waste 3-5s per page on fast sites and are still too short on slow sites. Smart waits are both faster and more reliable.
- **Where**: `engine/extract/playwright/page-scanner.ts`, `engine/qa/screenshotter.ts`
- **Effort**: Medium
- **Impact**: Saves 3-5s per extraction; eliminates timing-related extraction failures

---

#### 3.2 Parallel section screenshots (batch capture)

- **What**: Capture section screenshots in parallel batches instead of sequentially. Use `Promise.all` with concurrency limiting.
- **Why**: Sequential screenshots of 10-20 sections add 2-8s of unnecessary wall-clock time.
- **Where**: `engine/qa/screenshotter.ts`, `scripts/qa-sections.ts`
- **Effort**: Low
- **Impact**: Saves 2-8s per QA run

---

#### 3.3 Extraction caching (skip re-download on re-run)

- **What**: Cache extraction results keyed by URL + content hash. On re-run, skip network requests for unchanged resources.
- **Why**: Re-running extraction after a builder fix currently re-downloads everything from scratch, wasting 10-30s.
- **Where**: `scripts/extract.ts`, `engine/extract/merge.ts`
- **Effort**: Medium
- **Impact**: Saves 10-30s on re-extractions; enables rapid iteration

---

#### 3.4 Resumption from failure (checkpoint/restart)

- **What**: Save extraction state after each phase. On failure, resume from the last successful checkpoint instead of starting over.
- **Why**: A network timeout at the asset-download phase currently forces a full re-extraction. This is especially painful on large sites.
- **Where**: `scripts/extract.ts`, `engine/extract/merge.ts`
- **Effort**: Medium
- **Impact**: Eliminates 100% of wasted work on extraction failures

---

#### 3.5 Progress reporting with timing visibility

- **What**: Emit structured progress events with phase name, elapsed time, and ETA. Display a live progress bar in the CLI.
- **Why**: Users currently stare at a silent terminal for 30-60s with no feedback. Progress visibility builds confidence and helps diagnose hangs.
- **Where**: `scripts/extract.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`
- **Effort**: Low
- **Impact**: Major DX improvement; zero accuracy impact but critical for usability

---

#### 3.6 Dry-run mode

- **What**: Add a `--dry-run` flag that performs extraction and analysis but skips code generation. Output a report of what would be generated.
- **Why**: Lets users validate extraction quality before committing to a full generation pass. Useful for debugging extraction issues.
- **Where**: `scripts/extract.ts`
- **Effort**: Low
- **Impact**: DX improvement; faster debugging of extraction issues

---

#### 3.7 Per-section re-extraction

- **What**: Add a `--section <name>` flag to re-extract and re-generate a single section without touching the rest of the page.
- **Why**: Fixing one broken section currently requires a full re-extraction. Per-section targeting saves 80% of the time.
- **Where**: `scripts/extract.ts`, `engine/extract/merge.ts`, `engine/generate/page-assembler.ts`
- **Effort**: Medium
- **Impact**: Saves 80% of re-extraction time for single-section fixes

---

#### 3.8 Error recovery in builder dispatch

- **What**: Wrap builder prompt dispatch in retry logic with exponential backoff. Capture and surface builder errors instead of silently failing.
- **Why**: A transient LLM API error currently kills the entire generation pass with no recovery.
- **Where**: `engine/generate/builder-prompts.ts`
- **Effort**: Low
- **Impact**: Eliminates generation failures from transient errors

---

### Tier 4: Advanced Capabilities (Expand Scope)

Items that expand what Dr Parity can clone.

---

#### 4.1 Multi-page / web app support

- **What**: Accept multiple URLs or a sitemap. Extract shared layout (header, footer, nav) once, then extract per-page content. Generate a multi-route Next.js app.
- **Why**: Currently limited to single-page extraction. Most real targets are multi-page sites with shared chrome.
- **Where**: `scripts/extract.ts`, `engine/extract/playwright/page-scanner.ts`, `engine/generate/page-assembler.ts`, `engine/analyze/topology.ts`
- **Effort**: High
- **Impact**: Expands scope from single-page to full-site cloning

---

#### 4.2 Large site strategy (100+ sections)

- **What**: For pages with 100+ sections, implement section batching, priority-based extraction (above-fold first), and progressive generation.
- **Why**: Extremely long pages exhaust memory and context windows. Batching keeps extraction tractable.
- **Where**: `engine/extract/playwright/page-scanner.ts`, `engine/generate/page-assembler.ts`
- **Effort**: High
- **Impact**: Enables cloning of long-form landing pages and documentation sites

---

#### 4.3 Video scroll sync detection

- **What**: Detect scroll-synced video playback (currentTime tied to scrollY) and emit equivalent scroll-driven video components.
- **Why**: Apple-style scroll-driven video is a signature pattern on premium sites. Missing it loses the most impactful visual element.
- **Where**: `engine/extract/playwright/animation-detector.ts`, `engine/extract/playwright/interaction-mapper.ts`
- **Effort**: High
- **Impact**: +30-40% accuracy on scroll-video sites (niche but high-value)

---

#### 4.4 CSS scroll-driven animations (animation-timeline)

- **What**: Detect `animation-timeline: scroll()` and `view()` functions, `animation-range`, and `@keyframes` used with scroll timelines.
- **Why**: The new CSS scroll-driven animations spec is being adopted rapidly. Sites using it will have zero animation parity without detection.
- **Where**: `engine/extract/playwright/animation-detector.ts`, `engine/extract/playwright/stylesheet-scraper.ts`
- **Effort**: Medium
- **Impact**: Future-proofs animation extraction for the CSS spec direction

---

#### 4.5 Framer Motion gesture detection

- **What**: Detect Framer Motion `whileHover`, `whileTap`, `whileDrag`, `whileInView` props and their animation values from the React component tree.
- **Why**: Framer Motion is the dominant React animation library. Gesture-driven animations (hover scale, tap shrink) are core to interactive feel.
- **Where**: `engine/extract/playwright/animation-detector.ts`, `engine/extract/playwright/interaction-mapper.ts`
- **Effort**: High
- **Impact**: +15-20% interaction accuracy on Framer Motion sites

---

#### 4.6 Hover state testing in QA

- **What**: Programmatically hover over interactive elements, capture screenshots in hover state, and compare against target hover screenshots.
- **Why**: Hover states are a major part of visual design (color changes, transforms, shadows). Currently zero hover states are tested.
- **Where**: `engine/qa/screenshotter.ts`, `engine/qa/section-comparator.ts`
- **Effort**: Medium
- **Impact**: +10-15% QA coverage for interactive elements

---

#### 4.7 Lottie animation file capture

- **What**: Detect Lottie player instances, extract the JSON animation data URL, download it, and emit a `lottie-react` component.
- **Why**: Lottie animations are used for icons, loading states, and illustrations on many modern sites. Missing them leaves blank or static placeholders.
- **Where**: `engine/extract/playwright/asset-collector.ts`, `engine/generate/component-gen.ts`
- **Effort**: Medium
- **Impact**: +5-10% visual accuracy on Lottie-using sites

---

#### 4.8 Component templates for common patterns

- **What**: Maintain a library of pre-built component templates (hero sections, pricing tables, feature grids, testimonial carousels) that the builder can reference instead of generating from scratch.
- **Why**: Common patterns are re-extracted and re-generated from scratch every time. Templates provide a higher-quality starting point and reduce builder hallucination.
- **Where**: `engine/generate/component-gen.ts`, `engine/generate/builder-prompts.ts`
- **Effort**: High
- **Impact**: +10-15% generation quality; faster generation

---

#### 4.9 Confidence scoring on extraction

- **What**: Score each extracted property (0-1) based on extraction method reliability. Surface low-confidence extractions in the report so builders and users can prioritize manual review.
- **Why**: Not all extractions are equally reliable. Knowing which values are uncertain prevents blind trust in bad data.
- **Where**: `engine/extract/merge.ts`, `engine/types/extraction.ts`
- **Effort**: Medium
- **Impact**: Better builder decisions; reduced fix-loop iterations

---

#### 4.10 DOM structure comparison in QA

- **What**: Compare the generated DOM tree against the target's DOM structure. Flag structural mismatches (missing elements, wrong nesting, extra wrappers).
- **Why**: Pixel diff catches visual issues but misses structural problems that affect accessibility, SEO, and interaction behavior.
- **Where**: `engine/qa/section-comparator.ts`, `engine/qa/fix-loop.ts`
- **Effort**: Medium
- **Impact**: +10-15% structural accuracy; catches issues pixel diff misses

---

### Tier 5: Polish & Edge Cases

Nice-to-have improvements.

---

#### 5.1 @starting-style and View Transitions API support

- **What**: Detect `@starting-style` blocks and View Transitions API usage (`document.startViewTransition`, `view-transition-name`). Emit equivalent CSS/JS.
- **Why**: These are cutting-edge CSS features for entry animations and page transitions. Adoption is growing but still niche.
- **Where**: `engine/extract/playwright/animation-detector.ts`, `engine/extract/playwright/stylesheet-scraper.ts`
- **Effort**: Medium
- **Impact**: Future-proofing; +5% accuracy on bleeding-edge sites

---

#### 5.2 FontFace API loaded fonts detection

- **What**: Intercept `FontFace()` constructor calls and `document.fonts.add()` to capture programmatically loaded fonts invisible to stylesheet scanning.
- **Why**: Some sites load fonts purely via JavaScript. These fonts are invisible to CSS-based extraction.
- **Where**: `engine/extract/playwright/font-extractor.ts`
- **Effort**: Low
- **Impact**: +3-5% font accuracy on JS-heavy font loading sites

---

#### 5.3 Typekit/Adobe Fonts download handling

- **What**: Detect Typekit/Adobe Fonts usage, extract the project ID, and either download the font files or emit a Typekit embed snippet.
- **Why**: Typekit fonts are detected but not downloaded, leaving the clone with fallback system fonts.
- **Where**: `engine/extract/playwright/font-extractor.ts`
- **Effort**: Medium
- **Impact**: +5-8% typography accuracy on Adobe Fonts sites

---

#### 5.4 Custom cursor images capture

- **What**: Extract `cursor: url(...)` values and download the referenced cursor images.
- **Why**: Custom cursors are a design detail on creative/agency sites. Missing them is noticeable but not layout-breaking.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`, `engine/extract/playwright/asset-collector.ts`
- **Effort**: Low
- **Impact**: +1-2% polish on custom-cursor sites

---

#### 5.5 aspect-ratio and text-wrap: balance mapping

- **What**: Detect `aspect-ratio` and `text-wrap: balance` / `text-wrap: pretty` in computed styles and emit corresponding Tailwind utilities.
- **Why**: `aspect-ratio` affects media containers; `text-wrap: balance` affects heading appearance. Both are increasingly common.
- **Where**: `engine/extract/playwright/stylesheet-scraper.ts`
- **Effort**: Low
- **Impact**: +3-5% layout and typography accuracy

---

#### 5.6 Weighted pixel diff (above-fold prioritization)

- **What**: Weight pixel diff scores by vertical position: above-fold mismatches score higher than below-fold. Optionally weight by element importance (nav, hero > footer).
- **Why**: Not all pixel differences matter equally. A 2px mismatch in the hero is worse than a 10px mismatch in the footer.
- **Where**: `engine/qa/pixel-diff.ts`, `engine/qa/section-comparator.ts`
- **Effort**: Medium
- **Impact**: +10-15% QA prioritization accuracy

---

#### 5.7 Animation frame comparison

- **What**: Capture animation keyframes at defined intervals (0%, 25%, 50%, 75%, 100%) on both target and clone. Diff each frame.
- **Why**: Pixel diff only captures static state. Animations that start correctly but diverge mid-sequence go undetected.
- **Where**: `engine/qa/screenshotter.ts`, `engine/qa/pixel-diff.ts`
- **Effort**: High
- **Impact**: +10-15% animation QA coverage

---

#### 5.8 Interaction testing (click behavior verification)

- **What**: Replay recorded interactions (clicks, hovers, form inputs) on the clone and verify the resulting state matches the target.
- **Why**: Visual parity without behavioral parity is a hollow clone. Menus that don't open, modals that don't appear, tabs that don't switch.
- **Where**: `engine/qa/screenshotter.ts`, `engine/qa/section-comparator.ts`, `engine/extract/playwright/interaction-mapper.ts`
- **Effort**: High
- **Impact**: +15-20% behavioral accuracy; new QA dimension

---

#### 5.9 Section alignment verification

- **What**: Compare bounding box positions and dimensions of major sections between target and clone. Flag misalignments exceeding a threshold.
- **Why**: Pixel diff can miss systematic alignment shifts (everything shifted 8px right) because the diff is distributed across many pixels.
- **Where**: `engine/qa/section-comparator.ts`
- **Effort**: Medium
- **Impact**: +5-10% layout QA accuracy

---

## Summary

| Tier | Items | Estimated Effort | Combined Impact |
|------|-------|------------------|-----------------|
| **Tier 1: Critical** | 8 | 5 Medium, 3 High | +25-50% visual/animation accuracy |
| **Tier 2: High Impact** | 10 | 4 Low, 4 Medium, 2 High | +15-30% quality + QA reliability |
| **Tier 3: Speed & DX** | 8 | 4 Low, 4 Medium | 15-40s saved per run; major DX uplift |
| **Tier 4: Advanced** | 10 | 3 Medium, 5 High, 2 Medium | Expands scope; +10-20% niche accuracy |
| **Tier 5: Polish** | 9 | 3 Low, 4 Medium, 2 High | +5-15% polish and QA coverage |

**Recommended execution order**: Tier 1 items first (they block 1:1 parity), then Tier 2 and Tier 3 in parallel (quality + speed), then Tier 4 as scope demands, with Tier 5 items picked up opportunistically.
