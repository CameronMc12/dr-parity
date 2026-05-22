# Fixture: enerblock-net

## What this fixture proves

The Playwright capture plus astro clone pipeline produces a stable
signature for a real-world astro target with assets, scripts, and a
Sanity-backed CDN image fleet.

This is the canonical astro success referenced in
`docs/V2.0/03-targets-audit.md` and `docs/V2.0/05-action-plan.md` as the
example of why the astro path is the most reliable in V2.0.

## What the locked signature is

`expected/clone-manifest.json` captures the clone manifest at promotion:

| Field | Value |
|-------|-------|
| htmlBytes | 58888 |
| styles | 1 |
| scripts | 14 |
| assets | 161 |
| unresolvedExternal | 27 |
| documentUrl | https://enerblock.net/en/faqs/ |

The 27 unresolved external refs are expected. They are Sanity CDN image
variants the capture intentionally does not pre-fetch.

`expected/index-head-200.html` is the first 200 lines of the rendered
clone. Used for structural diffs, not byte-exact gating.

## What a regression would look like

- styles count drops to 0. The CSS extractor stopped collecting external
  stylesheets.
- scripts count drops below 14. The script collector lost references.
- assets count drops materially (more than 5 percent). The asset waiter
  is timing out or the network recorder is missing responses.
- unresolvedExternal grows beyond ~35. The clone rewriter regressed on
  same-origin link resolution.
- htmlBytes drifts more than 5 percent. The HTML pre-render path
  changed.

## How to re-validate manually

```
diff tests/fixtures/sites/enerblock-net/expected/clone-manifest.json \
     docs/research/captures/enerblock.net/2026-05-15T18-07-59-099Z/desktop/clone/manifest.json
```

## How to regenerate

After a deliberate engine change:

```
npm run clone-site -- https://enerblock.net/en/faqs/
```

Then update the expected manifest and fixture.json#captured_at in a
dedicated rebase PR.
