# Fixture: example-com

## What this fixture proves

The Playwright capture plus clone pipeline produces a deterministic, byte
stable output for the simplest possible target. example.com is a single
HTML document with one inline stylesheet, no external assets, no scripts,
and no network dependencies past the initial document fetch.

If this fixture ever fails, the capture or clone pipeline has lost the
ability to produce a stable signature for trivial inputs. That is a
catastrophic regression and should block any merge.

## What the locked signature is

`expected/clone-manifest.json` captures the clone manifest at promotion:

| Field | Value |
|-------|-------|
| htmlBytes | 552 |
| styles | 0 |
| scripts | 0 |
| assets | 0 |
| unresolvedExternal | 0 |
| documentUrl | https://example.com/ |

`expected/index.html` is the rendered clone for byte reference.

## What a regression would look like

- htmlBytes drifts more than 5 percent. The HTML serialiser added or lost
  bytes somehow.
- styles, scripts, or assets count changes. The asset collector started
  pulling references it should not, or stopped pulling references it
  should.
- unresolvedExternal grows. The clone rewriter lost the ability to
  resolve in-document references.
- documentUrl shifts. The capture targeted the wrong URL.

## How to re-validate manually

```
diff tests/fixtures/sites/example-com/expected/clone-manifest.json \
     docs/research/captures/example.com/2026-05-14T12-54-35-266Z/desktop/clone/manifest.json
```

Empty diff means the capture matches the locked baseline.

## How to regenerate

Only regenerate after a deliberate engine change that intentionally shifts
the signature. Run:

```
npm run clone-site -- https://example.com
```

Then copy the new `clone/manifest.json` over `expected/clone-manifest.json`,
update `fixture.json#captured_at`, and commit the new baseline in a
dedicated PR titled "fixture(example-com): rebase against <git-sha>".
