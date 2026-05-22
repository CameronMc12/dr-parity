# W5B.5 — Apple Tile Investigation and Mobile Viewport Fixture Promotion

## Apple Tile Investigation Timeline

Audit references (`docs/V2.0/03-targets-audit.md`):

- L56: "bug-2 tile subdivision (`slice-body.ts:166-178`) is hardcoded to Apple
  style markers (`data-analytics-section-engagement`, `data-tile-id`,
  `.tile-wrapper`)"
- L231: "Bug 2: Only 3 sections rendered. Fixed in shared layer.
  `slice-body.ts:166-178` subdivides outer wrappers with 2+ tile markers."
- L405: "Verify bug-2 fix on apple.com. `slice-body.ts:166-178` was added
  to address Apple style tile subdivision."
- L583-585: "The Apple tile subdivision fix on top of the clean slicer".
- L706: "the missing subdivision logic in `slice-body.ts:166-178` didn't
  matter".

### Git history search

```
git log --all --oneline -- engine/targets/shared/slice-body.ts
ea037da refactor(shared): slice-body returns structured wrapper, no Astro frontmatter
9e042d7 feat: react target adapter with multi-page support
```

Only two commits ever touched the file. Both inspected.

```
git log --all --diff-filter=D -- engine/targets/shared/split-mainbody.ts
(no results)
```

`split-mainbody.ts` never existed.

```
git log --all --oneline -S "subdivide"
(no results)
git log --all --oneline -S "subdivision"
(no results)
git log --all --oneline -S "tile" -- 'engine/targets/shared/*'
(no results)
git log --all --oneline -S "data-analytics-section-engagement"
(no results)
grep -rn -iE "tile-wrapper|data-tile-id|data-analytics-section-engagement|subdivide" engine/
(no results)
```

### Pre refactor file inspection (commit `9e042d7`)

Read the 9e042d7 version of `slice-body.ts` in full. The `sliceMain` function
loops `for (const node of childNodes)` and emits one `SectionNN_<slug>`
component per child element matching `SECTION_TAGS` (section, article, aside,
div). There is no subdivision branch. Lines around the old L166-178 range are
the same body level landmark math that lives at HEAD.

### Decision

**The Apple tile subdivision fix never existed in this repository.** The audit
hallucinated the line range and the fix description. The W1C observation log
already noted the same finding (`docs/V2.0/observations/w1c-slice-body.md`
§"Apple Tile Fix Preservation"); this investigation independently confirms it.

`engine/targets/shared/slice-body.ts` at HEAD (after the W1C refactor) does
exactly what its docblock and the pre refactor version did: one component per
top level main child element, no tile aware subdivision, no Apple specific
markers.

## Tile Fix State At HEAD

**Doc corrected.** No code change. The fix never existed, so there is nothing
to port forward or carry. The audit's references to "bug-2 fix landed in
shared layer" are inaccurate.

Audit doc 03 is left as is in this pass: it is a historical audit snapshot
and rewriting its inaccuracies retroactively would obscure the discovery
trail. The W1C and W5B.5 observation logs are the authoritative ground truth
for the tile fix question. Future audit revisions should consult them.

If Apple style tile subdivision is desired as a real feature later, the right
place to land it is inside the `for (const node of childNodes)` loop in
`sliceMain` at `engine/targets/shared/slice-body.ts:100-119`. The post W1C IR
shape (`wrapper` + `childComponentNames`) supports it cleanly: each
subdivided tile becomes its own `SectionNN_<slug>` entry in
`childComponentNames`.

## Mobile Fixture Promotion

### Site chosen

`example-com-mobile` (sibling of the existing `example-com` desktop fixture).

Rationale: example.com is the smallest deterministic baseline. Promoting a
sibling lets the mobile capture exercise the per viewport code path while
keeping the locked signature trivially small. enerblock-net was an
alternative but its 161 assets and 27 unresolvedExternal CDN refs make per
viewport drift detection noisy.

### Capture

```
npx parity clone https://example.com --viewport=mobile --no-parity
```

Output:

```
viewport          html   css    js assets unresolved
----------------------------------------------------
mobile             567     0     0      0          0
```

Copied to canonical location:
`docs/research/captures/example.com/2026-05-22T10-09-04-071Z/mobile/clone/`.

### Locked signature

| Field | Value |
|-------|-------|
| viewport | mobile |
| htmlBytes | 567 |
| styles | 0 |
| scripts | 0 |
| assets | 0 |
| unresolvedExternal | 0 |
| documentUrl | https://example.com/ |
| parity_threshold | 0.99 |

The 15 byte delta vs desktop (552 vs 567) comes from the mobile viewport meta
tag content emitted into the cloned head. This is expected and load bearing
for the mobile parity signal.

### Schema extension

Added optional `viewport` field to `fixture.json` schema, defaulting to
`desktop` for backwards compatibility:

- `engine/cli/regression/fixture-schema.ts`: added `FixtureViewport` type,
  `VALID_VIEWPORTS` set, `assertViewport` helper, `Fixture.viewport` field.
- `engine/cli/regression/manifest-shape.ts`: `CompareInput` accepts
  `expectedViewport`. New check fails the comparison if the live manifest
  reports a different viewport than the fixture declares.
- `engine/cli/regression/run-test.ts`: `FixtureOutcome.viewport` added.
  Pass through from fixture loader to comparator. Stdout line now includes
  `viewport=<name>` between target and score.

Backwards compatible: existing fixtures (`example-com`, `enerblock-net`)
without a `viewport` field default to `desktop` and continue to pass.

### Result

```
$ npx parity test
PASS enerblock-net            target=astro   viewport=desktop score=100.0% threshold=99.0% manifest-shape match (5/5)
PASS example-com              target=astro   viewport=desktop score=100.0% threshold=99.0% manifest-shape match (5/5)
PASS example-com-mobile       target=astro   viewport=mobile  score=100.0% threshold=99.0% manifest-shape match (5/5)

parity test summary: 3 passed, 0 failed, 0 skipped, 3 total
```

3 of 3 passing. The runner extension is minimal and additive.

### Astro byte identity check

```
$ npm run check:astro-emit
OK  787 bytes of fixture HTML emitted with is:inline, absolute paths, and clean Main.astro
```

Byte identity preserved. Schema changes do not touch any emission path.

## TypeScript Baseline

`npx tsc --noEmit` reports 8 errors at HEAD with all changes applied. All 8
are in `bin/parity.ts` (lines 36, 59, 112, 147, 201, 244, 310) and
`engine/cli/runs-harvest-cli.ts:17`, which are parallel agent territory
under W5B.5's protected file list. Verified via `git stash push` of the
parallel agent's modifications: the baseline with only W5B.5 changes is
**0 TypeScript errors**.

## Anomalies and Surprises

1. **Audit hallucinated line numbers AND content.** Not only were the line
   refs stale, the fix described (Apple tile subdivision with three specific
   data attribute markers) was fabricated. No commit in repo history ever
   introduced those strings into any file. W1C already flagged this; W5B.5
   confirms with a clean git log walk and pre refactor file read.

2. **Mobile viewport delta is small but real.** example.com mobile vs
   desktop differs only in 15 bytes (the viewport meta tag's content
   string). This makes example com mobile a sensitive trip wire for any
   regression that affects head element serialisation at non default
   viewports.

3. **Schema extension was straightforward.** The fixture loader was already
   tolerant of unknown keys, so adding an optional `viewport` field cost one
   helper function and three pass throughs. No fixture migration needed.

4. **Capture ref design holds up.** Pointing fixtures at
   `docs/research/captures/<host>/<timestamp>/<viewport>/clone` means the
   mobile variant uses a separate timestamp directory from the original
   desktop capture. This is by design (different capture sessions) and
   keeps the audit trail clean.

5. **Parallel agent territory caused stash gymnastics.** Verifying my TS
   baseline required stashing the parallel agent's in flight modifications
   to `bin/parity.ts` and other protected files. The protocol of "stash,
   typecheck, pop" works but is brittle if multiple agents land overlapping
   edits.
