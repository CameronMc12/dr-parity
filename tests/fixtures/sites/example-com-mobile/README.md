# Fixture: example-com-mobile

## What this fixture proves

The clone pipeline produces a deterministic byte stable output when run at
the mobile viewport, distinct from the desktop baseline. example.com is
small enough to stay deterministic across viewports while still surfacing
viewport specific differences in the HTML payload (the viewport meta tag
content and trace driven serialisation differ between mobile and desktop).

If this fixture ever fails, per viewport capture has lost the ability to
emit a stable signature, which would block the V1 pixel diff comparison
work because per viewport baselines are a prerequisite for V1.

This fixture also sets the precedent for tablet and wide variants. Adding
a `example-com-tablet` or `example-com-wide` sibling should follow the
same layout.

## What the locked signature is

`expected/clone-manifest.json` captures the clone manifest at promotion:

| Field | Value |
|-------|-------|
| viewport | mobile |
| htmlBytes | 567 |
| styles | 0 |
| scripts | 0 |
| assets | 0 |
| unresolvedExternal | 0 |
| documentUrl | https://example.com/ |

`expected/index.html` is the rendered mobile clone for byte reference.

## Why htmlBytes differs from desktop

Desktop fixture locks 552 htmlBytes. Mobile locks 567. The 15 byte delta
comes from the mobile viewport meta tag content emitted into the cloned
document head. This is expected and load bearing for the mobile parity
signal.

## What a regression would look like

- htmlBytes drifts more than 5 percent. The HTML serialiser added or lost
  bytes somehow at the mobile viewport.
- styles, scripts, or assets count changes. The asset collector started
  pulling references it should not.
- unresolvedExternal grows. The clone rewriter lost the ability to
  resolve in document references.
- documentUrl shifts. The capture targeted the wrong URL.
- viewport field on the live manifest no longer reads `mobile`. The
  capture pipeline emitted the wrong viewport label.

## How to re-validate manually

```
diff tests/fixtures/sites/example-com-mobile/expected/clone-manifest.json \
     docs/research/captures/example.com/2026-05-22T10-09-04-071Z/mobile/clone/manifest.json
```

Empty diff means the capture matches the locked mobile baseline.

## How to regenerate

Only regenerate after a deliberate engine change that intentionally shifts
the signature at the mobile viewport. Run:

```
npx parity clone https://example.com --viewport=mobile --no-parity
```

Then copy the new `mobile/clone/manifest.json` over
`expected/clone-manifest.json`, update `fixture.json#captured_at`, and
commit the new baseline in a dedicated PR titled
"fixture(example-com-mobile): rebase against <git-sha>".
