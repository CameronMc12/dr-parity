# Known-Bad: apple-com-react

## Current state

| Viewport | Diff pixels | Total pixels | Diff ratio | Threshold | Passed |
|----------|-------------|--------------|------------|-----------|--------|
| desktop  | 2,486,373   | 8,135,680    | 0.3056     | 0.05      | no     |

Source: `docs/research/captures/www.apple.com/react-site-urls/parity-report.json`.

## Why this is here

`docs/V2.0/03-targets-audit.md` documents that the react target has had
"one successful clone" but no replicable pattern. apple.com is the most
recent known react baseline and is failing at 30.56 percent pixel diff
against the reference screenshot. The audit calls out five latent
failure modes in the react path that this clone is likely hitting:

1. extract-css and media-preserve are not run on the react post-emit
   (Phase 3 task 2 in 05-action-plan.md).
2. JSX className whitespace collapse missing (Phase 3 task 3).
3. style serialisation does not route url() and quote edge cases through
   backtick literals (Phase 3 task 3).
4. verify-render ignorable error filter too broad (Phase 3 task 4).
5. AstroFrontmatter leak into react components (now fixed in
   W1B / W1C per recent commits).

## What a fix looks like

A successful triage closes this fixture into `tests/fixtures/sites/` at
the score the fixed pipeline achieves. Promotion criteria stay at 0.99
parity per the action plan promotion rule.

## Affected runs

- `docs/research/captures/www.apple.com/2026-05-22T07-07-41-024Z` (reference)
- `docs/research/captures/www.apple.com/react-site-urls` (rebuild attempt)

## Not a gate

`parity test` does NOT run this fixture. The harvest loop and
contributors looking for representative bug shapes read it. When a fix
lands and the clone reproduces above 0.99 parity, move this directory to
`tests/fixtures/sites/apple-com-react/` and update the threshold.
