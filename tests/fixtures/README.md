# Regression Corpus

This directory holds the Dr Parity regression corpus. Every engine PR runs
`parity test` against these fixtures. Any drop in parity below the locked
threshold blocks the PR.

## Layout

```
tests/fixtures/
  sites/<slug>/           # gating corpus. Every fixture here gates merges.
    fixture.json          # metadata, locked threshold, comparison mode
    expected/             # the locked output we compare against
    capture-ref/          # pointer to the source capture (path on disk)
    README.md             # what this fixture proves, what a regression looks like
  known-bad/<slug>/       # known failing baselines. Triage targets, NOT gates.
    fixture.json
    notes.md
```

## `fixture.json` schema

```json
{
  "slug": "example-com",
  "target": "astro",
  "url": "https://example.com/",
  "captured_at": "2026-05-14T12:54:35.266Z",
  "parity_threshold": 0.99,
  "comparison_mode": "manifest-shape",
  "notes": "Smallest deterministic astro baseline."
}
```

Fields:

- `slug`: filesystem safe identifier, used as the directory name.
- `target`: astro, react, or webapp.
- `url`: origin URL captured.
- `captured_at`: ISO timestamp of the source capture.
- `parity_threshold`: minimum acceptable score in [0, 1]. Locked at the score
  the fixture achieved when promoted.
- `comparison_mode`: one of bytes, pixel-diff, manifest-shape, or both. V0
  ships manifest-shape (compare the captured clone manifest signature) since
  that gives a stable signature without pinning every byte.
- `notes`: free-form context for human reviewers.

## Comparison modes

- **manifest-shape** (V0 default): re-read the captured clone manifest at
  `capture-ref` and compare key counts (styles, scripts, assets,
  unresolvedExternal, htmlBytes within tolerance) against the locked
  `expected/manifest.json`. Pass if every count matches and htmlBytes is
  within 5%. Cheap, deterministic, no rebuild required.
- **bytes** (V1): byte-for-byte equality on `expected/` files.
- **pixel-diff** (V1): re-run capture + clone, screenshot diff against
  `expected/screenshot.png`.
- **both** (V1): both bytes and pixel-diff must pass.

## How to promote a clone

When a clone achieves the parity threshold (>=0.99 for gating, any score for
known-bad):

1. Pick a slug. Lowercase, hyphenated, no dots. Example: `enerblock-net`.
2. Create `tests/fixtures/sites/<slug>/` (or `known-bad/<slug>/` for
   triage targets).
3. Copy load-bearing files into `expected/`:
   - The clone `manifest.json`
   - The first 200 lines of `index.html` (signature, not full bytes)
   - Any per-target output that uniquely identifies success
4. Record the source location in `capture-ref/source.txt` as the absolute
   path to the capture directory.
5. Write `fixture.json` with the achieved score as `parity_threshold`.
6. Write a `README.md` describing what the fixture proves and what a
   regression in this fixture would look like.

## How to run the gate

```
npx parity test
```

Exits 0 if every fixture passes. Non-zero on any failure. One line per
fixture plus a summary line.

## Known-bad catalogue

`known-bad/` exists to give the harvest loop concrete failing baselines to
triage. These fixtures are NOT run by `parity test` as gates. They are
read by `parity runs harvest` (V2.0 Phase 6) to seed tickets, and by
contributors looking for representative bug shapes.

A fixture moves from `known-bad/` to `sites/` once a fix lands and the
clone reproduces above the parity threshold.
