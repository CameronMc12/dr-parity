# Brand Design System Extraction Spec

The exact spec of what to extract from a cloned site to build a high-parity, Claude-ready brand design system. Organised by capture priority — what hits hardest for design fidelity first.

## 1. Color tokens (the #1 fidelity driver)

**What to capture:**
- Every unique color used across the site, normalized to a single format (recommend oklch for output, but capture raw hex/rgb/hsl too)
- Frequency count per color (helps separate brand colors from accidents)
- Where each color appears (selectors + contexts: backgrounds, text, borders, shadows)

**How to extract from a Playwright clone:**
- Parse all CSS files + inline styles. Walk computed styles via `getComputedStyle` on every visible element for: `color`, `background-color`, `border-color`, `outline-color`, `fill`, `stroke`, `box-shadow` (extract color portion), `text-decoration-color`, `caret-color`, `accent-color`, gradient stops (regex `linear-gradient`, `radial-gradient`, `conic-gradient`)
- Bucket by usage frequency + role
- Detect CSS custom properties already defined (`--primary`, `--brand-blue` etc.) — these are gold, the brand has already named them

**Final tokens:**
- `primary`, `secondary`, `accent` (1–3)
- Neutrals: full ramp (50–950, or whatever ramp count the site uses — detect by clustering lightness)
- Semantic: `success`, `warning`, `error`, `info`
- Surface tones: `bg`, `bg-subtle`, `bg-elevated`, `border`, `border-strong`
- Text: `fg`, `fg-muted`, `fg-subtle`, `fg-inverse`
- Special: `link`, `link-hover`, focus ring, selection bg

**Output format Claude can consume:** CSS custom properties + a JSON twin (Claude prefers reading the JSON to reason about, the CSS to copy-paste).

## 2. Typography

**What to capture:**
- Every `font-family` in use (and the `@font-face` declarations — download the actual font files, don't just reference)
- Full type scale: pull every unique combination of `font-size`, `font-weight`, `line-height`, `letter-spacing`, `font-family` actually rendered
- Classify each combination by element role: h1–h6, body, body-small, caption, eyebrow, button, label, code

**How to extract:**
- Walk DOM, grouping by semantic tag and class. For each tag, record the computed type props
- Cluster near-duplicates (e.g., 15.5px and 16px are the same token)
- Note font loading strategy (`font-display`, preloads)

**Final tokens:**
- Font stacks: `--font-sans`, `--font-serif`, `--font-mono`, `--font-display`
- Scale: t-shirt sizes (xs, sm, base, lg, xl, 2xl…) OR numeric (12, 14, 16, 18, 20, 24, 32…) — match what the site uses
- Weights actually used (don't include weights the brand doesn't use)
- Line heights as a small set: tight, normal, relaxed
- Letter spacing tokens

**Critical:** capture font files (.woff2) into the design system and rewrite `@font-face` to point to local paths.

## 3. Spacing & layout

**What to capture:**
- Padding, margin, gap values across all elements
- Cluster into a scale (typically the brand uses a 4px or 8px base with multipliers)
- Container widths / max-widths in use
- Grid column counts and gutter widths
- Breakpoints (extract from media queries)

**Final tokens:**
- Spacing scale: 0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32 (in base-unit multiples)
- Container sizes: sm, md, lg, xl, 2xl, prose
- Breakpoints: sm, md, lg, xl, 2xl
- Section padding rhythm (vertical pacing between sections)

## 4. Radii, borders, shadows, effects

**What to capture:**
- All `border-radius` values (cluster: sharp, sm, md, lg, xl, full/pill)
- All `border-width` + `border-style` combos
- All `box-shadow` values — these are highly brand-specific; capture verbatim, name by elevation (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-inner`)
- Filter effects: blurs, backdrop-filters
- Opacity values used at fixed levels

## 5. Motion

**What to capture:**
- All `transition` and `animation` declarations
- Duration values (cluster: fast 150ms, base 250ms, slow 400ms…)
- Easing curves used (especially custom cubic-beziers — these are brand DNA)
- Any keyframe animations defined

**Final tokens:**
- `--ease-out`, `--ease-in`, `--ease-in-out`, `--ease-bounce`, plus any custom curves
- Duration scale
- A few common animation primitives (fade-in, slide-up, etc.) the site uses

## 6. Iconography

**What to capture:**
- All inline SVGs (dedupe by viewBox + path hash)
- All icon font usages (font-awesome, material, custom)
- Image-based icons (favicons, logos in nav)
- Stroke widths, corner styles (rounded vs sharp), fill vs outline conventions
- Standard icon sizes (16, 20, 24, 32?)

**Output:** A folder of SVG files, each named by inferred purpose (`icon-arrow-right.svg`), plus a manifest JSON with stroke/fill conventions.

## 7. Logo & brand marks

- Primary logo (wordmark + symbol versions, light + dark variants)
- Favicon set
- App icons / OG images
- Clear-space rules — infer from how much padding around the logo in the nav
- Logo color treatments observed

## 8. Components (the meaty part)

For each, capture the actual rendered HTML + computed styles + states (hover, focus, active, disabled):
- Buttons: primary, secondary, ghost, destructive — sizes sm/md/lg, icon variants
- Forms: inputs, textareas, selects, checkboxes, radios, switches — including focus rings, error states, label patterns
- Cards: layout, padding, header/body/footer rhythm
- Navigation: top nav, mobile nav, footer
- Badges/chips/tags
- Modals/dialogs
- Tooltips/popovers
- Tables
- Alerts/banners
- Pagination/breadcrumbs

**How to extract reliably:** Use Playwright to enumerate elements matching common selectors (`button`, `a.btn`, `[role="button"]`, `input`, `nav`, etc.), screenshot each in isolation, dump outerHTML + computed styles. Trigger hover/focus via Playwright actions and capture those states too.

## 9. Imagery & illustration style

- Photography style (B&W? muted? high contrast? duotone? aspect ratios used?)
- Illustration style if any (flat, isometric, hand-drawn)
- Image treatments (border-radius, overlays, gradients applied)
- Representative samples saved to the design system

This is the hardest to systematise — capture 10–20 representative images and let Claude see them.

## 10. Voice & copy (often missed, hugely brand-relevant)

- Headline patterns (sentence case? Title Case? ALL CAPS eyebrows?)
- Microcopy: CTA verbs used, error message tone, empty states
- Reading level / sentence length
- Punctuation quirks (Oxford comma? em dash style?)

Scrape 30–50 representative strings and bucket them.

## The output package (what Claude needs)

Structure the generated design system like this:

```
brand-design-system/
├── README.md                 ← human + Claude entry point
├── tokens/
│   ├── colors.css            ← :root { --color-primary: ... }
│   ├── colors.json           ← machine-readable twin
│   ├── typography.css
│   ├── typography.json
│   ├── spacing.css
│   ├── radii-shadows.css
│   └── motion.css
├── fonts/                    ← local .woff2 files
├── icons/                    ← SVG library + manifest
├── logos/
├── components/
│   ├── button.html           ← live example markup
│   ├── button.css            ← extracted styles
│   ├── card.html
│   └── ...
├── examples/
│   ├── landing-page.html     ← 2–3 full page examples for reference
│   └── ...
├── imagery/                  ← representative samples
└── brand-guide.md            ← voice, tone, do/don't
```

The `README.md` is the most important file — it's what Claude reads first. It should contain:
- One-paragraph brand summary (visual character: e.g., "playful, high-contrast, dense type, generous whitespace")
- The token list inline (not just linked)
- Component inventory with thumbnails
- "How to use this" — explicit rules like "always use `--color-primary` for primary CTAs"

## Extraction strategy tips

- **Computed styles > source CSS.** The source CSS is full of dead rules, overrides, and noise. Walking the rendered DOM with `getComputedStyle` tells you what's actually used.
- **Frequency-weight everything.** A color used 400 times is a token; a color used 3 times is probably an accident or a one-off.
- **Cluster aggressively.** Brands rarely have 47 grays — they have 8 grays applied inconsistently. Cluster nearby values and pick canonical representatives.
- **Capture states.** Hover and focus styles carry as much brand identity as the resting state.
- **Snapshot real renders.** For each component, save a PNG. Claude reasons better when it can both read the tokens AND see the result.
- Generate a single "vibe check" page that renders all tokens + components together — this is your QA artifact and also Claude's quickest way to absorb the system.
