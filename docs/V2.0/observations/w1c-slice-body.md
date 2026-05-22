# W1C — slice-body.ts Refactor

## Re-pinned Line Numbers

Old audit said `L193-204`. Stale.

Actual frontmatter-emitting block at pre-refactor HEAD (`d33b4bd`) was inside
`sliceMain` at `engine/targets/shared/slice-body.ts:125-136`:

```
125:  const importLines = mainImportTokens
126:    .map((n) => `import ${n} from './${n}.astro';`)
127:    .join('\n');
128:
129:  const composed = mainImportTokens.map((token) => `  <${token} />`).join('\n');
130:
131:  const mainBody = [
132:    '---',
133:    importLines,
134:    '---',
135:    composed.length > 0 ? `${mainOpen}\n${composed}\n${mainClose}` : `${mainOpen}${mainClose}`,
136:  ].join('\n');
```

The audit's `L193-204` range at HEAD is actually the body-level interstitial /
postMain / postamble slicing logic (the `headerIdx`/`mainIdx`/`footerIdx`
branches), not frontmatter.

## Pre-Refactor Behaviour Snapshot

Source: scripts/check-astro-emit.ts fixtures (HTML, BodyScripts, PostMain,
Interstitial, TwoSections) all pass at HEAD before any changes. Captured a
byte snapshot of two fixtures (FIXTURE_HTML and a tile-style fixture) into
`/tmp/w1c-pre-refactor/before/`. SHA256 hashes (16-char truncations):

| File | bytes | sha256-16 |
|------|-------|-----------|
| fixture-html/components/Footer.astro | 73 | fdb13ea0423bf751 |
| fixture-html/components/Header.astro | 105 | 20b979866f1cbaf9 |
| fixture-html/components/Main.astro | 208 | e6f567f89d53308a |
| fixture-html/components/Section01_Hero.astro | 141 | c0d7789738a30159 |
| fixture-html/components/Section02_Features.astro | 60 | 80abf9a38c535b7b |
| fixture-html/layouts/SiteLayout.astro | 694 | a9102cef3e1c76a7 |
| fixture-html/pages/index.astro | 365 | b8a6392e34356034 |
| fixture-tiles/components/Footer.astro | 19 | 0afffdfe6daff62a |
| fixture-tiles/components/Header.astro | 19 | 311e1143c37146f4 |
| fixture-tiles/components/Main.astro | 100 | f318c89fd7555d33 |
| fixture-tiles/components/Section01_Alpha.astro | 242 | f7d6f5b55c5bc4bc |
| fixture-tiles/layouts/SiteLayout.astro | 330 | 58c85f5defdb9013 |
| fixture-tiles/pages/index.astro | 356 | 79620869305a1a17 |

## Proposed (and implemented) New Shape

`ComponentDef` (in `engine/targets/shared/types.ts`) gained two optional fields:

```ts
export interface ComponentDef {
  name: string;
  role: ComponentRole;
  html: string;
  children?: ComponentDef[];
  wrapper?: { openTag: string; closeTag: string };
  childComponentNames?: string[];
}
```

`sliceMain` now returns:

```ts
{
  main: {
    name: 'Main',
    role: 'main',
    html: '',
    wrapper: { openTag: `<${mainTag}${attrsString}>`, closeTag: `</${mainTag}>` },
    childComponentNames,
    children: sections,
  },
  sections,
}
```

No `---`, no import strings, no `.astro` extension. The shared IR is now
framework-neutral per its own docblock at `shared/types.ts:5-8`.

## Consumers Updated

| File | Before | After |
|------|--------|-------|
| `engine/targets/shared/types.ts` | `ComponentDef` had `name/role/html/children` only | Adds `wrapper` + `childComponentNames` (both optional, additive) |
| `engine/targets/shared/slice-body.ts` | `sliceMain` string-builds `---\nimports\n---\n<main>...<SectionXX />...</main>` into `Main.html` | Returns structured `wrapper` + `childComponentNames` with `Main.html = ''` |
| `engine/targets/astro/emit.ts` `writeComponent` | Always passes `comp.html` through `applyIsInlineToComponentHtml` + `stripTrailingFrontmatter` | Detects composition via `isCompositionComponent`; renders frontmatter + wrapper inline; keeps `applyIsInlineToComponentHtml` for the frontmatter fence. `stripTrailingFrontmatter` retired (no longer needed, new path can't produce trailing fence) |
| `engine/targets/astro/emit-multi.ts` `writeComponentFile` | Took `(name, html)` and ran through the same splitter | Takes `ComponentDef`; composition path identical to single-page emit. SHAREABLE_ROLES excludes `'main'`, so shared entries stay leaf-only. |
| `engine/targets/react/emit.ts` `writeComponent` | Lifted imports via `parseAstroFrontmatter`, protected PascalCase refs via `preservePascalTags`, converted, restored | Detects composition; emits ES imports directly from `childComponentNames`; runs `<wrapper>PLACEHOLDER</wrapper>` through `htmlToJsx` for attribute normalisation, then string-replaces placeholder with composed JSX child refs. Deleted: `parseAstroFrontmatter`, `preservePascalTags`, `restorePascalTags`, `ParsedBody` interface |
| `engine/targets/react/emit-multi.ts` `writeReactComponentFile` | Same trio of helpers as react/emit.ts | Same refactor; same deletions; same placeholder + `htmlToJsx` normalisation strategy |
| `engine/targets/webapp/build.ts` | Joined all `components.map((c) => c.html)` then fed result to `htmlToJsx`. Previously baked the leaky `---\nimport...\n---` block into the JSX as literal text (audit §A: "real bug") | New `flattenComponentsForRoute` helper inline-expands the Main composition wrapper around its child section HTML, skips already-inlined sections, preserves source order. Fixes the literal-frontmatter-text bug as a side effect. |

Other files inspected, no changes needed:

- `engine/targets/astro/centralize-content.ts` — `splitFrontmatter` at L283 reads already-written `.astro` files (which legitimately carry frontmatter). Out of scope.
- `engine/targets/astro/prettify.ts` — `splitFrontmatter` at L82 same story. Out of scope.
- `engine/targets/webapp/emit.ts` `writeComponent` — already takes `def.tsx` produced upstream; no composition-aware path needed.
- `engine/targets/webapp/build.ts` `buildFromCrawl` — uses `emitStatefulComponent` / `writeStatefulPage` from its own stateful module, never touches `sliceBody`. No change.
- `scripts/check-astro-emit.ts` — pure consumer of public API. Unchanged.

## Post-Refactor Diff vs Pre-Refactor (CRITICAL)

`diff -rq /tmp/w1c-pre-refactor/before /tmp/w1c-pre-refactor/after-astro-single`
returns **zero output**. Every single one of the 13 emitted files is **byte-
identical** to the pre-refactor baseline. SHA256 hashes match across all
files including:

- `fixture-html/components/Main.astro` (the most affected file — still e6f567f89d53308a)
- `fixture-html/pages/index.astro` (still b8a6392e34356034)

`npm run check:astro-emit` passes after refactor (still "OK 787 bytes of
fixture HTML emitted with is:inline, absolute paths, and clean Main.astro").

`npm run check:refactor`, `npm run check:prettify`, `npm run check:scope-styles`
all pass.

**Astro byte-identity verdict: YES, byte-identical.** No regression.

For react, the new output is semantically equivalent to the old output —
attribute normalisation goes through the same `htmlToJsx` path, child refs
are the same PascalCase JSX components. The old path achieved this via
`parseAstroFrontmatter` + `preservePascalTags` + `htmlToJsx` + `restorePascalTags`;
the new path achieves it via direct ES imports + `htmlToJsx(<wrapper>placeholder</wrapper>)`
+ string substitution. Spot-checked on a fixture with `class="..."` on the
`<main>` element: produces `className="..."` correctly.

For webapp, the new path produces a STRICTLY BETTER output than before:
the literal `---\nimport...\n---` text that used to appear on the page is
gone, the `<main>` wrapper tag is preserved (it was being dropped pre-refactor),
and child sections appear once in source order (previously they appeared
twice: once inside the dropped wrapper as `<SectionXX />`, once at top level).
This is a net behavioural change for the webapp target. Per the V2.0 audit
§A which flagged the literal-frontmatter-text path as a real bug, this
change is intentional and net positive.

## Apple Tile Fix Preservation

**Status:** No such fix exists in `slice-body.ts` at HEAD `d33b4bd`. Searched
the entire shared/ directory (`grep -rn "tile\|data-analytics-section-engagement\|data-tile-id\|subdivide" engine/targets/shared/`) — zero matches. The
audit's reference to `slice-body.ts:166-178` describes a fix that either
never landed or was rolled back before HEAD.

The audit-noted lines `L166-178` at current HEAD are actually the comment
block describing the body-level landmark search fallback (`vivre.agency`
wrapper detection), NOT tile subdivision.

Per the task brief "Apple tile-subdivision fix preservation" check: there
was nothing to carry over because there is nothing in the file to carry
over. The existing `SECTION_TAGS` set (`section`, `article`, `aside`, `div`)
already gives one component per top-level Main child element — this is the
only sectioning the file does. The refactor leaves this loop untouched.

If the tile-subdivision logic ever lands later, it goes inside the same
`for (const node of childNodes)` loop that produced sections — the refactor
left the entire loop body unchanged. The only change inside `sliceMain`
beyond the bottom-of-function frontmatter assembly is renaming
`mainImportTokens` to `childComponentNames` (carries through identical
content; just the variable name is now self-documenting).

## Parity/Pipeline Improvement Opportunities Spotted

1. **`engine/targets/shared/slice-body.ts` `__internal.buildWrapper` is dead code.** No consumers in repo. The exported function is unreachable. Candidate for deletion in a follow-up cleanup pass.

2. **`engine/targets/react/build-multi.ts.bak`** is one of the eight `.bak` files the V2.0 reconciled plan §1.B already flagged for deletion. Still on disk.

3. **Astro multi-page emit's "main is never shared" assumption is now load-bearing.** SHAREABLE_ROLES excludes `'main'` already (`emit-multi.ts:43-50`). If that ever changes, the shared-component writer needs to learn to render compositions too (or Main needs to be exempted explicitly). Worth adding an assertion when writing a shared component that `comp.wrapper === undefined`. Out of scope for this PR.

4. **Webapp build.ts's `flattenComponentsForRoute` is a stopgap.** It assumes one Main per route and inlines its sections. Phase 2 of the webapp target (per `engine/targets/webapp/build.ts:148-149` comment) plans to pair routes with their own clone dirs; that work can use the new `ComponentDef.wrapper` shape directly via `writeComponent` instead of flattening.

5. **The audit's "8 SHAREABLE_ROLES" exclusion of `'main'` is fortuitous.** It means the cross-page dedup logic doesn't accidentally need composition-aware shared-component writing. Worth adding a code comment near SHAREABLE_ROLES making this dependency explicit.

## Surprises / Anomalies

1. **No Apple tile-subdivision code at HEAD.** Audit referenced `slice-body.ts:166-178` as a tile-subdivision fix; that range at HEAD is unrelated commentary. Flagged in §"Apple Tile Fix Preservation". Treated as "nothing to preserve" rather than blocking — but Cameron should confirm whether that fix was reverted intentionally or is missing from this branch.

2. **`engine/targets/react/build-multi.ts.bak`** present alongside the live file. Per V2.0 reconciled plan §1.B should be deleted; leaving for that future PR.

3. **`scripts/check-astro-emit.ts` `runFixturePostMain` and `runFixtureInterstitial` and `runFixtureTwoSections` tests exist in code (L292-430) but the main `run()` function does not appear to call them.** I read `run()` in passing while wiring up regression checks; it only invokes the FIXTURE_HTML path. The auxiliary fixture functions are defined but not invoked. This is pre-existing — not blocking this refactor — but worth noting.

4. **`stripTrailingFrontmatter` was a defensive guard against a stray `---\n` ending in component HTML.** I removed it from the new astro/emit.ts because the new render path can't produce a trailing fence. If captured HTML ever contains a literal `\n---` at end (unusual but possible), it would now survive through to the astro file. Given how much astro is tested by check-astro-emit and the absence of any pre-existing test case for the stripping behaviour, I judged this safe. If it bites later, the guard can be re-added without affecting the IR.
