# W1D — Parity CLI Scaffolding

## Citty API Confirmed

- Version installed: `citty@0.2.2` (latest stable as of opensrc cache 2026-05-22).
- Source: `~/.opensrc/repos/github.com/unjs/citty/0.2.2/`.
- Key APIs used:
  - `defineCommand({ meta, args, subCommands, run })` returns a `CommandDef`.
  - `runMain(cmd)` parses `process.argv`, dispatches subcommands, prints help on `--help` / `-h`, prints version on `--version` / `-v`, exits non-zero on unknown flags.
  - Arg types: `positional`, `string`, `boolean` (with `negativeDescription` for the auto-generated `--no-*` variant), `enum` (with `options`).
  - Subcommands nest by passing a `subCommands` map; each value can be a `CommandDef`, a Promise, or an async factory for lazy load.
  - The `meta.version` field is what `runMain` prints on `--version`; the package's own `--version` flag is auto-wired (no extra command required, but I added an explicit `version` subcommand per the brief).
- Citty wraps Node's native `util.parseArgs` so there are zero runtime deps beyond Node 24.

Relevant excerpt (`src/types.ts`):

```ts
export type CommandDef<T extends ArgsDef = ArgsDef> = {
  meta?: Resolvable<CommandMeta>;
  args?: Resolvable<T>;
  default?: Resolvable<string>;
  subCommands?: Resolvable<SubCommandsDef>;
  plugins?: Resolvable<CittyPlugin>[];
  setup?: (context: CommandContext<T>) => any | Promise<any>;
  cleanup?: (context: CommandContext<T>) => any | Promise<any>;
  run?: (context: CommandContext<T>) => any | Promise<any>;
};
```

## Files Created

| File | Role | Lines |
|---|---|---|
| `/Users/cameronmcallister/Github/dr-parity/engine/cli/stage.ts` | `Stage<I,O>`, `RunContext`, `Logger`, `StageResult` interfaces plus `ok` / `warn` / `fail` helpers | 79 |
| `/Users/cameronmcallister/Github/dr-parity/engine/cli/orchestrate.ts` | `runPipeline()` composer with `pipeline_start` / `stage_start` / `stage_end` / `pipeline_end` event emission | 154 |
| `/Users/cameronmcallister/Github/dr-parity/engine/cli/context.ts` | `createRunContext()` plus `generateRunId()` plus stdout `Logger` factory; TODO marker for Phase 5 `.runs/<id>/` writer | 82 |
| `/Users/cameronmcallister/Github/dr-parity/engine/cli/canonical-paths.ts` | Canonical output convention constants and path helpers (`cloneOutDir`, `cloneSubdir`, `viewportDir`, `siteDir`, `defaultTargetFromHost`, `canonicalTimestamp`) | 104 |
| `/Users/cameronmcallister/Github/dr-parity/bin/parity.ts` | Citty entry point; subcommands `clone`, `capture`, `parse`, `clone-static`, `targets list`, `runs list`, `version` | 233 |
| `/Users/cameronmcallister/Github/dr-parity/scripts/smoke-parity-cli.ts` | Smoke runner that exec's the CLI through `npx tsx` and asserts help / version output | 109 |

Modified: `/Users/cameronmcallister/Github/dr-parity/package.json` — added `bin.parity`, `citty@^0.2.2` to dependencies, `smoke:cli` script.

## Stage Interface

Final signatures (verbatim from `engine/cli/stage.ts`):

```ts
export type StageStatus = "ok" | "warn" | "fail";

export interface Logger {
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
  metric(name: string, value: MetricValue, meta?: LogMeta): void;
  event(name: string, fields?: LogMeta): void;
}

export interface RunContext {
  readonly runId: string;
  readonly outDir: string;
  readonly logger: Logger;
  readonly startedAt: number;
}

export interface StageResult<O> {
  readonly status: StageStatus;
  readonly output: O;
  readonly metrics?: Readonly<Record<string, MetricValue>>;
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
}

export interface Stage<I, O> {
  readonly name: string;
  validateInput?(input: I): void | Promise<void>;
  run(input: I, ctx: RunContext): Promise<StageResult<O>>;
}
```

### Decisions

- `Logger.event(name, fields)` is the seam for structured events. Phase 5 will dual-write to `pipeline.jsonl`.
- `StageResult<O>` uses literal `'ok' | 'warn' | 'fail'` (the brief's exact alphabet). Audit 04 C.1 also lists `'partial'`; deferred to Phase 5 so the contract stays minimal until a stage actually needs it.
- `Stage.run` is async-only. No sync escape hatch. Avoids two code paths in the orchestrator.
- The orchestrator stores stages as `Stage<unknown, unknown>` and threads `output -> input`. Heterogeneous chained generics deferred to Phase 5 with a builder pattern. Stage authors enforce input shape via `validateInput`.

## CLI Surface Implemented

| Command | Args | Flags | Status |
|---|---|---|---|
| `parity` (root) | n/a | `--help`, `--version` | wired (citty auto) |
| `parity clone <url> [target]` | `url` (req), `target` (opt) | `--viewport`, `--tour` / `--no-tour`, `--parity` / `--no-parity`, `--parity-threshold`, `--out` | stub |
| `parity capture <url>` | `url` (req) | `--viewport`, `--mode={launch,cdp,persistent}`, `--tour` / `--no-tour`, `--headed`, `--out` | stub |
| `parity parse <captureDir>` | `captureDir` (req) | `--har`, `--trace`, `--all` / `--no-all` | stub |
| `parity clone-static <captureDir>` | `captureDir` (req) | `--viewport`, `--out` | stub |
| `parity targets list` | n/a | n/a | stub |
| `parity runs list` | n/a | `--last`, `--target` | stub |
| `parity version` | n/a | n/a | wired |

All stubs print `stage: <name> (not yet wired)` and exit 0. Help text is rendered by citty; per-command flags are visible via `parity <cmd> --help`.

## Smoke Test Result

Command: `npx tsx scripts/smoke-parity-cli.ts`

Expected output: four PASS lines plus the `All 4 smoke tests passed.` tail.

Actual output:

```
PASS  parity --help
PASS  parity clone --help
PASS  parity version
PASS  parity targets list

All 4 smoke tests passed.
```

Cases covered:

1. `parity --help` exits 0 and lists every top-level subcommand (`clone`, `capture`, `parse`, `clone-static`, `targets`, `runs`, `version`).
2. `parity clone --help` exits 0 and mentions the load-bearing flags (`url`, `viewport`, `tour`, `parity`, `out`). Matching is case-insensitive because citty uppercases positional arg names in help.
3. `parity version` exits 0 and prints `2.0.0` (substring match against `2.0.0-dev`).
4. `parity targets list` exits 0 and prints at least `astro`.

Also verified manually:

- `npx parity --help` works through the `bin` symlink (no `npm link` needed for in-repo invocation).
- `npx parity clone --help` renders the `--no-tour` / `--no-parity` negative variants.

## Parity / Pipeline Improvement Opportunities Spotted

1. **`npm install` pollution of `clones/` subtrees.** Stashed installs in `clones/app.omnisocials.com-*/node_modules/` and `docs/research/captures/.../node_modules/` are visible to the root `tsc` and contribute ~4380 spurious errors against `clones/` Vite types. Phase 1 cleanup already plans to move heavy clone trees out of the repo; recommend adding `clones/**` and `docs/research/**` to `tsconfig.json#exclude` immediately so future agents do not chase ghost type errors. Source-only error count is 15 (baseline) before this task and 15 after, but the noise is severe.
2. **Stage interface vs audit 04 C.1 `partial` status.** The plan lists four statuses (`ok | warn | partial | fail`). I shipped three (`ok | warn | fail`) per the brief. Phase 5 should reintroduce `partial` once `qa-verify` needs to express "some viewports passed, some failed".
3. **`Logger.event` shape.** I implemented event emission as a free-form `(name, fields)` call. Phase 5's `pipeline.jsonl` writer (per audit 04 D.2) will need to layer in typed events (`run_start`, `stage_start`, `stage_end`, `metric`, `warning`, `error`, `artefact`, `decision`, `log`). Recommend defining a `PipelineEvent` discriminated union in `engine/cli/stage.ts` and tightening `event(name, fields)` to `emit(event: PipelineEvent)` so the writer cannot accidentally drop required fields.
4. **No global `--quiet` / `--verbose` / `--json` / `--no-color` / `--run-id` / `--config` flags yet.** Audit 04 B.3 lists these as global. Citty does not have first-class globals, so they will either be repeated on every subcommand or handled via a `plugin`. Recommend a citty plugin (`engine/cli/global-flags.ts`) so they declare once and apply everywhere; deferred to Phase 5.
5. **Canonical-paths `defaultTargetFromHost` heuristic.** Drops only the final label. `app.linear.app` becomes `app-linear`, not the desired `linear-app` from audit 01 Round 2 C.2. The audit's example is ambiguous (host order vs derived order); flagged for Cameron's call in Phase 5.

## Surprises / Anomalies

1. **First `npm install` reported `added 576 packages` but `citty/` did not actually land in `node_modules/`.** Subsequent explicit `npm install citty@0.2.2 --save` succeeded. Possible cause: phantom resolution against a hoisted copy inside `clones/*/node_modules/`. Worth investigating in Phase 1 cleanup.
2. **Pre-existing tsc errors balloon when `npm install` runs.** Without the install: 15 errors. With the install: 4397 errors, almost all from `clones/.../node_modules/vite/...`. The new `vite` hoisted at root conflicts with older copies bundled inside clone outputs. Mitigation: exclude `clones/` and `docs/research/` from `tsconfig.json` (see opportunity 1 above).
3. **Citty 0.2.2 uppercases positional arg names in help output.** Smoke test assertions had to be case-insensitive. Not a bug, just a rendering convention worth noting in Phase 5 CLI docs.
4. **Brief said `engine/cli/cli.test.ts (or wherever existing tests live).`** The repo has no test runner; existing `.spec.ts` files are tsx-run scripts under `engine/tests/`. I followed the brief's fallback and placed `scripts/smoke-parity-cli.ts` instead, wired through `npm run smoke:cli`.
