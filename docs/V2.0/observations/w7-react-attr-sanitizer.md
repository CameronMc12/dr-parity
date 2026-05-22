# w7. React HTML attribute sanitizer

## Context

apple.com sets `x-ms-format-detection="none"` on a footer wrapper. The
react html-to-jsx converter previously routed unknown hyphenated attributes
through `camelise()`, producing `xMsFormatDetection="none"` in the emitted
JSX. React's intrinsic JSX types reject that prop on `<div>` (and on every
other built in element), so `tsc -b` fails on every emitted react clone
that includes Apple style markup.

```
src/components/Footer.tsx(22,21297): error TS2322:
  Type '{ ...; xMsFormatDetection: string; }' is not assignable to
  type 'DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>'.
  Property 'xMsFormatDetection' does not exist on type ...
```

Astro emit was unaffected because Astro accepts unknown HTML attributes
without type narrowing.

## Attribute classification rules

Implemented in `sanitizeNonStandardAttr()` inside
`engine/targets/react/html-to-jsx.ts`. Evaluation order matches the existing
`renderAttributes` pipeline so that the sanitizer only ever sees attributes
that fall outside the established standard paths.

| Bucket | Examples | Treatment |
|---|---|---|
| Standard HTML attr in `ATTR_MAP` | `class`, `for`, `tabindex` | unchanged (renamed by `ATTR_MAP` as before) |
| Boolean attr in `BOOLEAN_ATTRS` | `disabled`, `hidden`, `playsinline` | unchanged (boolean path) |
| Event handler (`on*` with length > 2) | `onclick` | unchanged (left to React) |
| `data-*` / `aria-*` | `data-analytics-title`, `aria-hidden` | unchanged (verbatim) |
| Allowed namespace prefix | `xml:lang`, `xmlns:xlink`, `xlink:href` | unchanged (JSXNamespacedName) |
| `xmlns` bare | `xmlns` on `<svg>` | unchanged |
| `x-ms-*`, `ms-*`, `webkit-*`, `moz-*` | `x-ms-format-detection` | rewritten to `data-x-ms-format-detection` |
| Colon in any other namespace | `og:image` smuggled into HTML | colons swapped for dashes, prefixed with `data-` |
| Anything that still fails `^[A-Za-z_][A-Za-z0-9_-]*$` | malformed garbage | dropped with a single `console.warn` per attribute name |
| Otherwise plain hyphenated unknown | bespoke design-system attrs | falls through to existing `camelise()` path (prior behaviour preserved) |

The rewrite preserves the semantic information in the DOM (analytics or
behavioural scripts that scrape `data-x-ms-format-detection` still find it)
while making the JSX valid against React's intrinsic types.

## apple.com attributes captured

After rebuilding the existing capture with the patched code:

| Original attribute | Bucket | Emitted JSX prop |
|---|---|---|
| `x-ms-format-detection="none"` (on `<div class="ac-gf-footer-shop">`) | vendor prefix | `data-x-ms-format-detection="none"` |
| `class`, `id`, `href`, `data-analytics-*`, `aria-*`, `role`, `disabled` | standard paths | unchanged (no regression) |
| `xmlns` on inline SVG | namespaced allow list | unchanged |

Sanitized prop counts in the emitted apple react project:

- `data-x-ms-format-detection`: 1 (Footer.tsx)
- `data-ms-*` / `data-webkit-*` / `data-moz-*`: 0
- dropped attributes (warning emitted): 0

## React build result

Before:

```
$ npm run build  # apple react clone
src/components/Footer.tsx(22,...): error TS2322:
  Property 'xMsFormatDetection' does not exist on type
  'DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>'.
```

After:

```
$ cd clones/www-apple/2026-05-22T11-23-46-107Z/sites/react
$ npx tsc -b                # exit 0
$ npm run build             # tsc -b passes; vite still fails on a
                            # separate asset path issue (missing
                            # v/home/a/scripts/main.built.js in the
                            # emitted public/ tree). That is a clone
                            # asset-copy bug, not a JSX attribute bug,
                            # and is out of scope for this observation.
```

The original reported failure (TS2322 on the JSX attribute) is fixed. The
emitted apple react project now type checks cleanly.

## React parity score

Not achievable from this capture. The vite build still fails downstream on
an asset that the clone emitter did not copy into the react site (the
file lives in `captures/desktop/clone/v/home/a/scripts/main.built.js` but
no asset of that path exists under `sites/react/public/` or `sites/react/`).
Until the asset-copy gap is closed, parity verification cannot run for
apple.com on the react target. The JSX attribute sanitizer was the
prerequisite tsc fix; the asset-copy issue is a separate w7-followup.

## Regression checks

- `npx tsc --noEmit | grep "error TS" | grep -v "^clones/" | grep -v "^docs/research/" | wc -l` → 0
- `npx parity test` → 4 passed / 0 failed / 0 skipped / 4 total
- `npx tsx scripts/check-astro-emit.ts` → `OK 787 bytes of fixture HTML emitted with is:inline, absolute paths, and clean Main.astro`

## Anomalies / surprises

- Apple ships `x-ms-format-detection` in addition to the standard
  `<meta name="format-detection" content="telephone=no">`. The Microsoft
  extension targets old mobile IE / Edge, and the live site keeps it
  alongside the standard meta. Worth keeping a mental note that legacy
  vendor attributes still show up on top tier 2026 sites.
- The `webkitallowfullscreen` and `mozallowfullscreen` entries already
  present in `ATTR_MAP` are intentionally case sensitive matches on the
  lowercased key (no hyphen). Apple's `x-ms-format-detection` is the
  hyphenated form, which is why it had no entry and slipped through.
- The existing `camelise()` path is now reachable only by genuinely
  unknown hyphenated attributes that look like `foo-bar`. Vendor prefixes
  short circuit before it. If a future site ships a truly novel non
  vendor hyphenated attribute that React rejects, it will need its own
  entry in `ATTR_MAP` or a new bucket here.
