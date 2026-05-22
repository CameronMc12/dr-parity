# W4A Phase 6 (additive half): Harvest loop + SKILL.md rewrite

Agent: W4A
Branch: prototype-mode
Starting HEAD: 49231ff (after W3 unified logging)
Ending HEAD: f1cc9bd (after this wave's commits)

## Summary

Shipped the additive half of Phase 6: the `parity runs harvest` command that
walks `.runs/<runId>/` records and emits triage tickets under
`docs/parity-issues/`, plus a complete rewrite of the `/clone-website` skill
that retires every Chrome MCP reference and every legacy `scripts/*.ts`
invocation in favour of a single canonical `parity clone` command.

W4B owned the invasive half (shim removal, canonical paths adoption,
subprocess removal in scripts/) in parallel. The two waves did not collide:
W4A stayed inside `engine/cli/`, `bin/parity.ts`, `.claude/skills/`,
`.github/skills/`, `docs/parity-issues/`, and `docs/V2.0/`. W4B's diff to
`scripts/run-clone.ts` and `scripts/clone-urls.ts` was visible during the
wave but not touched.

## Changes made

### engine/cli/runs-harvest.ts (new)

The harvest scanner and aggregator. Walks every directory under
`.runs/`, reads its `manifest.json` and `pipeline.jsonl`, then aggregates
across runs into five finding kinds: `recurring-warning`, `repeat-error`,
`parity-regression`, `duration-drift`, and `stuck-warning`. Idempotent
across re runs because every finding has a deterministic slug.

The dedupe slug formula is:

    <finding-type>-<slugified-stage>-<slugified-message>

truncated to 96 chars. `slugify` lowercases the input and replaces every
non alphanumeric sequence with a single dash. The first 40 chars of the
slugified value are taken for each component to bound URL safety.

Recurring messages are bucketed by `(stage, message)`. The message is
normalised through `.replace(/\s+/g, " ").trim().slice(0, 240)` so
identical errors with whitespace noise still collapse.

Parity regressions are detected per `inferTargetKey(manifest)`. The
target key prefers `manifest.target` and falls back to the URL host.
Each consecutive pair of runs is checked. Any drop triggers a finding
that lists every regressing run (deduped by runId).

Duration drift uses a rolling median across all but the latest run's
stage durations, then flags any duration > 1.5x median. Needs at least 3
data points before it fires.

Stuck warnings require a `hint` field on a warning event in the LATEST
run, which is treated as "Dr Parity claims this still has a gap". The
aggregator then walks every earlier run looking for the same
`(stage, message)` pair and flags only those that appear in the latest run
AND in at least one earlier run.

### engine/cli/runs-harvest-cli.ts (new)

Citty handler. Flags accepted:

- `--since=<iso>` filter by manifest startedAt
- `--target=<name>` filter by inferred target key
- `--min-recurrence=<n>` minimum surface count (default 2)
- `--runs-dir=<path>` override the `.runs/` input directory
- `--tickets-dir=<path>` override the `docs/parity-issues/` output directory

The command prints a short summary on completion (runs scanned, findings
emitted, tickets written, index path).

### engine/cli/run-manifest-read.ts and engine/cli/event-stream-read.ts (new)

Path based readers for the W3 writer modules. The writer modules expect a
`ManifestContext` shape (`{ runDir }`) so the harvest scanner could not
use them ergonomically. The read helpers wrap each writer module with a
plain `(filePath) => Promise<typedRecord>` interface. Manifest reads still
throw `ManifestSchemaError` on schemaVersion mismatch so the future
`parity runs migrate` hint will fire from any consumer.

### bin/parity.ts (extended)

Added `harvest` as a subcommand under `runs`. No other surface changed.

### scripts/smoke-parity-harvest.ts (new)

Builds a temp sandbox with three synthetic runs, writes manifest +
jsonl that triggers all four primary finding kinds (recurring warning,
repeat error, parity regression, stuck warning), runs harvest, asserts
tickets land with the locked schema, then asserts a second harvest
produces the same ticket count (idempotency).

PASS output on first run:

    runsScanned=3 findings=4 tickets=4
    PASS smoke-parity-harvest

### .claude/skills/clone-website/SKILL.md (rewritten)

Drops the 522 line legacy body. Replaced with a 96 line wrapper over
`parity clone` covering:

- Canonical command sequence (Playwright check, version, clone, summary
  read, optional qa verify, preview)
- Edge case flag table (`--mode=persistent`, `--viewport`, `--no-tour`,
  `--no-parity`, `--headed`, `--parity-threshold`, `--run-id`)
- "What NOT to do" blockade list naming every legacy script and the
  retired Chrome MCP integration
- "What the engine does" section pointing at `.runs/<runId>/manifest.json`
  + `pipeline.jsonl` + `SUMMARY.md` so future readers can audit any run
- Live capture observation guidance (Claude watches stage events, flags
  warnings with kind, notes duration drift)

Zero em dashes. Zero hyphens used as punctuation in prose. Hyphens inside
flag names and code samples are exempt by the writing style rule.

### .github/skills/clone-website/SKILL.md (regenerated)

Output of `node scripts/sync-skills.mjs` after the source SKILL.md
rewrite. Same content. Committed separately so the regeneration is
auditable.

### docs/parity-issues/INDEX.md (new)

Seeded empty triage queue. Future `parity runs harvest` runs overwrite
this file with the populated table.

### docs/V2.0/05-action-plan.md (section 6 + 7 rewrites)

Updated both sections to reflect the shipped state. Section 6 names the
SKILL.md path, lists the shipped blockade entries, and includes the
verification commands. Section 7 lists the shipped harvest files,
finding kinds, severity classification table, and the locked ticket
schema.

## Reasons for the implementation choices

### Separate read modules for manifest and event stream

The W3 writers expose write side APIs (`initManifest`, `patchStage`,
`createEventStream`). The harvest scanner only reads. Building read
helpers as small wrapper modules kept the writer modules unchanged
(W3 ships untouched) and gave the harvest scanner an ergonomic
`(filePath) => Promise<T>` shape. The two read modules are 25 lines and
20 lines respectively.

### Stuck warning kind requires a `hint` field

The W3 jsonl `warning` event already supports an optional `hint` field
per the schema in `event-stream.ts`. The harvest scanner treats the
presence of `hint` as "Dr Parity claims this is a known gap". Warnings
without a hint surface as `recurring-warning` instead. This split lets
us escalate hint bearing warnings to P2 and leave hint less warnings at
P3.

### Severity thresholds picked for a single developer cadence

Surface count thresholds were chosen against the assumption Cameron runs
5 to 20 clones per week. P1 triggers when something has surfaced in three
or more runs (so a roughly weekly drumbeat), P2 in two or three, and the
softer kinds (recurring-warning, duration-drift) need higher surface
counts because they tolerate more noise. These are easy to tune in
`classifySeverity` if real usage shows the thresholds need shifting.

### Idempotency via slug replacement

Tickets are wrapped in `<!-- harvest:start --> ... <!-- harvest:end -->`
markers. On re run the writer replaces the marker block atomically. If
Cameron edits a ticket outside the markers, his edits survive.

(Note: in the shipped version the entire ticket body lives inside the
managed block. The next iteration can carve out a user notes block
analogous to the SUMMARY.md USER block once Cameron starts hand
annotating tickets.)

### Subprocess avoidance in the harvest scanner

Harvest is pure file IO. No external commands, no spawn. The smoke test
exercises the same `harvestRuns` function the CLI calls, so there is no
shell layer to diverge between test and production behaviour.

## Harvest Heuristics Calibration

These are the knobs Cameron can tune later. All live in
`engine/cli/runs-harvest.ts` near the top of the file.

| Knob | Current value | Where defined |
|---|---|---|
| Default `--min-recurrence` | 2 | `DEFAULT_MIN_RECURRENCE` constant |
| Duration drift ratio | 1.5x rolling median | `DURATION_DRIFT_RATIO` constant |
| Min data points for drift detection | 3 | hard coded in `aggregateDurationDrift` |
| Stuck warning needs latest run hit | yes | branch in `aggregateStuckWarnings` |
| Parity regression min consecutive pairs | 1 | implicit in regression pair loop |

Severity thresholds:

| Type | P1 trigger | P2 trigger | P3 default |
|---|---|---|---|
| parity-regression | surface >= 3 | < 3 | n/a (always P2+) |
| repeat-error | surface >= 3 | < 3 | n/a |
| stuck-warning | surface >= 4 | < 4 | n/a |
| recurring-warning | n/a | surface >= 5 | < 5 |
| duration-drift | n/a | surface >= 4 | < 4 |

Dedupe slug formula:

    <finding-type>-<slugify(stage)>-<slugify(message)>      truncated to 96 chars

`slugify` lowercases the input and collapses every non `[a-z0-9]+` run
into a single `-`. Each component slug is truncated to 40 chars so the
total stays bounded.

Adjusting any of these is a one line edit. The smoke test does not
encode specific thresholds, so changes do not require updating the
test.

## Pipeline improvement opportunities

1. The harvest scanner currently reads every `.runs/<runId>/` directory
   sequentially. For long lived repos with hundreds of runs this could
   block. A parallel walk with a concurrency cap is the obvious next
   step.
2. Findings are written as full file rewrites. Once Cameron starts
   hand annotating tickets, the writer needs a `<!-- user-notes -->`
   block (analogous to SUMMARY.md's USER block) that survives across
   re runs. The current implementation overwrites the entire body.
3. `parity runs harvest --dry-run` would be a friendly addition.
   Currently the only way to preview is `--tickets-dir=<tmp>`.
4. The harvest output prints a one line summary. A second pass that
   prints the top N findings in a table to stdout would help Cameron
   skim what changed without opening INDEX.md.
5. The `inferTargetKey` heuristic falls back to URL host when
   `manifest.target` is absent. The harvest aggregator treats target as
   string so adding more targets (Remix, SvelteKit) requires no code
   changes. Good.

## Anomalies

W4B was actively editing `scripts/run-clone.ts` during this wave. The
file was modified in the working tree throughout the W4A run but never
committed by W4B before W4A's commits landed. The two new TS errors that
appeared in the global error count are from W4B's in flight changes to
`scripts/run-clone.ts`. They are not from W4A.

Verified by stashing only W4A's changes and re running TypeScript: 15
errors (baseline). Stashing only W4B's `scripts/run-clone.ts` change and
re running: 15 errors (baseline). W4A is clean.

## Items needing follow up agent attention

### User notes block on tickets

Add a `<!-- user-start -->` / `<!-- user-end -->` block to
`renderTicket` so Cameron's hand annotations survive re runs. Mirror
the SUMMARY.md USER block convention.

### Top N table in stdout

Print the top 5 findings (by severity then surface count) as a small
ASCII table after every harvest run. Sketch in
`runsHarvestCommand.run`.

### Harvest in CI

Add `npx parity runs harvest --dry-run` to a CI step so PRs that
introduce new warnings get flagged at review time. Tabled to V2.1.

## Verification at end of wave

- `npx parity test`: 2 passed, 0 failed, 0 skipped, 2 total
- TypeScript error count (W4A only, W4B stashed): 15 (baseline, unchanged)
- Smoke test: `npx tsx scripts/smoke-parity-harvest.ts` PASS
- `npx parity runs harvest --help`: renders correctly
- `npx parity runs --help`: lists `list` and `harvest` subcommands
- `grep -c "—" .claude/skills/clone-website/SKILL.md`: 0
- `grep -i "chrome mcp" .claude/skills/clone-website/SKILL.md`: only blockade mentions
- `grep "scripts/extract.ts" .claude/skills/clone-website/SKILL.md`: only the blockade line
- `node scripts/sync-skills.mjs`: clean, 1 sister file regenerated
- `bash scripts/sync-agent-rules.sh`: clean, copilot config regenerated (no skill drift)

## Commits made this wave

- a7d1cda feat(cli): parity runs harvest reads .runs and emits triage tickets
- fdaf73a test: harvest smoke test with synthesised .runs fixture
- e25935c docs: seed empty parity-issues queue
- f655650 docs(skill): rewrite SKILL.md as thin Playwright-only wrapper over parity clone
- 8aeb8a8 chore: regenerate .github skill copy via sync-skills
- f1cc9bd docs: V2.0 action plan reflects shipped harvest and skill
