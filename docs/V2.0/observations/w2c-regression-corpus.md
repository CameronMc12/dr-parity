# W2C. Regression Corpus Genesis

Phase 3d per docs/V2.0/05-action-plan.md section 3. Sets the V0 of the
regression corpus and the gate command that consumes it.

## Clone Inventory

Surveyed `clones/` (14 entries, all `app.omnisocials.com-*` rebuilds, all
webapp target) and `docs/research/captures/` (8 hosts, mixed targets).

| Host | Target | Parity score | Location | Build status |
|------|--------|--------------|----------|--------------|
| example.com | astro | n/a (manifest deterministic) | docs/research/captures/example.com/2026-05-14T12-54-35-266Z | clone present, 552 byte html, 0 unresolved |
| enerblock.net | astro | n/a (no parity-report) | docs/research/captures/enerblock.net/2026-05-15T18-07-59-099Z | clone present, 58888 byte html, 27 unresolved CDN refs (expected) |
| vivre.agency | astro | n/a (no parity-report) | docs/research/captures/vivre.agency/2026-05-18T09-11-42-619Z | clone present, 132625 byte html, WordPress backend |
| yodezeen.com | astro | n/a (no parity-report) | docs/research/captures/yodezeen.com/2026-05-15T10-01-05-423Z | clone present, four viewports |
| www.apple.com | react | 30.56 pct desktop pixel diff | docs/research/captures/www.apple.com/react-site-urls | rebuild present, FAILS at threshold 5 pct |
| viudadesainz.com | astro | n/a | docs/research/captures/viudadesainz.com/2026-05-21T... | not inspected |
| fluid.glass | astro | n/a | docs/research/captures/fluid.glass/2026-05-15T... | 8 timestamps, not inspected |
| app.omnisocials.com | webapp | n/a | docs/research/captures/app.omnisocials.com/2026-05-21T... | 14 rebuild attempts in clones/, none with parity-report.json |

Only `www.apple.com/react-site-urls/parity-report.json` exists on disk. No
other target has a written parity report.

## Fixtures Promoted

| Slug | Target | parity_threshold | comparison_mode | Why this fixture | What it proves |
|------|--------|------------------|-----------------|------------------|----------------|
| example-com | astro | 0.99 | manifest-shape | Smallest deterministic baseline. Single page, zero external assets. | Capture and clone pipeline produces a stable signature for trivial inputs. |
| enerblock-net | astro | 0.99 | manifest-shape | Canonical astro success referenced in 03-targets-audit.md and 05-action-plan.md. | Capture and astro clone pipeline produces a stable signature for a real-world target with assets, scripts, and CDN image fleet. |

Both fixtures lock the structural manifest (htmlBytes, styles, scripts,
assets, unresolvedExternal counts, documentUrl). htmlBytes has a 5 percent
drift tolerance; the counts must match exactly.

## Known-Bad Catalogue

| Slug | Target | Current state | What fix would close it |
|------|--------|---------------|-------------------------|
| apple-com-react | react | 30.56 pct desktop pixel diff vs reference | Land Phase 3 tasks 2 to 4 in 05-action-plan.md: port extract-css and media-preserve into react post-emit, collapse className whitespace, fix style serialisation for url() and quote edge cases, tighten verify-render ignorable error filter. |

## parity test Command

Implementation:

- `engine/cli/regression/fixture-schema.ts`: strict loader. Reads
  `tests/fixtures/sites/<slug>/fixture.json`, validates target, threshold,
  comparison_mode, slug match. Returns `readonly Fixture[]` sorted by slug.
- `engine/cli/regression/manifest-shape.ts`: comparison engine for
  comparison_mode `manifest-shape`. Reads expected and live clone
  manifests, compares counts and htmlBytes drift. Returns
  `ComparisonResult { passed, score, summary, diagnostics }`.
- `engine/cli/regression/run-test.ts`: standalone runner plus
  `Stage<RegressionTestInput, RegressionReport>` for the orchestrator.
  Writes one line per fixture plus a summary line. Returns the exit code
  the CLI should propagate.
- `bin/parity.ts`: new `testCommand` defined and registered as
  `parity test`. Calls `runRegressionTest(root)` and exits with the
  returned code.

Sample output on prototype-mode HEAD (eab5ad8):

```
PASS enerblock-net        target=astro   score=100.0% threshold=99.0% manifest-shape match (5/5)
PASS example-com          target=astro   score=100.0% threshold=99.0% manifest-shape match (5/5)

parity test summary: 2 passed, 0 failed, 0 skipped, 2 total
```

Regression detection verified by mutating example-com expected htmlBytes
from 552 to 9999, then re-running. The runner correctly flagged FAIL with
diagnostic `htmlBytes: drift 94.48% exceeds tolerance 5%` and exit code 1.

## Action Plan Updates

`docs/V2.0/05-action-plan.md` section 3 rewritten to reflect what
shipped vs what is still planned:

- Replaced the planned `captures/`, `parsed/`, `baseline/` layout with the
  V0 `expected/`, `capture-ref/`, README layout.
- Replaced the planned `lockedScore` per-viewport schema with the V0
  flat `parity_threshold` plus `comparison_mode`.
- Added a sample output block and a V0 fixture table.
- Added a Known-bad catalogue subsection.
- Marked the CI hook as planned (Phase 5 / 6) rather than active.
- Annotated V0 vs V1 throughout so the rebuild path scope is clear.

## Parity / Pipeline Improvement Opportunities Spotted

1. The clone manifest is the cheapest stable signature available. Worth
   exposing a `--manifest-only` mode on `npm run clone-site` so future
   fixture promotion can skip the heavy capture pass when the signature
   already exists on disk.
2. Multiple `app.omnisocials.com` clones exist in `clones/` but none have
   a `parity-report.json`. The webapp build path does not emit a parity
   report. The action plan Phase 3 task 5 covers this, but until it
   lands no webapp fixture can be promoted.
3. The apple.com react rebuild ran against a 2026-05-22 reference
   capture, but the rebuild is dated immediately after. Suggests the
   capture happened during a rapid iteration loop. Worth pinning the
   reference capture to a specific git sha so future regenerations
   compare apples to apples.
4. Several captures have no clone subdirectory (fluid.glass viewport
   variants). The clone step appears to have been skipped or failed
   silently for some runs. The harvest loop should pick this up once
   Phase 6 lands.

## Surprises / Anomalies

- The action plan called for vivre.agency as the react fixture
  candidate, but the on-disk vivre.agency captures are astro target
  (WordPress, served as static HTML). No vivre.agency react rebuild
  exists. Treated as a non-starter for the V0 react fixture.
- No fixture in the corpus exercises viewports beyond desktop. The V1
  rebuild path will need to widen the comparison once per-viewport
  baselines exist.
- The known-bad apple-com-react fixture references two source paths
  (the reference capture and the rebuild attempt). The capture-ref
  source.txt currently lists both lines; the loader reads only the
  first. Documented in the loader; revisit when V1 introduces
  multi-source comparisons.
- Baseline TS error count was 15 per task brief but actually reads as
  16 on prototype-mode HEAD (eab5ad8). No new errors from W2C work; my
  files compile clean. Reported the discrepancy.

## Files touched

- `tests/fixtures/README.md` (new)
- `tests/fixtures/sites/.gitkeep` (new)
- `tests/fixtures/sites/example-com/{fixture.json,README.md,expected/clone-manifest.json,expected/index.html,capture-ref/source.txt}` (new)
- `tests/fixtures/sites/enerblock-net/{fixture.json,README.md,expected/clone-manifest.json,expected/index-head-200.html,capture-ref/source.txt}` (new)
- `tests/fixtures/known-bad/.gitkeep` (new)
- `tests/fixtures/known-bad/apple-com-react/{fixture.json,notes.md,expected/parity-report.json,capture-ref/source.txt}` (new)
- `engine/cli/regression/{fixture-schema.ts,manifest-shape.ts,run-test.ts}` (new)
- `bin/parity.ts` (added test subcommand)
- `docs/V2.0/05-action-plan.md` (section 3 rewritten)

## Commits

- c175b27 chore: scaffold tests/fixtures/sites for regression corpus
- d5e0666 test(corpus): promote example-com and enerblock-net as astro regression fixtures
- eab5ad8 feat(cli): parity test runs the regression corpus
- fc41b9d docs: V2.0 no-regression discipline reflects shipped corpus and gate
