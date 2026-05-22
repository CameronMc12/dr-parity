---
name: clone-website
description: Reverse-engineer and clone one or more websites as pixel-perfect, animation-accurate 1:1 replicas using Dr Parity's automated Playwright CLI extraction pipeline. Every computed style, every animation, every font, every asset is captured and replicated. Use this whenever the user wants to clone, replicate, rebuild, reverse-engineer, or copy any website. Also triggers on phrases like "make a copy of this site", "rebuild this page", "pixel-perfect clone". Provide one or more target URLs as arguments.
argument-hint: "<url1> [<url2> ...] [optional instructions in quotes]"
user-invocable: true
---

# Dr Parity. Clone Website

You are about to reverse-engineer and rebuild **$ARGUMENTS** as a pixel-perfect, animation-accurate 1:1 clone.

Dr Parity uses a multi-phase automated pipeline backed by Playwright CLI extraction. Every computed style, every animation, every font, every asset is captured and replicated. The automated extraction captures the vast majority of what exists on the page. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run for anomalies and supplements the capture if the tour misses something subjective such as scroll feel or canvas content. No browser MCP is used.

When multiple URLs are provided, process them independently and in parallel where possible, isolating each site's artifacts in dedicated folders (e.g., `docs/research/<hostname>/`).

---

## Phase 0: Pre-Flight

Before anything else, establish the working environment.

### 0.1 Parse Arguments

Extract URL(s) and any user instructions from `$ARGUMENTS`. Normalize and validate each URL. If any are invalid, ask the user to correct them before proceeding. If the user provided additional instructions (fidelity level, customizations, specific pages), note them for use throughout the pipeline.

### 0.2 Verify Playwright CLI

Dr Parity uses the Playwright CLI exclusively. No browser MCP is used. Confirm Playwright and Chromium are installed (see step 0.5 below). Claude observes the live Playwright run during capture and notes any anomalies as they appear.

### 0.3 Verify Engine Compilation

Run `npm run typecheck` to confirm the engine compiles. If it fails, fix the TypeScript errors before continuing.

### 0.4 Create Output Directories

```bash
mkdir -p docs/research docs/design-references docs/animations public/fonts public/images public/videos public/seo
```

For multiple sites, also create per-site folders: `docs/research/<hostname>/`, `docs/design-references/<hostname>/`.

### 0.5 Verify Playwright

```bash
npx playwright --version
```

If Playwright is not installed or Chromium is missing:

```bash
npx playwright install chromium
```

---

## Phase 1: Automated Extraction

This phase runs the automated Playwright pipeline to capture every detail of the target site. It is the foundation of everything that follows.

### 1.1 Run the Automated Extraction Script

```bash
npx tsx scripts/extract.ts <url> --output docs/research
```

This single command executes the entire extraction pipeline:

**Animation Monitor Injection (BEFORE page navigation)**
The script calls `injectAnimationMonitors(page)` before `page.goto()`. This shims `IntersectionObserver`, `Element.prototype.animate`, and scroll event listeners so that all runtime animation triggers are intercepted the moment the page's own JavaScript runs. This is critical -- if you navigate first and inject after, you miss every animation registered during page initialization.

**Page Scan (`scanPage`)**
Full DOM walk that captures ALL non-default computed styles on every visible element. For each element, it diffs `getComputedStyle()` against browser defaults for that tag, keeping only the properties that differ. This is how we get exact values, not approximations. The scan also detects sections (via `<section>` elements, `<main>` children, ARIA landmarks, or body children as fallback), identifies media (images, videos, SVGs, canvas, iframes, background images), and extracts text content verbatim.

**Animation Detection (`detectAnimations`) -- Three Layers**
1. **Static analysis:** Parses all stylesheets for `@keyframes` rules, `transition` properties, and `animation` properties. Captures keyframe definitions, durations, easings, and delays.
2. **Runtime monitoring:** Reads back the data collected by the injected shims -- every `IntersectionObserver` callback registration, every `Element.animate()` call, every scroll listener. Each is mapped to its target element via CSS selector.
3. **Active probing:** Scrolls the page from top to bottom in increments, capturing style diffs at each position to detect scroll-driven animations. Hovers over elements with `transition` properties to capture hover state before/after values.

The result includes the animation type (`css-transition`, `css-animation`, `intersection-observer`, `gsap`, `lenis`, `framer-motion`, etc.), the trigger (scroll position, intersection threshold, hover, click, load), the animated properties with from/to values, duration, easing, delay, iteration count, direction, fill mode, keyframes, and the library driving it.

**Font Extraction (`extractFonts`)**
Detects `@font-face` rules from all stylesheets (including cross-origin sheets fetched from within the page context), Google Fonts `<link>` tags, and Typekit/Adobe Fonts scripts. Google Fonts CSS is re-fetched with a WOFF2-compatible User-Agent to get WOFF2 URLs instead of TTF. All font files are downloaded to `public/fonts/`. Variable fonts are detected via `font-variation-settings`. Font usage is mapped to DOM elements (which selectors use which family/weight).

**Asset Collection (`collectAssets`)**
Discovers ALL images, videos, inline SVGs, favicons, and OG images in one `page.evaluate()` call. Downloads them in parallel batches (concurrency 4) to `public/images/`, `public/videos/`, `public/seo/`. Inline SVGs are deduplicated by content hash and auto-named by DOM context (parent link, aria-label, nearby heading). Each asset entry tracks original URL, local path, filename, MIME type, file size, and dimensions.

**Interaction Mapping (`mapInteractions`)**
Three responsibilities:
1. Clicks every detected tab, pill, toggle, and accordion trigger, recording the content and styles for each state.
2. Scrolls the page and diffs fixed/sticky element styles at each position to capture scroll-dependent behaviors.
3. Resizes the viewport to test breakpoints (1440px, 768px, 390px by default) and captures layout changes at each width.

**Merge (`mergeExtractionData`)**
Combines all extraction outputs into a unified `PageData` JSON. Sections from the page scan are enriched with animations (matched by element selector), interaction models (classified from the interaction mapper), and responsive breakpoints. Global behaviors (smooth scroll, scroll snap, custom cursor, preloader) are built from detected libraries. The complete result is saved to `docs/research/page-data.json`.

### 1.2 Live Capture Observation

Dr Parity runs inside Claude Code, so Claude observes the live Playwright capture output as it runs. After the capture completes, review the per viewport screenshot saved to `docs/research/captures/<host>/<timestamp>/<viewport>/screenshot.png` and walk the page mentally section by section, watching for items the static capture may have under recorded.

1. Open the captured screenshots and confirm the page rendered as expected at each viewport.
2. Section by section, note anything the tour may have missed:
   - Animations that depend on interactions the tour did not exercise (WebGL, canvas, complex GSAP timelines, Lottie, SVG morphing).
   - Hover states on elements that look interactive but were not caught by the hover probe.
   - Loading states, skeleton screens, or delayed content that only appears after a pause.
   - Smooth scroll library presence (Lenis or Locomotive) versus native scroll.
   - Parallax effects where background layers move at different scroll rates.
   - Text reveal animations where characters or words animate individually.
   - Micro interactions on buttons, inputs, and links beyond simple color changes.
   - Page transitions or FLIP animations.
3. Save anomaly notes to `docs/research/CAPTURE_NOTES.md` so the builder phase can compensate.

### 1.3 Validate Extraction Output

Read `docs/research/page-data.json` and verify:

- **Sections.** All visible sections were captured. If any section is missing, note it.
- **Fonts.** Font files exist in `public/fonts/`. Check `pageData.fonts` for families, weights, and downloaded file paths.
- **Assets.** Images exist in `public/images/`, videos in `public/videos/`. Check `pageData.assets` for completeness.
- **Animations.** The `animations` array in each section is populated. Cross reference against what you observed during the live capture.
- **Text content.** Spot check a few sections to confirm `textContent` matches what the page displays.

If anything is missing or incomplete, re-run the relevant extraction step or manually supplement `page-data.json`.

---

## Phase 2: Analysis

Run the analysis pipeline on the extracted data. This is pure data transformation -- no browser interaction required.

### 2.1 Build Topology

Using the logic from `engine/analyze/topology.ts` (`buildTopology`):

- Sort sections by vertical position (top of bounding rect).
- Separate flow sections (static, relative, absolute) from overlay sections (fixed, sticky).
- Classify each section's background: light, dark, image, video, or gradient.
- Detect transitions between adjacent sections.
- Identify the scroll container (window or custom).
- Detect scroll-snap and smooth-scroll behaviors.
- Identify the smooth scroll library if present (Lenis, Locomotive, custom).

Output: A `TopologyMap` with ordered sections, overlays, scroll container info.

### 2.2 Extract Design Tokens

Using the logic from `engine/analyze/design-tokens.ts` (`extractDesignTokens`):

- Flatten all elements across all sections.
- Deduplicate colors and build a semantic palette (primary, secondary, background, foreground, muted, accent, border) plus the full color list.
- Extract the typography scale: font families (sans, mono, serif), sizes with line heights, weights used.
- Extract the spacing scale: deduplicated ascending values, detected base unit (4px or 8px).
- Extract border-radius values with frequency counts.
- Extract box-shadow values.
- Collect breakpoint widths from responsive data.
- Generate CSS custom properties ready for `globals.css`.

Output: A `DesignTokens` object with colors, typography, spacing, borderRadius, shadows, fonts, breakpoints, and cssVariables.

### 2.3 Build Component Tree

Using the logic from `engine/analyze/component-tree.ts` (`buildComponentTree`):

- Map each section to a `ComponentNode` with a PascalCase name, target file path, and spec.
- Detect shared components (patterns that repeat across multiple sections).
- Determine client vs server component split: any section with animations, scroll triggers, click handlers, hover effects, or browser API usage becomes a client component (`"use client"`).
- Generate import specs for each component's dependencies.
- Wire shared component dependencies into section nodes.

Output: A `ComponentTree` with root Page node, section children, and shared components.

### 2.4 Analyze Behaviors

Using the logic from `engine/analyze/behavior-model.ts` (`analyzeBehaviors`):

- For each section, collect all animations (section-level + element-level).
- Classify interaction model: static, scroll-driven, click-driven, hover-driven, time-driven, or hybrid.
- Extract scroll triggers with element selectors, trigger positions, and actions.
- Extract click handlers with action types (tab-switch, modal-open, accordion-toggle, navigation).
- Extract hover effects with style changes and transitions.
- Detect required npm libraries (GSAP, Lenis, Framer Motion, etc.) with the specific reason each is needed.
- Classify global scroll behavior: native, lenis, locomotive, or custom.

Output: A `BehaviorModel` with per-section behaviors, required libraries, and global scroll behavior.

### 2.5 Save Analysis and Install Dependencies

Save the combined analysis output to `docs/research/analysis.json`.

If the behavior model identifies required npm packages, install them now:

```bash
npm install <package1> <package2> ...
```

Common packages detected: `gsap`, `@studio-freight/lenis` (or `lenis`), `framer-motion`, `lottie-react`, `locomotive-scroll`.

---

## Phase 3: Generation

Build the clone from the analyzed specs. This is where code is written.

### 3.1 Foundation (Sequential -- Do This First)

Generate the foundation files before any component work. These are project-wide and everything depends on them.

**globals.css**
- Tailwind v4 imports (`@import "tailwindcss"`, `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`)
- `@custom-variant dark (&:is(.dark *))` for dark mode
- `@theme inline` block with font family variables, color tokens mapped to shadcn names
- `:root` and `.dark` blocks with ALL extracted CSS custom properties (colors, spacing, typography)
- Extracted `@keyframes` definitions (every keyframe rule from the target site's stylesheets)
- Smooth scroll CSS (`html { scroll-behavior: smooth }` or Lenis-specific styles)
- Global utility classes found on the target site
- Scroll-snap configuration if detected
- Custom scrollbar styles if the target hides or customizes scrollbars

**layout.tsx**
- Font loading via `next/font/local` (for downloaded font files in `public/fonts/`) or `next/font/google` (as fallback if font files couldn't be obtained)
- Font variables applied to `<html>` or `<body>` className
- Metadata: title, description, favicons, OG images (from downloaded assets in `public/seo/`)
- Proper `<html>` and `<body>` attributes

**icons.tsx**
- Every extracted inline SVG as a named React component
- PascalCase naming based on DOM context (aria-label, parent link, nearby heading)
- Each component accepts `className` prop and forwards `...props`
- `viewBox` preserved from original SVG

Write these files directly. Then verify:

```bash
npm run build
```

Fix any errors before proceeding.

### 3.2 Components (Parallel -- Dispatch Builder Agents)

Builder prompts are auto-generated during extraction. Each prompt file in `docs/research/prompts/` contains the COMPLETE raw extraction data for one section -- no summarization needed.

For each section, dispatch a builder agent with:
```
Read docs/research/prompts/section-{id}-{name}.md and build the component exactly as specified.
The prompt contains the exact HTML structure, computed styles, animations, and assets.
Translate HTML to JSX, use exact style values, implement all animations.
Target file: src/components/{ComponentName}.tsx
Verify: npx tsc --noEmit
```

**CRITICAL: Do NOT summarize or paraphrase the extraction data.** Pass the raw prompt file contents directly to each builder agent. The prompt files contain exact computed style values (fontSize: "45.7636px", not "about 46px"), exact animation triggers, and the actual DOM structure. Builders translate data to code -- they don't interpret descriptions.

**Builder Instructions (CRITICAL -- every builder MUST follow these):**

- Use EXACT computed style values from the prompt file. Not "it looks like text-lg" but `text-[18px] leading-[24px]` if the exact values don't match a Tailwind utility. Use arbitrary values (`[value]`) whenever no exact utility match exists.
- Implement ALL animations with correct triggers, durations, and easings. A static clone of an animated site is NOT a 1:1 clone.
- Use real text content verbatim from the prompt file. Not placeholder or paraphrased text.
- Use downloaded assets with local paths (`/images/hero-bg.webp`, not `https://example.com/hero.webp`).
- Handle responsive behavior at ALL extracted breakpoints listed in the prompt file.
- Add `"use client"` directive if the component has any interactivity (animations, scroll listeners, click handlers, hover effects beyond CSS hover, useState, useEffect, useRef).
- Respect `prefers-reduced-motion` for all animations.
- Verify `npx tsc --noEmit` passes before finishing.

**Dispatch Strategy:**

| Section Complexity | Strategy |
|---|---|
| Simple (static, 1-2 sub-components) | 1 builder agent for the entire section |
| Medium (3-4 sub-components, some states) | 1 builder per major sub-component + 1 for wrapper |
| Complex (5+ sub-components, multiple states, intricate animations) | Break into focused sub-component builders, then wrapper builder |

- Independent sections: dispatch in PARALLEL for speed.
- Dependent sections (wrapper needs sub-components): dispatch sub-components first, then wrapper after they complete.
- Each builder works in a worktree branch to avoid conflicts.

**Complexity Budget Rule:** If a builder prompt file exceeds ~150 lines of spec content, the section is too complex for one agent. Break it into smaller pieces.

**After builders complete:** Merge completed worktree branches, resolving conflicts intelligently since you have full context on what each builder produced and what the intended outcome is.

**Builder Error Recovery:**
- If a builder agent fails TypeScript check (`npx tsc --noEmit` errors):
  1. Read the error messages
  2. Re-dispatch with: "Fix these TypeScript errors in {file}: {errors}"
  3. Max 2 retries per builder
  4. If still broken after retries, split the component into smaller sub-components
- If a builder times out or produces empty output:
  1. Check if the prompt file is valid: `cat docs/research/prompts/{section}.md | head -20`
  2. Re-dispatch with a simpler prompt (reduce to essential styles only)
- After each successful builder, verify: `npx tsc --noEmit`

### 3.3 Page Assembly (After All Components Are Built)

After all components are built and merged, assemble the page:

1. Generate `src/app/page.tsx` importing all section components in topology order.
2. Render overlay components (fixed header, sticky elements) outside `<main>`, flow sections inside `<main>`.
3. Add page-level behaviors:
   - Scroll container setup (Lenis initialization if detected)
   - Scroll-snap configuration
   - Page-level IntersectionObserver setups
   - Any global animation orchestration
4. If Lenis or another scroll library is used, the page needs `"use client"` directive and the library initialization in a `useEffect`.

Verify:

```bash
npm run build
```

Fix any errors before proceeding to QA.

---

## Phase 4: Visual QA & Iteration

This phase pushes the clone from 90% to 98%+. Never skip it.

### 4.1 Automated Pixel Comparison

Start the dev server and run the QA script:

```bash
# Start dev server in background
npm run dev &
DEV_PID=$!

# Wait for server to be ready
sleep 5

# Run pixel-diff QA
npx tsx scripts/qa.ts <original-url> --clone-url http://localhost:3000 --threshold 5

# Stop dev server
kill $DEV_PID
```

This captures screenshots of both the original and clone at 3 viewports (1440px desktop, 768px tablet, 390px mobile) and runs pixelmatch to quantify visual differences. Results are saved to `docs/design-references/qa/qa-report.json`.

### 4.2 Review QA Report

Read `docs/design-references/qa/qa-report.json`. For each viewport:

| Match % | Action |
|---|---|
| >= 95% | PASS -- move on to the next viewport |
| 90-95% | Review diff images, fix the most visible discrepancies |
| < 90% | Serious issues -- identify the sections with highest pixel difference from the diff images |

The diff images (saved alongside the report) highlight exactly where the differences are in red. Use these to identify which components need fixes.

### 4.3 Visual Side by Side with the Playwright CLI

Open BOTH the original site and `http://localhost:3000` in two browser tabs (or run a side by side Playwright capture against both URLs). Compare section by section. Claude observes the live runs and notes discrepancies.

1. Scroll through both simultaneously. At each section, compare:
   - Colors. Do backgrounds, text, and accent colors match?
   - Spacing. Are paddings, margins, and gaps identical?
   - Typography. Do font sizes, weights, and line heights match?
   - Layout. Is the grid or flex structure the same?
   - Animation timing. Do animations trigger at the same scroll positions, with the same duration and easing?

2. For each discrepancy found:
   - Color mismatch? Check the CSS variable value against the extraction data.
   - Spacing issue? Check the computed padding and margin values.
   - Font issue? Verify the font files loaded correctly in DevTools.
   - Animation timing issue? Compare trigger thresholds and durations.
   - Was the extraction spec wrong? Re-capture against the original and fix the component.
   - Was the spec right but the builder got it wrong? Dispatch a targeted fix agent.

3. Test ALL interactive behaviors:
   - Scroll through: do animations trigger at the right positions?
   - Click every tab/button: does content switch correctly?
   - Hover interactive elements: do hover states match?
   - Test at mobile width: does responsive layout work?
   - Test smooth scroll feel: does it match the original (Lenis, native)?

### 4.4 Fix Iteration

For each discrepancy, dispatch a targeted fix agent with:
- The specific component file to fix
- The exact issue (e.g., "heading fontSize should be 58px not 48px", "hover opacity should transition over 200ms not 150ms")
- The diff image showing the discrepancy (if from pixel-diff)
- The reference screenshot from the original

After fixes are applied, re-run the QA comparison:

```bash
npx tsx scripts/qa.ts <original-url> --clone-url http://localhost:3000 --threshold 5
```

Repeat until all viewports pass the threshold or a maximum of 3 iterations. The fix loop module (`engine/qa/fix-loop.ts`) is designed for exactly this -- it produces `FixSuggestion` objects with the component file, priority, issue description, and suggested code change.

---

## Phase 5: Animation Documentation

Generate educational documentation for every animation detected on the site. This goes in `docs/animations/ANIMATIONS.md`.

```markdown
# Animations Detected on [site name]

## Summary
- Total animations: X
- CSS Transitions: X
- CSS Animations: X
- Scroll-driven: X
- Intersection Observer: X
- Library-based: X (breakdown: GSAP X, Lenis X, Framer Motion X, etc.)

## Animation Catalog

### 1. [Human-readable description]
- **Type:** [css-transition | css-animation | intersection-observer | gsap | lenis | framer-motion | etc.]
- **Trigger:** [scroll into view at 20% threshold | hover | page load at 0ms delay | scroll position 500px | etc.]
- **Element:** [CSS selector]
- **Properties animated:** [e.g., opacity 0 -> 1, transform translateY(30px) -> translateY(0)]
- **Duration:** [e.g., 600ms]
- **Easing:** [e.g., cubic-bezier(0.16, 1, 0.3, 1)]
- **Delay:** [e.g., 0ms, or stagger: 100ms per item]
- **Iterations:** [1 | infinite]
- **Fill mode:** [forwards | both | none]
- **Implementation:**
  ```tsx
  // Code snippet showing how to recreate this animation
  ```
```

Build this from the `AnimationSpec` data in `page-data.json`. Each spec includes `humanDescription`, `implementationNotes`, and optionally `codeSnippet` -- use all three to produce clear documentation.

---

## Guiding Principles

### 1. CAPTURE EVERYTHING -- Leave Nothing Behind

Every pixel, every animation, every font weight, every hover state, every responsive breakpoint. The automated extraction captures computed styles for every visible element, all animation mechanisms, all font files, all assets. Claude observes the live Playwright run to catch what static automation cannot: the subjective feel of scroll, canvas and WebGL content, and edge cases.

### 2. EXACT Values, Not Approximations

The extraction pipeline diffs `getComputedStyle()` against browser defaults, keeping only non-default properties with their exact values. When mapping to Tailwind, use arbitrary values (`text-[18px] leading-[24px]`) if no exact utility match exists. "It looks like text-lg" is WRONG if the computed value differs from what `text-lg` resolves to.

### 3. Real Content, Real Assets, Real Fonts

- **Text:** Verbatim from `element.textContent`, not paraphrased or replaced with placeholder.
- **Images/Videos:** Downloaded to `public/`, referenced by local path. Never link to the original domain.
- **Fonts:** Actual font files downloaded to `public/fonts/` and loaded via `next/font/local`. Fall back to `next/font/google` only if the original font files cannot be obtained.
- **SVGs:** Extracted as React components in `icons.tsx`, not replaced with Lucide or other icon library equivalents.

### 4. Animations Are Not Optional

A static clone of an animated site is NOT a 1:1 clone. The animation detector captures four dimensions for every animation:
- **What** animates: which element, which CSS properties, from/to values
- **When** it animates: scroll position, viewport intersection, hover, click, page load
- **How** it animates: duration, easing, keyframes, iteration count, direction
- **Why** it animates: the library/mechanism driving it (CSS transition, IntersectionObserver, GSAP, etc.)

All four must be replicated in the generated code. Every animation in the extraction data must appear in the built clone.

### 5. The QA Loop Is Mandatory

Never declare a clone complete without running the pixel-diff comparison. The human eye misses subtle differences in spacing, color values, and font rendering. pixelmatch does not. Run the QA, fix what it finds, run it again. The threshold is 95% match per viewport.

### 6. Responsive Is Not Optional

Every section must work at desktop (1440px), tablet (768px), and mobile (390px). The interaction mapper tests all three viewports and captures layout changes. The builders must implement every responsive breakpoint.

### 7. Small Tasks, Perfect Results

A builder with a focused task (one component, exact spec) produces pixel-perfect results. A builder with a massive scope (entire complex section) approximates. When a builder prompt exceeds ~150 lines of spec content, break the section into smaller sub-component tasks.

### 8. Build Must Always Compile

After every merge, after every fix, run `npm run build`. A broken build is never acceptable, even temporarily.

---

## What NOT to Do

- **Don't skip the automated extraction and go straight to manual inspection.** The Playwright capture pipeline records far more data (every computed style on every element) than manual inspection. Live observation supplements automation. It does not replace it.
- **Don't approximate CSS values.** Use exact computed style values from the extraction. Arbitrary Tailwind values (`[18px]`) are correct when no exact utility exists.
- **Don't use placeholder text or stock images.** Use real extracted content and downloaded assets.
- **Don't skip animations.** Every `AnimationSpec` in the extraction data must be implemented in the clone.
- **Don't skip the QA comparison.** Run `scripts/qa.ts` and fix what it finds.
- **Don't skip responsive testing.** Test at all 3 viewports.
- **Don't bundle too much work into one builder agent.** Keep tasks focused and under ~150 lines of spec.
- **Don't ignore the extraction summary.** `page-data.json` contains critical metadata about the page structure.
- **Don't replace extracted fonts with Google Font alternatives** unless the font files genuinely cannot be obtained.
- **Don't declare done until the QA report passes** at >= 95% match per viewport.
- **Don't build click-based tabs when the original is scroll-driven (or vice versa).** The extraction captures the interaction model for each section. Respect it.
- **Don't miss overlay/layered images.** The asset collector discovers background images and positioned overlays. Check the `media` field on elements.
- **Don't reference docs from builder prompts.** Each builder gets its full spec inline. Zero external file reads.
- **Don't build without verifying compilation.** Every builder runs `npx tsc --noEmit`. Every merge runs `npm run build`.

---

## Scope Defaults

Unless the user specifies otherwise:

- **Fidelity level:** Pixel-perfect -- exact match in colors, spacing, typography, animations
- **In scope:** Visual layout, component structure, interactions, responsive design, all animations, real content and assets
- **Out of scope:** Real backend/database, authentication, real-time features, SEO audit, accessibility audit
- **Customization:** None -- pure emulation

If the user provides additional instructions, honor those over the defaults.

---

## Completion Report

When finished, report:

- Total sections built
- Total components created (with client vs server breakdown)
- Total animations implemented (with type breakdown: CSS transitions, CSS animations, scroll-driven, intersection-observer, library-based)
- Total assets downloaded (images, videos, SVGs, fonts -- with file counts and total size)
- Total lines of generated code
- QA scores per viewport (desktop %, tablet %, mobile %)
- Overall pixel match percentage
- Any known limitations or gaps
- Link to animation documentation: `docs/animations/ANIMATIONS.md`
- Build status: `npm run build` result
