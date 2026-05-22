# example-com-rebuild-pixel

V1 rebuild-pixel-diff proof fixture. Reuses the example.com desktop capture but
runs the full rebuild loop instead of the lightweight manifest-shape check.

## Sequence

1. Read `capture-ref/source.txt` to locate the original clone directory.
2. Rebuild via `astroAdapter.build` into a tmp project.
3. `npm install` then `npm run build` to produce `dist/`.
4. Boot two static servers via `engine/verify/ports.bootServer`: one on the
   original clone, one on the rebuilt dist.
5. Screenshot both at the fixture viewport via
   `engine/verify/screenshots.captureAll`.
6. Pixel diff via `engine/verify/diff.diffShot`. Pass when diffRatio is
   within `1 - parity_threshold`.

## Cost

Each run takes around 85 seconds (npm install dominates). The
rebuild-pixel-diff mode is intentionally opt-in. The other three corpus
fixtures stay on `manifest-shape` for the fast path.

## Re-running

```
npx parity test
```

The runner picks up the comparison mode from `fixture.json#comparison_mode`
and dispatches to `engine/cli/regression/rebuild-pixel-diff.ts`.

Artefacts (screenshots + diff PNG) land under
`tests/fixtures/sites/example-com-rebuild-pixel/rebuild-pixel-diff/<viewport>/`.
That directory is regenerated on every run and is safe to delete.
