# Next Session — Gaps to Close

Status as of 2026-05-14: full pipeline works end-to-end with verified 1:1 parity in safe mode. Below is the punch list of remaining gaps before the system is genuinely "production-ready for client work".

---

## P1 — Real client work blockers

### 1. Resend form integration (deferred earlier)
Forms in captured sites are pure static markup. To actually capture leads we need:
- `src/pages/api/contact.ts` Astro endpoint
- Input validation (length, email format, honeypot, rate limit via Cloudflare Turnstile)
- Resend SDK wired with `RESEND_API_KEY` env var
- Recipient address via `CONTACT_TO` env var
- No-detail error responses
- Optional: a small `<ContactForm>` primitive that wraps captured form markup with the handler URL

### 2. Security baseline
None of this exists today:
- CSP via Astro middleware (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, `Content-Security-Policy`)
- HSTS / canonical https redirects
- Form honeypot + Cloudflare Turnstile token verification
- Audit of inline `<script>` blocks captured from third-party CDNs — pin versions or vendor
- `.env.example` + `.env` template with required vars validated at startup

### 3. SEO config layer
Currently every meta tag lives inside `SiteLayout.astro` (hardcoded from capture). Build a thin layer:
- `src/content/seo.config.ts` — title, description, og.title, og.description, og.image, twitter.*, canonical, robots
- SiteLayout reads from config + accepts per-page overrides via props
- `@astrojs/sitemap` integration for sitemap.xml
- `public/robots.txt`
- JSON-LD primitives (Organization, WebSite, BreadcrumbList) as optional Astro components

### 4. Tracking config layer
Same pattern as SEO:
- `src/content/tracking.config.ts` — GA4 ID, GTM ID, Meta Pixel ID, optional PostHog/Clarity
- `<TrackingHead>` and `<TrackingBody>` components consume config + render only when IDs present
- POPIA consent gating hook (default-granted, opt-out)

### 5. Cloudflare Pages adapter + deploy workflow
- Install `@astrojs/cloudflare`
- Update `astro.config.mjs` with adapter config
- Add `wrangler.toml`
- `npm run deploy` script
- Document env-var setup in Cloudflare dashboard

---

## P2 — Editability polish

### 6. Prettify HTML inside section components (P1 — promoted from P2 per 2026-05-14 sign-off)
Sections still contain captured production HTML which is mostly single-line / minimally whitespaced. This is THE biggest gap for human + AI editing ergonomics — finding text and image refs in compressed markup is painful and scales poorly when working across many sections or many sites.

Approach:
- Add an emit-time prettify pass in `engine/astro/emit.ts` after `injectIsInline` and before file write
- Use `prettier` with `prettier-plugin-astro` (already a dep from earlier work)
- Parser: `astro` for `.astro` files
- Verify roundtrip on the existing `check:astro-emit` fixtures (build must still succeed; output HTML must be semantically identical post-prettify)
- Add a `--no-prettify` escape hatch in `scripts/build-astro.ts` in case a specific site breaks
- Re-run rebuild-pro against enerblock test 3 + verify parity still 0% diff after prettification

Why important:
- Easier human edits (text + image refs scannable at a glance)
- Better AI edit accuracy (LLM context can see structure, not byte-stream)
- Diff readability on future client changes
- Prerequisite for clean component renaming + extraction in later phases

### 7. `EDIT.md` playbook auto-generated per site
Today there's only a generic README. Generate a per-site `EDIT.md` that lists:
- Each section file + its first heading + image paths used
- Every editable token with usage count (mirror tokens.css comments)
- Common edit recipes: "change brand colour", "swap hero image", "add a new page", "reorder sections"

### 8. Centralised editable content (`src/content/site.ts`)
Right now copy lives inside section markup. For real editing workflow, extract heading/body/CTA strings to a typed config:
```ts
export const site = {
  hero: { title: "Next-Gen Buildings", tagline: "..." },
  ...
};
```
Sections reference `site.hero.title` via `set:html` or `{}`. Bigger architectural change but unlocks CMS-style editing.

### 9. Component renaming convenience script
The user mentioned wanting to "make designs their own" via AI renames. Build a safe rename helper:
- Rename component file + all references across the project
- Optionally rename CSS classes (risky — needs to also rewrite captured `public/_astro/*.css` for every reference; provide preview + dry-run)
- Class glossary auto-generated so renames are informed

---

## P3 — Pipeline robustness

### 10. Aggressive mode parity loss diagnosis
Aggressive mode (Phase 5 + 6) breaks parity (22-29% diff on enerblock). Build an "aggressive-safe" variant that runs the refactor but ONLY where protection rules don't fire AND only if pixel-diff post-phase stays under 1%. Per-phase rollback if it degrades.

### 11. Multi-viewport capture by default
Capture currently runs all 4 viewports but the rebuild-pro pipeline today only operates on the desktop clone. Add multi-viewport support so the same Astro project handles responsive properly (or verify it already does via captured `@media` rules in CSS — likely fine, just untested).

### 12. Multi-page capture
Today we only capture and rebuild a single URL. Real sites have `/about`, `/contact`, etc. Add:
- `npm run clone-site --pages=/,/about,/contact`
- Each page becomes a separate `src/pages/*.astro`
- Shared components (Header, Footer) extracted once and imported into all pages

### 13. Animation extraction coverage
Currently only `gsap.to/from/etc.` with all-literal args become editable modules. ~70-90% of animations. The other 10-30% stay in original bundles. Investigate:
- Variable tracing through minified scopes (find `duration: D` where `D = 1.2` somewhere upstream)
- ScrollTrigger config rehydration
- IntersectionObserver pattern extraction

### 14. Custom-element library detection
Sites using Web Components (`<a-link>`, `<scroll-frames>`, `<hero-title>`, etc.) preserve them today (safe). Tomorrow: detect which library defines them (GSAP plugins, Astro view transitions, custom site code) and document in `class-glossary.md` so a human knows what to do.

### 15. Source-framework detection
Add a Phase 0.5: detect whether captured site is Astro/Next/Nuxt/Vue/raw HTML. Adjust capture + slice strategies accordingly. For React/Next sites, hydration scripts behave differently — verify capture catches them.

---

## P4 — System hygiene

### 16. Delete unused old code
`engine/extract/playwright/*` (page-scanner, animation-detector, asset-collector, font-extractor, interaction-mapper, stylesheet-scraper) are superseded by the new capture pipeline. Audit which is still imported and delete dead code.

### 17. Pre-existing TS errors in `clone-enerblock/` and `clone-astro-fixture/`
These are old test outputs that the typecheck still picks up. Either move them outside `tsconfig` includes or delete them.

### 18. Run all check scripts in CI
`npm run check:html-rewriter`, `check:astro-emit`, `check:refactor`, `check:scope-styles` — wire into CI so refactors don't regress.

### 19. Document the full pipeline in CLAUDE.md
The repo's `CLAUDE.md` mentions the capture pipeline but not the rebuild-pro pipeline. Update with safe vs aggressive mode, expected outputs, troubleshooting.

### 20. Track first-real-client run
Once you use this for an actual client, capture every gotcha in a `LEARNINGS.md`. Patterns to handle: gated content, login walls, CAPTCHAs, infinite scroll, lazy-loaded sections, cookie banners that block first-paint.

---

## Quick wins to start tomorrow (in order)

1. **P2.6 HTML prettify pass** (now P1) — the ergonomics unblocker for every other task. Do this first.
2. P3.X Test rebuild-pro against 2-3 different sites (HTML, React/Next, Astro, plain CSS) to surface kinks
3. P1.3 SEO config layer — small, high value, common to every client
4. P1.4 Tracking config layer — same shape as SEO, easy follow-on
5. P2.7 Auto-generated `EDIT.md` — script-only, no creative work
6. P3.11 Multi-viewport build verification — likely already works, just needs a test
7. P1.1 Resend integration — biggest unlock for client deliverability

After those, the system is genuinely ready for a paying client engagement.

## React target (multi-target architecture)

The pipeline now emits two framework targets behind a single CLI. Same captured clone, two outputs, same 2% pixel-diff bar.

Build:
```bash
# Astro (existing behaviour, still works via npm run build-astro)
npx tsx scripts/build.ts --clone-dir=./clone-enerblock --out-dir=./clone-enerblock --target=astro

# React + Vite + TS
npx tsx scripts/build.ts --clone-dir=./clone-enerblock --out-dir=./clone-enerblock-react --target=react
```

Output (React target): Vite + React + TS project with verbatim captured CSS for 1:1 visual parity. Section markup is converted to TSX; captured `<script>` blocks and complex inline HTML are emitted via `dangerouslySetInnerHTML`. Custom elements (`<a-link>`, `<scroll-frames>`, etc.) are typed in `engine/targets/react/jsx-custom-elements.d.ts` so JSX accepts them without prop bleed.

Verification:
- `npm run test:parity:astro` — pixel-diff Astro build at 4 viewports against captured originals, 2% threshold.
- `npm run test:parity:react` — boots Vite dev server on 5173 and runs the same harness against the React build.

Known limitations:
- Inline `<script>` tags ship via `dangerouslySetInnerHTML` — captured analytics/CDN scripts run as-is, no rehydration.
- React build needs its own dev server (Vite) — slightly slower first paint than the static Astro `dist/`.
- Custom-element prop typing is permissive (string-only) — strict typing waits until usage patterns surface.

## Today's sign-off (2026-05-14)

Status: full pipeline shipped + verified 1:1 parity on enerblock test 3 across all 4 viewports. astro-pro is a real, idiomatic Astro project — same shape as `npm create astro@latest`. Add SEO/forms/security/tracking as additive layers; no foundation rewrite needed.

Tomorrow: prettify pass first, then run the pipeline against a few different sites to find edge cases.
