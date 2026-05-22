# Website Inspection Guide

## How to Reverse-Engineer Any Website

This guide outlines what to capture when inspecting a target website via the Playwright CLI capture pipeline or browser DevTools. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run and notes anomalies as they appear. No browser MCP is used.

## Phase 1: Visual Audit

### Screenshots to Capture
- [ ] Every distinct page at desktop, tablet, and mobile widths
- [ ] Dark mode variants (if applicable)
- [ ] Light mode variants (if applicable)
- [ ] Key interaction states (hover, active, open menus, modals)
- [ ] Loading and skeleton states
- [ ] Empty states
- [ ] Error states

### Design Tokens to Extract
- [ ] **Colors.** Background, text (primary, secondary, muted), accent, border, hover, error, success, warning.
- [ ] **Typography.** Font family, sizes (h1 through h6, body, caption, label), weights, line heights, letter spacing.
- [ ] **Spacing.** Padding and margin patterns. Look for a scale (4px, 8px, 12px, 16px, 24px, 32px, and so on).
- [ ] **Border radius.** Buttons, cards, avatars, inputs.
- [ ] **Shadows and elevation.** Card shadows, dropdown shadows, modal overlay.
- [ ] **Breakpoints.** When does the layout shift? Inspect with DevTools responsive mode.
- [ ] **Icons.** Which icon library? Custom SVGs? Sizes?
- [ ] **Avatars.** Sizes, shapes, fallback behavior.
- [ ] **Buttons.** All variants (primary, secondary, ghost, icon only, danger).
- [ ] **Inputs.** Text fields, textareas, selects, checkboxes, toggles.

## Phase 2: Component Inventory

For each distinct UI component, document:
1. **Name.** What would you call this component?
2. **Structure.** What HTML elements or child components does it contain?
3. **Variants.** Does it have different sizes, colors, or states?
4. **States.** Default, hover, active, disabled, loading, error, empty.
5. **Responsive behavior.** How does it change at different breakpoints?
6. **Interactions.** Click, hover, focus, keyboard navigation.
7. **Animations.** Transitions, entrance and exit animations, micro interactions.

### Common Components to Look For
- Navigation (top bar, sidebar, bottom bar)
- Cards and list items
- Buttons and links
- Forms and inputs
- Modals and dialogs
- Dropdowns and menus
- Tabs and segmented controls
- Avatars and user badges
- Loading skeletons
- Toast notifications
- Tooltips and popovers

## Phase 3: Layout Architecture

- [ ] **Grid system.** CSS Grid? Flexbox? Fixed widths?
- [ ] **Column layout.** How many columns at each breakpoint?
- [ ] **Max width.** Main content area maximum width.
- [ ] **Sticky elements.** Header, sidebar, floating buttons.
- [ ] **Z index layers.** Navigation, modals, tooltips, overlays.
- [ ] **Scroll behavior.** Infinite scroll, pagination, virtual scrolling.

## Phase 4: Technical Stack Analysis

- [ ] **Framework.** React? Vue? Angular? Check `__NEXT_DATA__`, `__NUXT__`, `ng-version`.
- [ ] **CSS approach.** Tailwind (utility classes), CSS Modules, Styled Components, Emotion, vanilla CSS.
- [ ] **State management.** Redux (check DevTools), React Query, Zustand, Pinia.
- [ ] **API patterns.** REST or GraphQL. Check the network tab for `/graphql` requests.
- [ ] **Font loading.** Google Fonts, self hosted, system fonts.
- [ ] **Image strategy.** CDN, lazy loading, srcset, WebP or AVIF.
- [ ] **Animation library.** Framer Motion, GSAP, CSS transitions only.

## Phase 5: Documentation Output

After inspection, create these files in `docs/research/`:
1. `DESIGN_TOKENS.md`. All extracted colors, typography, spacing.
2. `COMPONENT_INVENTORY.md`. Every component with structure notes.
3. `LAYOUT_ARCHITECTURE.md`. Page layouts, grid system, responsive behavior.
4. `INTERACTION_PATTERNS.md`. Animations, transitions, hover states.
5. `TECH_STACK_ANALYSIS.md`. What the site uses and our chosen equivalents.
