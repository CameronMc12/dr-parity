# Dr Parity V2.0 — Unified CLI & Pipeline Logging Design

> **Status:** design proposal, no code changes
> **Author:** Agent 4 of the V2.0 audit
> **Scope:** unify every CLI-shaped entry point under a single `parity` binary, and define a structured logging contract every run must emit so Cameron can audit clones and harvest improvements

---

## Part A — Survey Of The Current CLI Surface

### A.1 Inventory

Three categories of entry point exist today, all routed through `tsx` via `npm run …`:

| Category | Count | Examples |
|---|---|---|
| Pipeline drivers (front-doors) | 7 | `scripts/clone-site.ts`, `scripts/clone-urls.ts`, `scripts/run-clone.ts`, `scripts/clone-page.ts`, `scripts/rebuild-pro.ts`, `scripts/build.ts`, `scripts/crawl-webapp.ts` |
| Pipeline stages (low-level) | 11 | `scripts/capture.ts`, `scripts/parse-har.ts`, `scripts/parse-trace.ts`, `scripts/clone.ts`, `scripts/complete-assets.ts`, `scripts/extract.ts`, `scripts/extract-css.ts`, `scripts/extract-tokens.ts`, `scripts/extract-primitives.ts`, `scripts/extract-animations.ts`, `scripts/extract-library.ts` |
| Verification / QA / utilities | ~30 | `scripts/qa.ts`, `scripts/verify-parity.ts`, `scripts/verify-clone.ts`, `scripts/verify-interactions.ts`, `scripts/verify-key-clicks.ts`, `scripts/verify-key-clicks-v2.ts`, `scripts/verify-tabs-and-toasts.ts`, `scripts/verify-toast.ts`, `scripts/verify-posts-menu.ts`, `scripts/audit-capture.ts` (4 subcommands: shell/plan/execute/run), `scripts/auth-verify.ts`, `scripts/login-omni.ts`, `scripts/inspect-live.ts`, `scripts/inspect-selector-resolution.ts`, `scripts/capture-form-states.ts`, `scripts/recapture-routes.ts`, `scripts/build-html-mirror.ts`, `scripts/iconify-svgs.ts`, `scripts/scope-styles.ts`, `scripts/centralize-content.ts`, `scripts/refactor-sections.ts`, `scripts/generate-edit-playbook.ts`, `scripts/generate-prototype.ts`, `scripts/generate-astro.ts`, `scripts/build-astro.ts`, `scripts/qa-sections.ts`, `scripts/emit-only.ts`, `scripts/extract-multi.ts`, `scripts/check-*` (5 checkers), `scripts/sync-skills.mjs`, `scripts/download-assets.mjs` |

**Total CLI-shaped entry points surveyed: 48** (`scripts/*.ts` + 2 `.mjs`).

The root-level diagnostic files the audit brief mentioned (`auto-probe.mjs`, `full-diag.mjs`, `test-login.mjs`) are **not present in the repo**. No `bin/` directory or `package.json#bin` is declared either; nothing actually publishes a binary today.

### A.2 Surface-level observations per entry point

For each major front-door:

| Script | Arg parser | Flag style | --help | Manifest emitted | Exit codes | Notable quirks |
|---|---|---|---|---|---|---|
| `scripts/capture.ts` | hand-rolled | `--foo=bar` | yes (HELP_TEXT) | `manifest.json` per run | 0 ok / 1 fatal-or-all-failed | `--mode={launch,cdp,persistent}`, `--headed` boolean, mutates exit code based on per-viewport `ok` flags |
| `scripts/clone-site.ts` | hand-rolled | `--foo=bar` | yes | `site-clone-manifest.json` + `.crawl-state.json` | 0 ok / 1 err / 2 usage | Has its own `--resume` semantics; spawns child `npx tsx` processes for every stage |
| `scripts/clone-urls.ts` | hand-rolled | `--foo=bar` | yes | `urls-clone-manifest.json` + `.clone-urls-state.json` | 0/1/2 | Resume via `.clone-urls-state.json`; supports both `--urls=<file>` and repeatable `--url=`; has parity gate flag set |
| `scripts/run-clone.ts` | hand-rolled | `--foo=bar` | yes | none (phase timings only) | 0/1/2 | Spawns child processes; prints phase timings; superset of `clone-page.ts` |
| `scripts/clone-page.ts` | none — passthrough | n/a | yes | n/a | inherits | Thin spawn shim over `run-clone.ts` |
| `scripts/parse-har.ts` | trivial | positional only | no (`Usage:` line) | `asset-manifest.json` + `skipped.json` | 0/1 | Auto-detects `network.har` vs `network.json` |
| `scripts/parse-trace.ts` | trivial | positional only | no | `trace-manifest.json` | 0/1 | Same shape as parse-har |
| `scripts/clone.ts` | hand-rolled | `--foo=bar` | yes | per-viewport `manifest.json` | 0/1/2 | Discovers viewports from disk |
| `scripts/complete-assets.ts` | hand-rolled | `--foo=bar` | yes | per-viewport `completion-manifest.json` (implicit) | 0/1 | Best-effort, continues on failure |
| `scripts/build.ts` | hand-rolled | `--foo=bar` (some long+short variants) | yes | per-build summary printed only | 0/1/2 | Multi-target dispatcher (astro/react/webapp); supports both `--out=` and `--out-dir=`, both `--clone-dir=` and bare positional |
| `scripts/crawl-webapp.ts` | hand-rolled | `--foo=bar` | yes | crawler-internal | 0/1 | Different output convention: `docs/research/crawl/<host>/<iso>/` |
| `scripts/audit-capture.ts` | hand-rolled | `--foo=bar` + subcommand verb | partial | yes | 0/1 | The **only** existing script with a subcommand structure (`shell | plan | execute | run`); closest cousin to the V2.0 design |
| `scripts/qa.ts` | hand-rolled | **`--flag value`** (positional) | yes (USAGE) | per-run reports | 0/1 | **Outlier** — uses `--clone-url <url>` not `--clone-url=<url>`. Inconsistent with every other script. |
| `scripts/verify-parity.ts` | hand-rolled | `--foo=bar` | yes | `report.json` + `report.md` | 0 pass / 1 fail | Pixel-diff with viewport list |
| `scripts/rebuild-pro.ts` | hand-rolled | `--foo=bar` (+ flags w/o `=`) | yes | per-phase JSON snapshots | 0/1/2 | The kitchen-sink orchestrator; can re-enter `clone-site.ts` and `build.ts` based on flags |
| `scripts/extract.ts` | hand-rolled | mixed `--foo=bar` & `--no-cache` | partial (Usage line) | extraction JSON tree | 0/1 | The original "legacy" extractor referenced by the skill |
| `scripts/extract-css.ts`, `extract-tokens.ts`, `extract-primitives.ts`, `extract-animations.ts`, `extract-library.ts` | hand-rolled | `--foo=bar` | per-script | per-script JSON outputs | 0/1 | Analysis-stage scripts |
| `scripts/verify-*` family (8 files) | hand-rolled | inconsistent — some `--foo=bar`, some `--foo value`, some positional-only | mixed | mixed | mixed | Ad-hoc one-off verifications, mostly Omnisocials-specific |
| `scripts/check-*` family (5 files) | hand-rolled | trivial / positional | mostly absent | none | 0/1 | Lint-style smoke tests, not user-facing |
| `scripts/download-assets.mjs`, `sync-skills.mjs` | none | n/a | no | n/a | 0/1 | One-shot scripts, no flags |
| `.claude/skills/clone-website/SKILL.md` | n/a (instructions) | calls `scripts/extract.ts` and `scripts/capture.ts` directly | n/a | n/a | n/a | Hard-codes script paths; will need updating to call `parity ...` |

### A.3 Pattern findings

1. **Flag style is _mostly_ `--key=value`** with a few outliers (`scripts/qa.ts` uses `--key value` separated; `scripts/build.ts` accepts both `--out=` and `--out-dir=`; boolean flags are inconsistent: `--no-tour` vs `--force` vs `--dry-run` vs `--headed`).
2. **Every front-door re-invents the same things** — URL validation, ISO timestamp generation (`new Date().toISOString().replace(/[:.]/g, '-')` is duplicated in `capture.ts`, `build.ts`, `crawl-webapp.ts`, `audit-capture.ts`), hostname extraction, "find newest subdir" logic (`clone-site.ts`, `clone-urls.ts`, `run-clone.ts` all have a `newestSubdir()` function with subtly different filters), and "spawn npx tsx scripts/X.ts" boilerplate.
3. **Front-doors invoke each other via `child_process.spawn`** rather than direct function calls. `clone-site.ts` → spawns `capture.ts`, `parse-har.ts`, `parse-trace.ts`, `complete-assets.ts`, `clone.ts`. `clone-urls.ts` does the same. `run-clone.ts` does the same. This is brittle — argument plumbing breaks silently — and impossible to log coherently because each child process has its own stdout stream.
4. **Help is inconsistent** — most scripts have a `HELP_TEXT` constant; a few only have a one-line `Usage:`; some have nothing. Spelling/casing is inconsistent (`dr-parity capture` vs `dr-parity clone-site (autonomous multi-page)` vs no banner at all).
5. **Manifest formats are ad-hoc** — `capture.ts/manifest.json`, `clone.ts/clone/manifest.json`, `clone-site.ts/site-clone-manifest.json`, `clone-urls.ts/urls-clone-manifest.json`, `parse-har.ts/asset-manifest.json`, `parse-trace.ts/trace-manifest.json`, `audit-capture.ts/audit-summary.json`. No shared schema, no run-level umbrella manifest, no command/git context.
6. **Exit codes are inconsistent** — most scripts use `0 ok / 1 fatal`; some use `2` for usage errors (`clone-site.ts`, `clone-urls.ts`, `build.ts`, `clone.ts`); `verify-parity.ts` explicitly documents `0 pass / 1 fail or error`; `crawl-webapp.ts` does not document exit codes at all.
7. **State/resume primitives exist but are bespoke** — `.crawl-state.json` (clone-site), `.clone-urls-state.json` (clone-urls), checkpoint manager (extract.ts). No shared notion of a "run".
8. **Logging is `console.log` everywhere.** No timestamps, no levels, no JSON option, no run id. Output is piped through `stdio: 'inherit'` from spawned children, so it cannot be captured cleanly per-stage.

---

## Part B — Proposed `parity` CLI

### B.1 Design goals

1. **One binary, one mental model.** `parity <noun> <verb> [...flags]`.
2. **Nothing regresses.** Every existing entry point keeps its capability under a new name.
3. **Stages are first-class.** A user can run the full pipeline _or_ any single stage and the run manifest reflects both equivalently.
4. **In-process, not subprocess.** The CLI calls library functions directly. Spawning is reserved for sandboxed external tools (Playwright browsers, `serve`).
5. **Discoverable.** `parity` with no args prints the command tree; `parity <cmd> --help` prints flags. Tab completion works.
6. **Pluggable targets.** Adding a new framework target (e.g. Remix, SvelteKit) is an adapter registration, not a new script.

### B.2 Command tree

```
parity                              # banner + command tree

# === Top-level verbs (the 80% surface) ===
parity clone <url> [...flags]       # = today's clone-page / run-clone (single page, all stages)
parity clone-site <url> [...flags]  # = today's clone-site (autonomous crawl + emit)
parity clone-urls --urls=<file>     # = today's clone-urls (explicit URL list + emit)

# === Pipeline stages (composable, 1:1 with today's scripts) ===
parity capture <url> [...flags]            # = capture.ts
parity parse <capture-dir> [--har|--trace|--all]  # = parse-har.ts + parse-trace.ts
parity complete-assets <capture-dir> [...]        # = complete-assets.ts
parity stage clone <capture-dir> [...]            # = clone.ts (renamed to avoid shadowing top-level `clone`)
parity build <clone-dir> --target=<...> [...]     # = build.ts
parity emit-only <capture-root> --target=<...>    # = scripts/emit-only.ts + rebuild-pro --emit-only

# === Analysis (extract / inspect) ===
parity analyze css <clone-dir>                    # = extract-css.ts
parity analyze tokens <clone-dir>                 # = extract-tokens.ts
parity analyze primitives <clone-dir>             # = extract-primitives.ts
parity analyze animations <clone-dir>             # = extract-animations.ts
parity analyze library <clone-dir>                # = extract-library.ts
parity analyze legacy <url> [...]                 # = extract.ts (original pipeline, kept for skill compat)

# === Web app crawl (separate from `clone-site`) ===
parity webapp crawl <start-url> [...]             # = crawl-webapp.ts
parity webapp audit shell <start-url> [...]       # = audit-capture.ts shell
parity webapp audit plan <audit-dir>              # = audit-capture.ts plan
parity webapp audit execute <audit-dir> [...]     # = audit-capture.ts execute
parity webapp audit run <start-url> [...]         # = audit-capture.ts run
parity webapp login <url> [...]                   # = login-omni.ts
parity webapp auth-verify <url> [...]             # = auth-verify.ts

# === QA / parity gates ===
parity qa run <original-url> [...]                # = qa.ts (re-flagged to use --key=value)
parity qa verify <clone-dir> --rebuilt=<dir>      # = verify-parity.ts
parity qa hover <url> [...]                       # = parts of qa.ts (hover diff alone)
parity qa interactions <url> [...]                # = verify-interactions.ts
parity qa clicks <url> [...]                      # = verify-key-clicks.ts (v2 = default)

# === Refactor / post-emit (Astro polish) ===
parity refactor sections <project-dir>            # = refactor-sections.ts
parity refactor scope-styles <project-dir>        # = scope-styles.ts
parity refactor centralize <project-dir>          # = centralize-content.ts
parity refactor iconify <project-dir>             # = iconify-svgs.ts
parity refactor edit-playbook <project-dir>       # = generate-edit-playbook.ts
parity rebuild-pro <clone-dir> [...]              # = rebuild-pro.ts (kept as a top-level for now)

# === Targets / registry inspection ===
parity targets list                       # prints available framework targets (astro, react, webapp)
parity targets info <name>                # capabilities of the adapter

# === Run / log management ===
parity runs list [--target=<host>] [--last=N]    # list recent runs from .runs/ index
parity runs show <run-id>                        # print run manifest + SUMMARY.md path
parity runs open <run-id>                        # open the run dir in $EDITOR / Finder
parity runs prune [--keep=N] [--older-than=14d]  # cleanup helper for clones/ + .runs/
parity logs tail [--run=<id>]                    # live-tail the latest pipeline.jsonl

# === Self-check ===
parity doctor                             # checks Node, Playwright, ffmpeg, chrome path, etc.
parity --version
parity --help / parity <cmd> --help
```

### B.3 Flag conventions

**Adopt `--key=value` exclusively** (matches the dominant existing style; `qa.ts` is the lone outlier and gets migrated).

- Booleans: `--flag` to enable, `--no-flag` to disable (matches today's `--no-tour`, `--no-preview`). Never `--flag=true`.
- Short flags: only `-h` (help) and `-v` (version) globally. No other single-letter aliases.
- Repeatable flags: `--url=https://a --url=https://b` (keep today's pattern).
- List flags: `--viewport=desktop,mobile,wide` (comma-separated). `all` keeps its sentinel meaning.
- Positional first, flags after, **but flags accepted anywhere** (the lib should support both orders).
- Unknown flags ALWAYS error with a clear message; never silently ignored.
- Global flags accepted by every command:
  - `--out=<dir>` — base output dir (default `clones/` for builds, `docs/research/captures/` for raw captures, configurable)
  - `--quiet` / `--verbose` — log level
  - `--json` — switch human-readable stdout to NDJSON event stream
  - `--no-color`
  - `--run-id=<id>` — override autogenerated run id (useful for resume + retries)
  - `--config=<path>` — load a config file (see B.5)
  - `--dry-run` — plan + emit logs but skip side effects
  - `--no-log` — skip writing the run manifest (escape hatch; defaults to on)

### B.4 Help and discoverability

```
$ parity
parity 2.0.0 — 1:1 website cloning engine

USAGE
  parity <command> [...flags]

CLONE (high-level)
  clone <url>            Single-page capture + clone
  clone-site <url>       Crawl entire site and emit a multi-page project
  clone-urls --urls=...  Clone an explicit URL list

PIPELINE (stages)
  capture <url>          Run Playwright capture for one URL
  parse <capture-dir>    Parse network HAR + trace into structured assets
  build <clone-dir>      Build framework project from a clone

WEBAPP
  webapp crawl ...       BFS-crawl an authenticated web app
  webapp audit ...       Three-phase deterministic audit (shell/plan/execute)

ANALYZE
  analyze css|tokens|primitives|animations|library|legacy

QA
  qa run|verify|hover|interactions|clicks

REFACTOR
  refactor sections|scope-styles|centralize|iconify|edit-playbook

MANAGEMENT
  targets list|info
  runs list|show|open|prune
  logs tail
  doctor

For per-command help:
  parity <command> --help

Docs: docs/V2.0/  •  Skill: .claude/skills/clone-website/
```

Per-command `--help` follows a single template (NAME, USAGE, ARGUMENTS, FLAGS, EXAMPLES, EXIT CODES, RELATED).

### B.5 Config resolution

A `parity.config.ts` (or `.json`) in the project root, looked up via cosmiconfig-style walk:

```ts
// parity.config.ts
import { defineConfig } from 'parity'

export default defineConfig({
  outDir: 'clones',
  capture: {
    mode: 'launch',
    viewports: ['desktop', 'mobile'],
    tour: true,
  },
  clone: {
    parityThreshold: 0.02,
    target: 'astro',
  },
  webapp: {
    userDataDir: '~/.config/playwright-pinterest',
    blocklist: 'docs/blocklists/default.txt',
  },
  targets: {
    'omnisocials.com': {
      blocklist: 'docs/blocklists/omnisocials.txt',
      pathPrefix: '/en',
      viewport: { width: 1440, height: 900 },
    },
  },
  logs: {
    dir: '.runs',
    retention: { keep: 50, olderThanDays: 30 },
  },
})
```

Precedence: CLI flag > env var (`PARITY_*`) > config file > built-in default.

Per-target overrides keyed by hostname feed into `parity clone-site https://omnisocials.com` automatically.

### B.6 Recommended implementation library

**Pick: `citty`** (the CLI library powering Nuxt, Nitro, unjs).

One-sentence reason: citty is dependency-light, ESM-native, TypeScript-first, supports nested subcommand trees naturally, has built-in argument typing, and matches the existing Node 24 + tsx + ESM stack with zero impedance.

Quick comparison:

| Lib | Fit | Notes |
|---|---|---|
| **citty** | recommended | small (≈10kb), nested subcommands, types-first, no decorators, easy to test |
| commander | acceptable | most popular, but its subcommand DSL gets unwieldy past ~10 commands |
| yargs | acceptable | very mature, but heavy and its types are awkward; chainable API is wordy |
| cac | possible | minimal and nice, but subcommand grouping is weaker than citty |
| clipanion | over-engineered | best for very large CLIs (Yarn, etc.); too much ceremony here |
| oclif | overkill | plugin architecture we don't need; pulls in heroku-cli baggage |

Citty also gives us tab-completion generation for free (`citty/utils/completion`), which is a nice secondary win.

### B.7 Migration path (zero regression)

| Today | Tomorrow |
|---|---|
| `npm run capture -- <url>` | `parity capture <url>` |
| `npm run clone-site -- <url>` | `parity clone-site <url>` |
| `npm run clone-urls -- --urls=urls.txt` | `parity clone-urls --urls=urls.txt` |
| `npm run clone-end-to-end -- <url>` | `parity clone <url>` |
| `npm run parse:har -- <dir>` | `parity parse <dir> --har` |
| `npm run parse:trace -- <dir>` | `parity parse <dir> --trace` |
| `npm run parse:all -- <dir>` | `parity parse <dir> --all` |
| `npm run complete:assets -- <dir>` | `parity complete-assets <dir>` |
| `npm run clone -- <dir>` | `parity stage clone <dir>` |
| `npm run build:astro -- <dir>` | `parity build <dir> --target=astro` |
| `npm run build:react -- <dir>` | `parity build <dir> --target=react` |
| `npm run build:webapp -- ...` | `parity build --target=webapp --crawl-dir=...` |
| `npm run build:react:multi -- ...` | `parity clone-urls --target=react ...` |
| `npm run build:astro:multi -- ...` | `parity clone-urls --target=astro ...` |
| `npm run crawl:webapp -- <url>` | `parity webapp crawl <url>` |
| `npm run audit:shell -- <url>` | `parity webapp audit shell <url>` |
| `npm run audit:plan -- <dir>` | `parity webapp audit plan <dir>` |
| `npm run audit:execute -- <dir>` | `parity webapp audit execute <dir>` |
| `npm run audit:capture -- <url>` | `parity webapp audit run <url>` |
| `npm run extract:css -- <dir>` | `parity analyze css <dir>` |
| `npm run extract:tokens -- <dir>` | `parity analyze tokens <dir>` |
| `npm run extract:primitives -- <dir>` | `parity analyze primitives <dir>` |
| `npm run extract:animations -- <dir>` | `parity analyze animations <dir>` |
| `npm run extract:library -- <dir>` | `parity analyze library <dir>` |
| `npm run verify:parity -- ...` | `parity qa verify ...` |
| `npm run test:parity:astro` | `parity qa verify --target=astro --fixture=...` |
| `npm run test:parity:react` | `parity qa verify --target=react --fixture=...` |
| `npm run rebuild-pro -- <dir>` | `parity rebuild-pro <dir>` |
| `npm run capture:forms -- <url>` | `parity webapp capture-forms <url>` |
| `npm run iconify:svgs -- <dir>` | `parity refactor iconify <dir>` |
| `npm run scope:styles -- <dir>` | `parity refactor scope-styles <dir>` |
| `npm run centralize:content -- <dir>` | `parity refactor centralize <dir>` |
| `npm run refactor:sections -- <dir>` | `parity refactor sections <dir>` |
| `npm run generate:edit-playbook -- <dir>` | `parity refactor edit-playbook <dir>` |
| `scripts/login-omni.ts <url>` | `parity webapp login <url>` |
| `scripts/auth-verify.ts <url>` | `parity webapp auth-verify <url>` |
| `scripts/inspect-live.ts` | `parity webapp inspect <url>` |
| `scripts/verify-interactions.ts` | `parity qa interactions <url>` |
| `scripts/verify-key-clicks.ts` (v1+v2) | `parity qa clicks <url>` (v2 default) |
| `scripts/verify-tabs-and-toasts.ts` | `parity qa interactions <url> --pattern=tabs-toasts` |
| `scripts/verify-toast.ts` | `parity qa interactions <url> --pattern=toasts` |
| `scripts/verify-posts-menu.ts` | `parity qa interactions <url> --pattern=posts-menu` |
| `scripts/check-*.ts` (5 checkers) | `parity self-test` (dev-only, hidden from main help) |
| `scripts/sync-skills.mjs` | retained as a repo dev script; not a `parity` verb |
| `scripts/download-assets.mjs` | absorbed into `parity capture` (it's just legacy bootstrap) |
| `.claude/skills/clone-website/SKILL.md` | rewritten to call `parity clone-site <url>` (see B.8) |

**Implementation order to keep zero regression:**

1. Build `parity` as a thin facade that imports the existing script `main()` functions. Each script gets refactored to export `runX(argv: string[])` and the CLI dispatches to it. No behaviour change, just a new entrypoint.
2. Keep every existing `npm run …` working by aliasing them in `package.json` to `parity …`. e.g. `"capture": "parity capture"`.
3. Once all entry points are routed through `parity`, normalise flag styles and consolidate duplicated helpers (`newestSubdir`, `hostnameOf`, `isoStamp`, `formatBytes`).
4. Add the logging layer (Part C). At this point all logs flow through one writer.
5. Delete the spawn-based orchestration in `clone-site.ts` / `clone-urls.ts` / `run-clone.ts` and replace with direct function calls. This is the biggest win for log fidelity.

### B.8 `/clone-website` skill compatibility

The skill becomes a thin shell that:

1. Validates URL(s) and any user instructions.
2. Runs `parity doctor` to confirm prerequisites.
3. Calls `parity clone-site <url> --target=astro --json` (or `parity clone <url>` for single-page).
4. Reads the resulting `<run-dir>/SUMMARY.md` and presents it back to the user.
5. Optionally invokes `parity qa verify ...` for the fine-tune loop.
6. Honours the existing argument-hint contract (`<url1> [<url2> ...]`) by issuing one `parity clone-site` per URL (in parallel where independent).

Skill update is a single file edit. Today's hard-coded `scripts/extract.ts` and `scripts/capture.ts` references collapse into one `parity ...` invocation.

---

## Part C — Pipeline Logging Contract

### C.1 Goals

- Every `parity` invocation is a **Run** with a unique id and a durable directory.
- Every Run captures enough context to (a) reproduce, (b) audit the clone quality, and (c) feed bug-fix opportunities back into Dr Parity itself.
- Cameron can keep just the human-readable `SUMMARY.md` after he moves the heavy clone artefacts out of the repo.
- The machine-readable layer is rich enough that a follow-up Claude session can read it and propose changes to Dr Parity without re-running anything.

### C.2 Storage layout

```
.runs/                                  # gitignored; per-repo runs index
  index.jsonl                           # append-only, one line per run (run-id, target, cmd, finishedAt, status)
  <run-id>/                             # one dir per run
    manifest.json                       # top-level run manifest (schema below)
    pipeline.jsonl                      # NDJSON event stream
    SUMMARY.md                          # human-readable digest (kept after pruning)
    stages/
      capture.json                      # per-stage structured result
      capture.stdout.log                # raw stdout/stderr captured from that stage
      capture.stderr.log
      parse-har.json
      parse-trace.json
      clone.json
      complete-assets.json
      build.json
      qa.json
    artefacts/                          # symlinks (preferred) or copies of key output paths
      capture-dir -> ../../docs/research/captures/<host>/<iso>/
      clone-dir   -> ../../clones/<host>-<iso>/
      project-dir -> ../../clones/<host>-<iso>/astro-site/
    screenshots/                        # small sampled set for SUMMARY.md (full-page thumbs)
      before-original.png
      after-clone.png
      parity-diff.png
    env.json                            # node version, OS, git sha, playwright version, parity version
```

`<run-id>` format: `<ISO-timestamp>-<host>-<short-hash>` e.g. `2026-05-22T14-30-12-omnisocials-com-7a3f`. Sortable, greppable, unique.

A symlink `clones/<host>-<iso>/.run-id` points back at the matching `.runs/<run-id>/` so Cameron can trivially trace any clone to its log.

### C.3 Run manifest schema (`manifest.json`)

```json
{
  "schemaVersion": 1,
  "runId": "2026-05-22T14-30-12-omnisocials-com-7a3f",
  "command": "parity clone-site https://omnisocials.com --target=astro",
  "argv": ["clone-site", "https://omnisocials.com", "--target=astro"],
  "config": {
    "resolved": "parity.config.ts",
    "applied": { "outDir": "clones", "target": "astro", "...": "..." }
  },
  "target": {
    "kind": "website",
    "url": "https://omnisocials.com",
    "host": "omnisocials.com"
  },
  "environment": {
    "parityVersion": "2.0.0",
    "nodeVersion": "v24.0.0",
    "os": "darwin 25.4.0",
    "playwrightVersion": "1.58.2",
    "gitSha": "abc1234",
    "gitBranch": "prototype-mode",
    "gitDirty": false
  },
  "timing": {
    "startedAt": "2026-05-22T14:30:12.123Z",
    "finishedAt": "2026-05-22T14:42:55.901Z",
    "durationMs": 763778
  },
  "stages": [
    {
      "name": "crawl",
      "status": "ok",
      "startedAt": "...",
      "durationMs": 28100,
      "inputs": { "entryUrl": "...", "maxPages": 50, "maxDepth": 3 },
      "outputs": { "urls": 17, "skipped": 3, "manifest": "docs/research/captures/.../site-clone-manifest.json" },
      "metrics": { "urlsDiscovered": 17, "robotsBlocked": 0 },
      "warnings": [],
      "errors": []
    },
    {
      "name": "capture",
      "status": "ok",
      "durationMs": 412000,
      "perPage": [
        { "url": "https://omnisocials.com/", "ok": true, "viewports": 4, "harBytes": 12483920, "harEntries": 184, "traceBytes": 8412300 }
      ],
      "metrics": { "totalHarBytes": 89321204, "totalAssetCount": 1832, "lazyLoadSteps": 247 }
    },
    { "name": "parse-har", "status": "ok", "durationMs": 18400, "metrics": { "styles": 42, "scripts": 87, "assets": 1703, "skipped": 12 } },
    { "name": "parse-trace", "status": "ok", "durationMs": 6200, "metrics": { "snapshots": 89, "errors": 0 } },
    { "name": "complete-assets", "status": "warn", "durationMs": 14100, "warnings": [{ "url": "https://cdn.example/missing.woff2", "reason": "404" }] },
    { "name": "clone", "status": "ok", "durationMs": 8200, "metrics": { "viewports": 4, "htmlBytes": 142000, "unresolvedExternal": 4 } },
    { "name": "build", "status": "ok", "durationMs": 76000, "outputs": { "projectDir": "clones/omnisocials.com-2026-...../astro-site" } },
    { "name": "qa-verify", "status": "fail", "durationMs": 198000, "metrics": { "passed": 2, "failed": 2, "viewports": 4, "worstDiffRatio": 0.043, "threshold": 0.02 } }
  ],
  "outcome": {
    "status": "partial",
    "parityScore": 0.957,
    "passed": ["mobile", "tablet"],
    "failed": ["desktop", "wide"],
    "primaryArtefact": "clones/omnisocials.com-2026-...../astro-site",
    "summaryPath": ".runs/2026-05-22T14-30-12-omnisocials-com-7a3f/SUMMARY.md"
  },
  "issues": [
    { "id": "ISSUE-001", "severity": "warn", "stage": "complete-assets", "kind": "asset-missing", "message": "1 font failed to fetch", "url": "https://cdn.example/missing.woff2" },
    { "id": "ISSUE-002", "severity": "fail", "stage": "qa-verify", "kind": "parity-threshold", "viewport": "desktop", "diff": 0.043, "threshold": 0.02 }
  ]
}
```

Schema is versioned (`schemaVersion`). Any later format change bumps the version and ships a migration in the same release.

### C.4 Event stream (`pipeline.jsonl`)

Every CLI action emits a line. NDJSON is greppable, streamable, and tail-able. Every line has:

```json
{ "t": "2026-05-22T14:30:12.456Z", "lvl": "info", "stage": "capture", "url": "https://omnisocials.com/", "msg": "tour complete", "meta": { "scrollSteps": 42, "heightPx": 8412 } }
```

Levels: `debug | info | warn | error | fatal`. `--verbose` enables `debug`, `--quiet` mutes `info` (still writes them to the file). The same writer feeds:

- the human stdout (formatted, coloured)
- the per-stage `*.stdout.log` (raw)
- `pipeline.jsonl` (structured)

When `--json` is set on stdout, the formatted layer is skipped and NDJSON goes straight to stdout instead.

### C.5 The human-readable `SUMMARY.md`

This is the artefact Cameron keeps after moving the heavy clone elsewhere. Generated at the end of every run.

```markdown
# Run 2026-05-22 — omnisocials.com (clone-site, astro)

**Status:** partial (2/4 viewports passed parity)
**Duration:** 12m 43s
**Command:** `parity clone-site https://omnisocials.com --target=astro`
**Run id:** `2026-05-22T14-30-12-omnisocials-com-7a3f`

## Outcome

| Viewport | Parity diff | Threshold | Status |
|---|---|---|---|
| mobile  | 0.4%  | 2% | pass |
| tablet  | 1.1%  | 2% | pass |
| desktop | 4.3%  | 2% | FAIL |
| wide    | 3.8%  | 2% | FAIL |

## Pipeline timing

| Stage | Duration | Status |
|---|---|---|
| crawl            | 28.1s | ok |
| capture          | 6m 52s | ok |
| parse-har        | 18.4s | ok |
| parse-trace      | 6.2s | ok |
| complete-assets  | 14.1s | warn (1 missing font) |
| clone            | 8.2s  | ok |
| build (astro)    | 1m 16s | ok |
| qa-verify        | 3m 18s | FAIL (2 viewports) |

## Issues encountered

1. **complete-assets / asset-missing** — 1 font (`cdn.example/missing.woff2`) returned 404 during the post-capture asset sweep. Clone still ships; font falls back to next family in stack.
2. **qa-verify / parity-threshold** — desktop & wide viewports exceed the 2% pixel-diff threshold. Worst diff is a 18px vertical offset in the hero section; likely a missing `@media` rule for the 1440px+ breakpoint.

## Suggested Dr Parity improvements

1. `complete-assets` should retry 404s with `https://` if `http://` was used, and vice-versa, before giving up.
2. The clone post-emit pipeline does not currently re-fold @media rules above 1280px width — see issue ISSUE-002 viewport diff. Worth investigating `engine/clone/css-rewriter.ts` for a viewport-clamp bug.
3. The parity threshold is global. A per-viewport threshold would let us pass mobile/tablet while still flagging desktop/wide.

## Artefacts

- Capture: `docs/research/captures/omnisocials.com/2026-05-22T14-30-12...`
- Clones (per page, per viewport): `docs/research/captures/.../<viewport>/clone/`
- Astro project: `clones/omnisocials.com-2026-05-22T14-30-12-755Z/astro-site/`
- Parity report (JSON): `clones/.../astro-site/parity-report.json`
- Diff screenshots: `.runs/<run-id>/screenshots/`

## Reproduce

```
parity clone-site https://omnisocials.com --target=astro --run-id=<new>
```

---

_Generated by Dr Parity 2.0.0 • Git abc1234 (prototype-mode) • Node v24_
```

The "Suggested Dr Parity improvements" section is autogenerated from the structured `issues[]` block plus a small mapping table (issue kind → heuristic suggestion). Cameron edits this section by hand when he reviews; his edits are preserved on re-run (the generator writes between `<!-- AUTO-START -->` / `<!-- AUTO-END -->` markers).

### C.6 Self-improvement loop

Workflow Cameron follows after each run:

1. **Inspect** — `parity runs show <id>` opens `SUMMARY.md`. Cameron skims status, parity table, issues.
2. **Triage** — for any issue that's actionable inside Dr Parity (not the target site's fault), Cameron annotates the issue inline in `SUMMARY.md` under "Suggested Dr Parity improvements". He may add severity, target file, and a short repro.
3. **Harvest** — a `parity runs harvest <id>` command (deferred, V2.1) emits per-issue tickets to a `docs/parity-issues/` queue, ready for the next Claude session to open as proper bug fixes.
4. **Archive** — when the clone is good enough, Cameron moves the heavy artefacts out:
   ```bash
   parity runs archive <id> --keep=summary
   # moves clones/<...>/ to ~/Archive/parity-clones/
   # keeps .runs/<run-id>/SUMMARY.md, manifest.json, screenshots/
   # deletes pipeline.jsonl + stages/*.stdout.log + stages/*.stderr.log
   ```
   `.runs/index.jsonl` retains the row so the run is still listed.
5. **Replay** — re-running the same command with `--run-id=<old-id>` writes to a sibling run dir and links to it from the original for diffing.

This loop is the whole point of Part C: every run leaves a small, durable artefact that a future Claude session can read, understand, and turn into Dr Parity improvements without needing the original clone.

### C.7 Retention policy

Default config:

```ts
logs: {
  dir: '.runs',
  retention: {
    keep: 50,                 // always keep the most recent 50 runs
    olderThanDays: 30,        // anything older than 30 days is eligible for prune
    keepSummaries: true,      // even pruned runs keep SUMMARY.md + manifest.json
    keepArchived: 'forever',  // archived runs (via runs archive) are never auto-pruned
  },
}
```

`parity runs prune` enforces this. It also cleans matching `clones/<host>-<iso>/` directories that have no matching run id (i.e. orphaned clones from before V2.0).

### C.8 What changes in existing code

Minimal disruption path:

1. New `engine/logging/` module exporting `createRunLogger({ runId, dir })` returning `{ stage(name): StageLogger, emit(event), finalize() }`.
2. Every `parity <cmd>` wraps its work in `withRun(cmd, async (run) => {...})`. Stages call `run.stage('capture').info(msg, meta)` etc.
3. Existing scripts get refactored to take a `RunLogger` instead of using `console.log` directly. The console.log calls become `log.info` / `log.warn` / `log.error`. Same human output, plus the structured side.
4. Manifest emission moves from per-script files to the unified `manifest.json`. The per-stage manifests (e.g. `asset-manifest.json`, `trace-manifest.json`) stay where they are — they're capture-tree artefacts, not run logs — but the run manifest references them by path.

---

## Part D — Open Questions & Decisions Before V2.0 Build

These are the calls Cameron needs to make before implementation can start:

1. **Binary name.** `parity`, `dr-parity`, `drp`? `parity` collides with nothing on the typical macOS PATH but is generic; `dr-parity` is more brandable but longer. **Recommendation: `parity` (short) with `dr-parity` as an alias.**
2. **Distribution.** In-repo `package.json#bin` pointing at `dist/cli.js`? Standalone publish to npm? Homebrew tap? **Recommendation for now: in-repo `bin` plus `npm link` for local install. Defer npm publish to V2.1.**
3. **Language/runtime.** Stay on `tsx`-from-source (current model, zero build step), pre-compile with `tsup` to `dist/`, or compile to a single executable with `bun build --compile` / `pkg`? Pre-compile is friendlier for distribution but adds a build step. **Recommendation: keep `tsx` for dev, add `tsup` for a single bundled entry under `bin/parity.mjs` so the published binary boots fast. No native compilation in V2.0.**
4. **Monorepo split.** Should `engine/` move to a separate package (`@parity/engine`) so the CLI is a thin consumer? Useful for testing, but adds workspace overhead. **Recommendation: stay single-package until at least one third-party consumer wants the engine.**
5. **Spawn-vs-import for stages.** Today everything is spawned. The proposal is to import directly. The risk is browser cleanup and global state pollution between stages within one Node process. **Decision needed: accept that and add defensive teardown, or keep some subprocess boundaries for Playwright runs?** **Recommendation: import everywhere, but each Playwright-using stage gets a `try/finally` that always closes the browser handle. The shared global is the only state to worry about.**
6. **Schema versioning policy.** Hard-fail on unknown `schemaVersion` or auto-migrate? **Recommendation: hard-fail with a clear "run `parity runs migrate`" hint, never auto-migrate silently.**
7. **Where do `.runs/` live for non-repo workflows?** If Cameron uses `parity` against a target that isn't this repo (e.g. cloning a one-off site from his home dir), `.runs/` should fall back to `~/.local/share/parity/runs/`. **Recommendation: yes, with the in-repo `.runs/` taking precedence whenever a `parity.config.ts` is found upward.**
8. **Skill rewrite scope.** Should `/clone-website` be deleted entirely in favour of `parity clone-site` invoked manually, or kept as a thin wrapper? **Recommendation: keep as a thin wrapper — it lets Cameron say "clone this site" in plain English and have the LLM dispatch.**
9. **Per-viewport vs global parity threshold.** Cameron's existing scripts only support a global `--parity-threshold=0.02`. V2.0 should support per-viewport thresholds in `parity.config.ts`. **Decision needed: default to per-viewport (more useful) or global (backward-compat)?** **Recommendation: per-viewport, with a single `--parity-threshold=` flag still accepted as a fallback for "set all viewports to N".**
10. **Issue auto-suggestion mapping.** The "Suggested Dr Parity improvements" generator in `SUMMARY.md` needs an issue-kind → suggestion lookup table. **Where does that live and who maintains it?** **Recommendation: a versioned `engine/logging/suggestions.ts` keyed by `issues[].kind`, hand-curated, with a "no suggestion available" fallback. PR-able from the docs/parity-issues queue.**
11. **Backwards-compatible npm scripts.** Should `package.json` keep `"capture": "tsx scripts/capture.ts"` or alias to `"capture": "parity capture"`? **Recommendation: alias to `parity` so muscle-memory keeps working but everything routes through the unified logger.**
12. **Tab completion.** Ship a `parity completion bash|zsh|fish` command? **Recommendation: yes — citty supports it; near-zero cost; pays off immediately for a 30+ verb tree.**

---

## Appendix — Example Run Walkthrough

### Today

```bash
$ npm run clone-site -- https://omnisocials.com --target=astro
# spawns 6 child processes
# logs scattered across 3 manifest files
# no run id, no env capture, no SUMMARY.md
# parity result printed to terminal then lost when Cameron closes it
```

### After V2.0

```bash
$ parity clone-site https://omnisocials.com --target=astro
[2026-05-22T14:30:12Z] Run 2026-05-22T14-30-12-omnisocials-com-7a3f started
  • command : parity clone-site https://omnisocials.com --target=astro
  • config  : parity.config.ts (target override: omnisocials.com)
  • out     : clones/omnisocials.com-2026-05-22T14-30-12/

[crawl]            ok    28.1s  17 urls discovered
[capture]          ok   6m 52s  68 contexts, 89 MB HAR
[parse-har]        ok    18.4s  1703 assets, 87 scripts, 42 styles
[parse-trace]      ok     6.2s  89 snapshots
[complete-assets]  warn  14.1s  1 asset missing (omnisocials.com/cdn/missing.woff2 → 404)
[clone]            ok     8.2s  4 viewports, 142 KB html
[build/astro]      ok    1m 16s 12 pages, 8 shared components, 64 MB assets
[qa-verify]        FAIL  3m 18s 2/4 viewports passed (desktop, wide exceed 2% threshold)

Run finished: partial (2/4 viewports passed)
Summary: .runs/2026-05-22T14-30-12-omnisocials-com-7a3f/SUMMARY.md
Project: clones/omnisocials.com-2026-05-22T14-30-12/astro-site/
Preview: npx serve clones/omnisocials.com-2026-05-22T14-30-12/astro-site/dist/

Next:
  parity runs show 2026-05-22T14-30-12-omnisocials-com-7a3f
  parity qa verify clones/omnisocials.com-2026-05-22T14-30-12/astro-site/ --viewport=desktop,wide
```

A week later, after Cameron has moved the clone out:

```bash
$ parity runs show 2026-05-22T14-30-12-omnisocials-com-7a3f
# prints SUMMARY.md, with parity scores, issues, and suggested Dr Parity improvements
```

Cameron edits the suggestions, then:

```bash
$ parity runs harvest 2026-05-22T14-30-12-omnisocials-com-7a3f
# wrote 3 issues to docs/parity-issues/:
#   - ISSUE-001-asset-missing-retry.md
#   - ISSUE-002-css-rewriter-viewport-clamp.md
#   - ISSUE-003-per-viewport-parity-thresholds.md
```

Next Claude session picks any of those issues up directly with full context.

---

_End of design._

---

## Round 2: Follow-up Answers

### A. Recommendations for the 3 blocking decisions

**A.1 — Binary name & distribution: `parity` as the primary binary, `dr-parity` as a hard-aliased secondary, both declared in `package.json#bin`, installed via `npm link` from the repo for now; no npm publish in V2.0; no native compile.**

Defence: `parity` is short, memorable, and types easily for a CLI Cameron uses dozens of times per session; `dr-parity` is retained as a marketing-friendly alias so muscle memory and external references keep working. `package.json#bin` with two entries gives both names for free via npm's symlink machinery, and `npm link` makes the binary globally available from the working copy without a publish step. Skipping npm publish in V2.0 avoids version-management overhead while the schema is still settling; we can publish in V2.1 once `manifest.json` schemaVersion 1 has cooked for a few weeks. No `bun build --compile`: it strips us of `tsx` hot-edit speed and gives us nothing meaningful in a single-user-on-laptop scenario.

**A.2 — Spawn-vs-import boundary: import everywhere except Playwright `chromium.launch()` calls, which stay isolated behind a per-stage `try/finally` that closes the browser inside the same Node process; no subprocess boundary at all.**

Defence: Spawning is the root cause of today's log fragmentation (six child processes with six stdout streams) and the single largest blocker to a unified `pipeline.jsonl`. The only legitimate concern is Playwright browser cleanup if a stage throws, and that's solved with disciplined `try/finally` plus an `await ctx.browsers.dispose()` finalizer registered in `RunContext`. Going all-in on in-process composition is the only way the stage interface in section C actually works, and the engineering cost of being careful about teardown is much smaller than the cost of perpetually broken cross-process logging. The trade we're making: slightly more risk of one stage's bug poisoning the next, in exchange for a coherent run record.

**A.3 — `.runs/` schema versioning & retention: hard-fail on `schemaVersion` mismatch with an explicit `parity runs migrate` hint; never auto-migrate; retention defaults to `keep: 50` and `olderThanDays: 30` with `SUMMARY.md`+`manifest.json` always preserved even after pruning.**

Defence: Silent auto-migration corrupts old runs invisibly, which is the worst possible failure mode for a self-improvement log Cameron may not look at for weeks. Hard-fail with a migration command keeps the user in control. The retention numbers (`50` runs / `30` days) are chosen for a single developer running 5-20 clones per week: 50 keeps roughly a fortnight of dense work, 30 days catches sparse weeks. Preserving the summary/manifest even after pruning is non-negotiable because that's the archaeological layer the harvest loop reads; pruning only deletes the heavy `pipeline.jsonl` and per-stage stdout logs.

---

### B. Full migration table (zero regression)

Every existing CLI-shaped entry point in the repo, mapped 1:1 to its `parity` invocation.

| # | Old command | New command | Risk | Notes |
|---|---|---|---|---|
| 1 | `npm run capture -- <url>` | `parity capture <url>` | low | Direct rename; same flags |
| 2 | `npm run capture:forms -- <url>` | `parity webapp capture-forms <url>` | low | Moved under `webapp` namespace |
| 3 | `npm run parse:har -- <dir>` | `parity parse <dir> --har` | low | Subcommand flag |
| 4 | `npm run parse:trace -- <dir>` | `parity parse <dir> --trace` | low | Subcommand flag |
| 5 | `npm run parse:all -- <dir>` | `parity parse <dir> --all` | low | Subcommand flag |
| 6 | `npm run clone -- <dir>` | `parity stage clone <dir>` | low | Avoids shadowing top-level `clone` |
| 7 | `npm run clone-site -- <url>` | `parity clone-site <url>` | medium | Spawn-to-import refactor inside |
| 8 | `npm run clone-urls -- --urls=<f>` | `parity clone-urls --urls=<f>` | medium | Spawn-to-import refactor inside |
| 9 | `npm run clone-end-to-end -- <url>` | `parity clone <url>` | medium | Renamed verb; phase timings preserved |
| 10 | `npm run clone-page -- <url>` | `parity clone <url>` | low | Was already a thin shim |
| 11 | `npm run complete:assets -- <dir>` | `parity complete-assets <dir>` | low | Direct rename |
| 12 | `npm run build:astro -- <dir>` | `parity build <dir> --target=astro` | low | Flag-routed |
| 13 | `npm run build:react -- <dir>` | `parity build <dir> --target=react` | low | Flag-routed |
| 14 | `npm run build:webapp -- ...` | `parity build --target=webapp --crawl-dir=...` | medium | Different input source |
| 15 | `npm run build:react:multi -- ...` | `parity clone-urls --target=react ...` | medium | Merged into multi-URL flow |
| 16 | `npm run build:astro:multi -- ...` | `parity clone-urls --target=astro ...` | medium | Merged into multi-URL flow |
| 17 | `npm run rebuild-pro -- <dir>` | `parity rebuild-pro <dir>` | medium | Kitchen-sink; preserved as top-level for now |
| 18 | `npm run extract:css -- <dir>` | `parity analyze css <dir>` | low | Namespace move |
| 19 | `npm run extract:tokens -- <dir>` | `parity analyze tokens <dir>` | low | Namespace move |
| 20 | `npm run extract:primitives -- <dir>` | `parity analyze primitives <dir>` | low | Namespace move |
| 21 | `npm run extract:animations -- <dir>` | `parity analyze animations <dir>` | low | Namespace move |
| 22 | `npm run extract:library -- <dir>` | `parity analyze library <dir>` | low | Namespace move |
| 23 | `npm run extract -- <url>` (legacy) | `parity analyze legacy <url>` | medium | Kept for skill compat |
| 24 | `npm run extract:multi -- ...` | `parity analyze legacy --urls=<f>` | medium | Repeatable URL form |
| 25 | `npm run crawl:webapp -- <url>` | `parity webapp crawl <url>` | low | Namespace move |
| 26 | `npm run audit:shell -- <url>` | `parity webapp audit shell <url>` | low | Subcommand preserved |
| 27 | `npm run audit:plan -- <dir>` | `parity webapp audit plan <dir>` | low | Subcommand preserved |
| 28 | `npm run audit:execute -- <dir>` | `parity webapp audit execute <dir>` | low | Subcommand preserved |
| 29 | `npm run audit:capture -- <url>` | `parity webapp audit run <url>` | low | Verb renamed to `run` |
| 30 | `npm run qa -- ...` | `parity qa run ...` | high | Flag style migrates from `--k v` to `--k=v` |
| 31 | `npm run verify:parity -- ...` | `parity qa verify ...` | low | Direct rename |
| 32 | `npm run test:parity:astro` | `parity qa verify --target=astro --fixture=...` | medium | Was a fixed npm script |
| 33 | `npm run test:parity:react` | `parity qa verify --target=react --fixture=...` | medium | Was a fixed npm script |
| 34 | `scripts/verify-clone.ts` | `parity qa verify-clone <dir>` | low | Direct expose |
| 35 | `scripts/verify-interactions.ts` | `parity qa interactions <url>` | low | Direct expose |
| 36 | `scripts/verify-key-clicks.ts` (v1) | `parity qa clicks <url> --legacy` | medium | v2 is default |
| 37 | `scripts/verify-key-clicks-v2.ts` | `parity qa clicks <url>` | low | Default behaviour |
| 38 | `scripts/verify-tabs-and-toasts.ts` | `parity qa interactions <url> --pattern=tabs-toasts` | low | Pattern flag |
| 39 | `scripts/verify-toast.ts` | `parity qa interactions <url> --pattern=toasts` | low | Pattern flag |
| 40 | `scripts/verify-posts-menu.ts` | `parity qa interactions <url> --pattern=posts-menu` | low | Pattern flag |
| 41 | `scripts/auth-verify.ts` | `parity webapp auth-verify <url>` | low | Namespace move |
| 42 | `scripts/login-omni.ts` | `parity webapp login <url>` | low | Namespace move |
| 43 | `scripts/inspect-live.ts` | `parity webapp inspect <url>` | low | Namespace move |
| 44 | `scripts/inspect-selector-resolution.ts` | `parity webapp inspect-selectors <url>` | low | Namespace move |
| 45 | `scripts/capture-form-states.ts` | `parity webapp capture-forms <url>` | low | Namespace move |
| 46 | `scripts/recapture-routes.ts` | `parity webapp recapture <dir>` | medium | Operates on existing capture |
| 47 | `scripts/build-html-mirror.ts` | `parity build <dir> --target=html-mirror` | medium | Target adapter |
| 48 | `scripts/iconify-svgs.ts` | `parity refactor iconify <dir>` | low | Namespace move |
| 49 | `scripts/scope-styles.ts` | `parity refactor scope-styles <dir>` | low | Namespace move |
| 50 | `scripts/centralize-content.ts` | `parity refactor centralize <dir>` | low | Namespace move |
| 51 | `scripts/refactor-sections.ts` | `parity refactor sections <dir>` | low | Namespace move |
| 52 | `scripts/generate-edit-playbook.ts` | `parity refactor edit-playbook <dir>` | low | Namespace move |
| 53 | `scripts/generate-prototype.ts` | `parity generate prototype <dir>` | low | New `generate` namespace |
| 54 | `scripts/generate-astro.ts` | `parity build <dir> --target=astro --mode=generate-only` | medium | Folded into `build` |
| 55 | `scripts/build-astro.ts` | `parity build <dir> --target=astro --astro-cli` | medium | Flag toggles inner astro CLI |
| 56 | `scripts/qa-sections.ts` | `parity qa sections <dir>` | low | Namespace move |
| 57 | `scripts/emit-only.ts` | `parity emit-only <dir> --target=<t>` | low | Top-level alias |
| 58 | `scripts/extract.ts` (orig pipeline) | `parity analyze legacy <url>` | medium | Kept for skill compat |
| 59 | `scripts/check-*.ts` (5 files) | `parity self-test [--check=<name>]` | medium | Bundled, hidden from main help |
| 60 | `scripts/audit-capture.ts` (file) | `parity webapp audit run|shell|plan|execute` | low | Subcommand split |
| 61 | `scripts/sync-skills.mjs` | retained as `npm run sync-skills` (repo-internal) | low | Not a `parity` verb |
| 62 | `scripts/download-assets.mjs` | absorbed into `parity capture` post-step | medium | Legacy bootstrap |
| 63 | `scripts/run-clone.ts` | `parity clone <url> --phases=all` | medium | Now a flag on `parity clone` |
| 64 | `scripts/clone-page.ts` | `parity clone <url>` | low | Was already a shim |
| 65 | `scripts/clone.ts` (per-viewport step) | `parity stage clone <dir>` | low | Sub-verb under `stage` |
| 66 | `scripts/build.ts` (dispatcher) | `parity build <dir> --target=<t>` | low | Already a dispatcher today |
| 67 | `.claude/skills/clone-website/SKILL.md` | rewritten to call `parity clone-site` (see F) | medium | Single-file edit |

**Total rows: 67.** Every `scripts/*.ts` file currently present, every `package.json` script, both `.mjs` files, and the `/clone-website` skill are covered.

---

### C. The in-process stage interface

The whole logging story collapses to one Node process, so stages have to be composable functions, not subprocess invocations. The shapes below are concrete enough for a first implementation.

#### C.1 The `Stage<I, O>` contract

```ts
// engine/stages/types.ts
export interface Stage<I, O> {
  /** Stable, lowercase, kebab-case id. Used as the stage name in pipeline.jsonl and stages/<name>.json. */
  readonly name: string

  /** Optional declared dependencies (other stage names that must have completed). Used by the orchestrator for ordering / sanity. */
  readonly dependsOn?: readonly string[]

  /** Throw if the input is unsafe to run with. Should be cheap; the orchestrator calls this before run(). */
  validateInput(input: I, ctx: RunContext): void | Promise<void>

  /**
   * Execute. Stages MUST:
   *   - emit lifecycle events via ctx.logger (info/warn/error/metric)
   *   - register cleanup with ctx.onDispose() (e.g. browser teardown)
   *   - write per-stage artefacts under ctx.outDir
   *   - return a structured result; the orchestrator handles wrapping it in stage_end.
   * Stages MUST NOT call process.exit, mutate process.env, or write to console directly.
   */
  run(input: I, ctx: RunContext): Promise<StageResult<O>>
}

export interface StageResult<O> {
  status: 'ok' | 'warn' | 'partial' | 'fail'
  output: O
  /** Surfaced into the SUMMARY.md issues block. */
  issues?: ReadonlyArray<Issue>
  /** Counted into manifest.json stages[].metrics. */
  metrics?: Readonly<Record<string, number | string>>
  /** Artefact paths the stage produced; the orchestrator emits 'artefact' events. */
  artefacts?: ReadonlyArray<ArtefactRef>
}

export interface Issue {
  kind: string                       // e.g. 'asset-missing', 'parity-threshold'
  severity: 'info' | 'warn' | 'fail'
  message: string
  meta?: Record<string, unknown>
}

export interface ArtefactRef {
  role: string                       // 'capture-dir' | 'clone-dir' | 'project-dir' | 'qa-report' | ...
  path: string                       // absolute on disk
  bytes?: number
}
```

#### C.2 `RunContext`

```ts
// engine/runtime/run-context.ts
export interface RunContext {
  readonly runId: string
  readonly command: string                       // 'parity clone-site ...'
  readonly argv: readonly string[]
  readonly outDir: string                        // .runs/<run-id>/
  readonly target: { kind: string; url?: string; host?: string }
  readonly env: RunEnvironment                   // node, OS, git sha, playwright version, parity version
  readonly config: ResolvedConfig
  readonly logger: RunLogger                     // see below
  readonly manifest: ManifestWriter              // see below

  /** Register a finalizer that runs on success or failure (LIFO). */
  onDispose(fn: () => Promise<void> | void): void

  /** Spawn a child logger scoped to a specific stage. */
  forStage(stageName: string): StageLogger

  /** True if --dry-run; stages should honour this and skip side effects. */
  readonly dryRun: boolean
}

export interface RunLogger {
  debug(msg: string, meta?: object): void
  info(msg: string, meta?: object): void
  warn(msg: string, meta?: object): void
  error(msg: string, meta?: object): void
  emit(event: PipelineEvent): void               // direct structured emission
}

export interface StageLogger extends RunLogger {
  readonly stage: string
  metric(name: string, value: number | string, meta?: object): void
  artefact(ref: ArtefactRef): void
  issue(issue: Issue): void
  /** Per-stage scoped writer for stages/<stage>.stdout.log and stages/<stage>.stderr.log. */
  rawStdout: NodeJS.WritableStream
  rawStderr: NodeJS.WritableStream
}

export interface ManifestWriter {
  /** Patch one stage's entry; merges into manifest.json on disk atomically. */
  patchStage(stage: ManifestStage): Promise<void>
  /** Final write at orchestrator finalize. */
  finalize(outcome: ManifestOutcome): Promise<void>
}
```

#### C.3 The orchestrator

```ts
// engine/runtime/orchestrate.ts
export interface PipelineStep<Prev, Next> {
  stage: Stage<Prev, Next>
  /** Map the previous stage's output into this stage's input. */
  inputFrom: (prev: Prev, ctx: RunContext) => Next extends void ? Prev : Awaited<unknown>
}

export interface Pipeline {
  /** Append a stage. Returns a new pipeline whose output type is the new stage's output. */
  pipe<Next>(stage: Stage<unknown, Next>, mapInput?: (prev: unknown, ctx: RunContext) => unknown): Pipeline
  /** Execute and return the final stage output, plus the populated RunContext. */
  run(initialInput: unknown, ctx: RunContext): Promise<{ result: unknown; ctx: RunContext }>
}

export function createPipeline(name: string): Pipeline { /* ... */ }

/**
 * Orchestrator behaviour per stage:
 *   1. emit pipeline.jsonl event { type: 'stage_start', stage, t, input_summary }
 *   2. await stage.validateInput()
 *   3. set up per-stage stdout/stderr capture (pipes raw process writes to stages/<name>.stdout.log)
 *   4. await stage.run() inside a try/finally that runs registered onDispose() finalizers
 *   5. on success, manifest.patchStage(...); emit 'stage_end' with status + metrics + duration
 *   6. on throw, emit 'error' + 'stage_end' with status='fail'; rethrow unless stage is marked optional
 *   7. on warn/partial output, surface issues into manifest.issues[]
 * The orchestrator NEVER catches a fatal error from outside the stage boundary; that path bubbles to top-level
 *  withRun(), which writes the partial manifest and exits non-zero.
 */
```

#### C.4 Worked example: `parity clone <url> --target=astro`

```ts
// engine/pipelines/clone-single-page.ts
import { createPipeline } from '../runtime/orchestrate'
import { captureStage } from '../stages/capture'
import { parseHarStage } from '../stages/parse-har'
import { parseTraceStage } from '../stages/parse-trace'
import { completeAssetsStage } from '../stages/complete-assets'
import { cloneStage } from '../stages/clone'
import { buildStage } from '../stages/build'
import { qaVerifyStage } from '../stages/qa-verify'

export interface CloneSinglePageInput {
  url: string
  target: 'astro' | 'react' | 'html-mirror'
  viewports?: readonly string[]
  tour?: boolean
}

export function cloneSinglePagePipeline() {
  return createPipeline('clone')
    .pipe(captureStage,         (input: CloneSinglePageInput)   => ({ url: input.url, viewports: input.viewports, tour: input.tour }))
    .pipe(parseHarStage,        (prev /* CaptureOutput */)      => ({ captureDir: prev.captureDir }))
    .pipe(parseTraceStage,      (prev)                          => ({ captureDir: prev.captureDir }))
    .pipe(completeAssetsStage,  (prev)                          => ({ captureDir: prev.captureDir }))
    .pipe(cloneStage,           (prev)                          => ({ captureDir: prev.captureDir }))
    .pipe(buildStage,           (prev, ctx)                     => ({ cloneDir: prev.cloneDir, target: ctx.config.clone.target }))
    .pipe(qaVerifyStage,        (prev, ctx)                     => ({ projectDir: prev.projectDir, originalUrl: ctx.target.url!, threshold: ctx.config.clone.parityThreshold }))
}

// In the CLI handler for `parity clone`:
import { withRun } from '../runtime/with-run'

export async function runCloneCommand(args: CloneArgs) {
  return withRun({ command: 'parity clone', argv: process.argv.slice(2), target: { kind: 'website', url: args.url } }, async (ctx) => {
    const pipeline = cloneSinglePagePipeline()
    const { result } = await pipeline.run({ url: args.url, target: args.target, viewports: args.viewports, tour: args.tour }, ctx)
    return result
  })
}
```

`withRun()` creates the `.runs/<run-id>/` directory, instantiates `RunContext` (incl. `RunLogger`, `ManifestWriter`), runs the body, and on exit writes `manifest.json` + `SUMMARY.md` regardless of success/failure. Stage authors only think in `(input, ctx) => StageResult`.

---

### D. Full `.runs/` schema

#### D.1 `manifest.json`

```json
{
  "$schema": "https://schemas.parity.dev/run-manifest/v1.json",
  "schemaVersion": 1,

  "runId": "2026-05-22T14-30-12-omnisocials-com-7a3f",
  "command": "parity clone-site https://omnisocials.com --target=astro",
  "argv": ["clone-site", "https://omnisocials.com", "--target=astro"],

  "invokedBy": {
    "interactive": true,
    "ci": false,
    "skill": null
  },

  "config": {
    "resolvedFrom": "parity.config.ts",
    "resolvedPath": "/Users/cameronmcallister/Github/dr-parity/parity.config.ts",
    "applied": {
      "outDir": "clones",
      "logs": { "dir": ".runs" },
      "capture": { "mode": "launch", "viewports": ["mobile","tablet","desktop","wide"], "tour": true },
      "clone": { "target": "astro", "parityThreshold": 0.02 }
    },
    "overrides": { "target": "astro" }
  },

  "target": {
    "kind": "website",
    "url": "https://omnisocials.com",
    "host": "omnisocials.com",
    "robotsAllowed": true
  },

  "environment": {
    "parityVersion": "2.0.0",
    "nodeVersion": "v24.0.0",
    "platform": "darwin",
    "platformRelease": "25.4.0",
    "arch": "arm64",
    "playwrightVersion": "1.58.2",
    "chromiumRevision": "1234",
    "gitSha": "abc1234",
    "gitBranch": "prototype-mode",
    "gitDirty": false,
    "gitRoot": "/Users/cameronmcallister/Github/dr-parity"
  },

  "timing": {
    "startedAt": "2026-05-22T14:30:12.123Z",
    "finishedAt": "2026-05-22T14:42:55.901Z",
    "durationMs": 763778
  },

  "stages": [
    {
      "name": "capture",
      "status": "ok",
      "startedAt": "2026-05-22T14:30:12.500Z",
      "finishedAt": "2026-05-22T14:37:04.500Z",
      "durationMs": 412000,
      "inputs": { "url": "https://omnisocials.com", "viewports": ["mobile","tablet","desktop","wide"], "tour": true },
      "outputs": { "captureDir": "docs/research/captures/omnisocials.com/2026-05-22T14-30-12/" },
      "metrics": { "harBytes": 89321204, "harEntries": 1832, "lazyLoadSteps": 247 },
      "issues": [],
      "artefacts": [
        { "role": "capture-dir", "path": "docs/research/captures/omnisocials.com/2026-05-22T14-30-12/", "bytes": 98765432 }
      ]
    }
  ],

  "outcome": {
    "status": "partial",
    "exitCode": 1,
    "parityScore": 0.957,
    "viewports": {
      "mobile":  { "status": "pass", "diff": 0.004 },
      "tablet":  { "status": "pass", "diff": 0.011 },
      "desktop": { "status": "fail", "diff": 0.043 },
      "wide":    { "status": "fail", "diff": 0.038 }
    },
    "primaryArtefact": "clones/omnisocials.com-2026-05-22T14-30-12/astro-site",
    "summaryPath": ".runs/2026-05-22T14-30-12-omnisocials-com-7a3f/SUMMARY.md"
  },

  "issues": [
    {
      "id": "ISSUE-001",
      "stage": "complete-assets",
      "kind": "asset-missing",
      "severity": "warn",
      "message": "1 font failed to fetch",
      "meta": { "url": "https://cdn.example/missing.woff2", "status": 404 }
    },
    {
      "id": "ISSUE-002",
      "stage": "qa-verify",
      "kind": "parity-threshold",
      "severity": "fail",
      "message": "desktop viewport exceeds threshold",
      "meta": { "viewport": "desktop", "diff": 0.043, "threshold": 0.02 }
    }
  ],

  "artefactIndex": [
    { "role": "capture-dir", "path": "docs/research/captures/omnisocials.com/2026-05-22T14-30-12/" },
    { "role": "clone-dir",   "path": "clones/omnisocials.com-2026-05-22T14-30-12/" },
    { "role": "project-dir", "path": "clones/omnisocials.com-2026-05-22T14-30-12/astro-site/" },
    { "role": "qa-report",   "path": "clones/omnisocials.com-2026-05-22T14-30-12/astro-site/parity-report.json" }
  ]
}
```

#### D.2 `pipeline.jsonl`

One JSON object per line. Every line has these base fields:

```ts
interface EventBase {
  t: string            // ISO timestamp with ms
  runId: string
  seq: number          // monotonic per-run counter
  type: EventType
  stage?: string       // present for everything except 'run_start'/'run_end'
}
```

Event types and their additional fields:

```jsonc
// 1) run lifecycle
{ "t":"2026-05-22T14:30:12.123Z", "runId":"...", "seq":0, "type":"run_start",
  "command":"parity clone-site https://omnisocials.com --target=astro",
  "argv":["clone-site","https://omnisocials.com","--target=astro"],
  "env":{ "parityVersion":"2.0.0","nodeVersion":"v24.0.0","gitSha":"abc1234" } }

{ "t":"2026-05-22T14:42:55.901Z", "runId":"...", "seq":4711, "type":"run_end",
  "status":"partial", "exitCode":1, "durationMs":763778 }

// 2) stage_start
{ "t":"...", "runId":"...", "seq":12, "type":"stage_start", "stage":"capture",
  "input":{ "url":"https://omnisocials.com","viewports":["mobile","tablet","desktop","wide"] } }

// 3) stage_end
{ "t":"...", "runId":"...", "seq":1840, "type":"stage_end", "stage":"capture",
  "status":"ok", "durationMs":412000,
  "metrics":{ "harBytes":89321204,"harEntries":1832,"lazyLoadSteps":247 },
  "outputs":{ "captureDir":"docs/research/captures/omnisocials.com/2026-05-22T14-30-12/" } }

// 4) metric (mid-stage counter or sample)
{ "t":"...", "runId":"...", "seq":94, "type":"metric", "stage":"capture",
  "name":"har_bytes","value":12483920,
  "meta":{ "viewport":"desktop","url":"https://omnisocials.com/" } }

// 5) warning
{ "t":"...", "runId":"...", "seq":1602, "type":"warning", "stage":"complete-assets",
  "kind":"asset-missing","message":"font 404",
  "meta":{ "url":"https://cdn.example/missing.woff2","status":404 } }

// 6) error (non-fatal; fatal errors still emit then run_end with status='fail')
{ "t":"...", "runId":"...", "seq":1607, "type":"error", "stage":"capture",
  "kind":"page-load","message":"net::ERR_TIMED_OUT",
  "meta":{ "url":"https://omnisocials.com/heavy","attempt":1 },
  "fatal":false }

// 7) artefact (produced output worth pinning)
{ "t":"...", "runId":"...", "seq":1841, "type":"artefact", "stage":"capture",
  "role":"capture-dir",
  "path":"docs/research/captures/omnisocials.com/2026-05-22T14-30-12/",
  "bytes":98765432 }

// 8) decision (a branch or skip the orchestrator/stage took, for forensic auditing)
{ "t":"...", "runId":"...", "seq":61, "type":"decision", "stage":"capture",
  "kind":"mode-selected","value":"launch",
  "reason":"no --mode flag, no persistent profile lock, defaulting to launch" }
```

Free `log` events (debug/info-level prose without a type) are written as:

```jsonc
{ "t":"...", "runId":"...", "seq":83, "type":"log", "stage":"capture",
  "lvl":"info","msg":"tour complete","meta":{ "scrollSteps":42,"heightPx":8412 } }
```

#### D.3 `SUMMARY.md` template

This is the surviving artefact. Headers and order are fixed; auto-generated regions are marked.

```markdown
# Run <ISO date> — <host> (<command-verb>, <target>)

**Run id:** `<run-id>`
**Status:** <pass | partial | fail | error>
**Duration:** <human duration>
**Command:** `<exact CLI invocation>`
**Git:** `<sha>` (<branch>)<, dirty>?
**Parity:** <2.0.0> · **Node:** <v24.0.0> · **Playwright:** <1.58.2>

---

## Run inputs

| Field | Value |
|---|---|
| URL(s) | <url1>, <url2>, ... |
| Target | <astro | react | webapp | html-mirror> |
| Viewports | mobile, tablet, desktop, wide |
| Config file | `parity.config.ts` |
| Overrides | `--target=astro` |

---

## Parity outcome

<!-- AUTO-START: outcome -->
| Viewport | Diff | Threshold | Status |
|---|---|---|---|
| mobile  | 0.4% | 2.0% | pass |
| tablet  | 1.1% | 2.0% | pass |
| desktop | 4.3% | 2.0% | FAIL |
| wide    | 3.8% | 2.0% | FAIL |

**Overall:** partial (2/4 viewports passed)
<!-- AUTO-END: outcome -->

---

## Pipeline timing

<!-- AUTO-START: timing -->
| Stage | Duration | Status | Notes |
|---|---|---|---|
| capture | 6m 52s | ok | 89 MB HAR, 1832 assets |
| parse-har | 18.4s | ok | 42 styles, 87 scripts |
| ... | ... | ... | ... |
<!-- AUTO-END: timing -->

---

## Issues encountered

<!-- AUTO-START: issues -->
1. **[ISSUE-001 / warn]** `complete-assets / asset-missing` — 1 font (`cdn.example/missing.woff2`) returned 404 during post-capture sweep. Clone still ships; font falls back.
2. **[ISSUE-002 / fail]** `qa-verify / parity-threshold` — desktop & wide viewports exceed 2% pixel-diff threshold. Worst diff: 18px vertical offset in hero section.
<!-- AUTO-END: issues -->

---

## Dr Parity bugs / gaps spotted

<!-- AUTO-START: bugs -->
*(Auto-suggested from issue kinds; edit by hand or leave for harvest.)*

- `complete-assets` could retry 404s with the opposite scheme before giving up.
- The clone post-emit pipeline may not be re-folding `@media` rules above 1280px width; see ISSUE-002.
<!-- AUTO-END: bugs -->

---

## Suggested improvements

<!-- AUTO-START: improvements -->
1. Add asset-retry-with-scheme-swap to `engine/extract/asset-fetcher.ts`.
2. Investigate viewport-clamp bug in `engine/clone/css-rewriter.ts`.
3. Support per-viewport parity thresholds in `parity.config.ts`.
<!-- AUTO-END: improvements -->

<!-- USER-START: improvements -->
*(Cameron edits below; preserved across re-runs.)*
<!-- USER-END: improvements -->

---

## Artefacts

<!-- AUTO-START: artefacts -->
- Capture: `docs/research/captures/omnisocials.com/2026-05-22T14-30-12/`
- Clone (per viewport): `docs/research/captures/.../<viewport>/clone/`
- Project: `clones/omnisocials.com-2026-05-22T14-30-12/astro-site/`
- Parity report: `clones/.../astro-site/parity-report.json`
- Diff screenshots: `.runs/<run-id>/screenshots/`
<!-- AUTO-END: artefacts -->

---

## Cleanup status

<!-- AUTO-START: cleanup -->
| Asset | State |
|---|---|
| capture-dir | retained |
| clone-dir   | retained |
| project-dir | retained |
| pipeline.jsonl | retained |
| stage stdout/stderr | retained |
<!-- AUTO-END: cleanup -->

*(Updated by `parity runs archive <id>` and `parity runs prune`.)*

---

## Reproduce

```
parity clone-site https://omnisocials.com --target=astro --run-id=<new>
```

---

_Generated by Dr Parity 2.0.0 • Run <run-id> • <ISO finishedAt>_
```

The `<!-- AUTO-START / AUTO-END -->` blocks are rewritten on every regenerate; the `<!-- USER-START / USER-END -->` block is preserved verbatim. Cameron's hand annotations always live inside USER blocks.

---

### E. `parity runs harvest` — the self-improvement loop

#### E.1 Inputs

```
parity runs harvest [<run-id>...]
                    [--since=<duration>|<date>]   default: 7d
                    [--target=<host>]             filter by host
                    [--status=<status>...]        default: warn,partial,fail,error
                    [--min-frequency=<n>]         default: 2 (suppress one-offs)
                    [--out=<dir>]                 default: docs/parity-issues/
                    [--dry-run]
```

If no run ids and no `--since`, defaults to "all runs in the last 7 days where status != pass". Cameron's common invocation: `parity runs harvest` (no args).

#### E.2 What it scans for

The harvest walks every selected run's `manifest.json` and `pipeline.jsonl`, then aggregates across runs:

1. **Recurring warnings** — `warning` events with the same `stage + kind` appearing in `>= --min-frequency` runs. Example: `complete-assets/asset-missing` seen 4 runs in a row.
2. **Repeated non-fatal errors** — `error` events (`fatal:false`) with the same `stage + kind`, same threshold.
3. **Parity regressions** — `qa-verify/parity-threshold` failures grouped by `(target.host, viewport)`. Flags when a host that previously passed starts failing, or when a viewport's diff trends upward across the last N runs.
4. **Stale TODOs** — scans every `SUMMARY.md` for unchecked items inside USER blocks; counts items that have appeared unchanged in `>= 3` runs.
5. **Stage duration regressions** — `stage_end.durationMs` trending upward by `> 50%` versus the median of the last 10 runs for the same stage+host.
6. **Decision drift** — `decision` events whose `value` for the same `kind` flipped between runs (e.g. `mode-selected: launch` → `mode-selected: persistent`), worth surfacing as "did Cameron mean to change this?".
7. **Orphaned artefacts** — `artefactIndex` paths in `manifest.json` that no longer exist on disk; useful for prune planning.

#### E.3 Outputs

Two layers:

**Layer 1 — per-finding markdown tickets** in `docs/parity-issues/`:

```
docs/parity-issues/
  YYYY-MM-DD-<kind>-<short-hash>.md
  # e.g.
  2026-05-22-asset-missing-retry-a3f7.md
  2026-05-22-parity-threshold-omnisocials-desktop-b41c.md
  2026-05-22-stage-duration-capture-regression-c9e2.md
```

Each ticket follows a template:

```markdown
---
id: PARITY-ISSUE-2026-05-22-a3f7
kind: asset-missing
severity: warn
status: open
firstSeen: 2026-05-08T...
lastSeen: 2026-05-22T...
frequency: 4
affectedRuns:
  - 2026-05-08T.../...-pinterest-com-...
  - 2026-05-14T.../...-omnisocials-com-...
  - 2026-05-19T.../...-omnisocials-com-...
  - 2026-05-22T.../...-omnisocials-com-...
suggestedTargetFiles:
  - engine/extract/asset-fetcher.ts
  - engine/extract/capture/network-recorder.ts
---

# Asset-missing: 404s on font URLs across 4 runs

## Pattern
4 separate runs (omnisocials.com x3, pinterest.com x1) hit a `complete-assets/asset-missing` warning where a `.woff2` font URL returned 404 during the post-capture asset sweep.

## Hypothesis
The capture HAR records the requested URL, but `complete-assets` re-fetches it after-the-fact without retrying with the opposite scheme. Some CDNs answer on `https://` only.

## Suggested fix
In `engine/extract/asset-fetcher.ts`, on 404 retry the URL once with the opposite scheme (`http<->https`) before marking it as missing.

## Reproduce
Any clone-site of omnisocials.com triggers it. Example: `.runs/2026-05-22T14-30-12-omnisocials-com-7a3f/`.

## Verification
After fix, re-run: `parity clone-site https://omnisocials.com --target=astro`. Expect `complete-assets/asset-missing` count to drop to 0.
```

**Layer 2 — a queue index** at `docs/parity-issues/INDEX.md`:

```markdown
# Dr Parity Self-Improvement Queue

Updated 2026-05-22 by `parity runs harvest`.

## Open

| Priority | Kind | Frequency | First seen | Last seen | File |
|---|---|---|---|---|---|
| P1 | asset-missing | 4 | 2026-05-08 | 2026-05-22 | [a3f7](2026-05-22-asset-missing-retry-a3f7.md) |
| P2 | parity-threshold (omnisocials/desktop) | 3 | 2026-05-14 | 2026-05-22 | [b41c](2026-05-22-parity-threshold-omnisocials-desktop-b41c.md) |
| P3 | stage-duration (capture +60%) | 2 | 2026-05-19 | 2026-05-22 | [c9e2](2026-05-22-stage-duration-capture-regression-c9e2.md) |

## Recently closed
*(populated when Cameron sets `status: closed` in a ticket's front-matter)*
```

#### E.4 Where it writes

- Tickets: `docs/parity-issues/<date>-<kind>-<hash>.md` (new files only — never overwrites a ticket Cameron has edited)
- Index: `docs/parity-issues/INDEX.md` (rewritten on every run, but preserves a `<!-- USER-NOTES -->` block at the bottom)
- Harvest summary: `.runs/<latest>/harvest-summary.md` (a short audit log of what was scanned, what was emitted, what was suppressed by `--min-frequency`)

#### E.5 How Claude consumes it

A future Claude Code session reads `docs/parity-issues/INDEX.md`, picks the top open ticket, opens the linked markdown file, and uses the ticket as the task brief. Front-matter `suggestedTargetFiles` gives the agent a starting point; `affectedRuns` lets the agent open `manifest.json` for any of those runs to verify the diagnosis. When the fix lands, Claude updates the ticket's `status` to `closed` and adds a `resolvedIn` git sha to the front-matter; the next harvest picks that up and moves the row to "Recently closed".

This is the loop. One command, structured tickets, durable across sessions.

---

### F. Replacement `/clone-website` skill content

Full new contents for `.claude/skills/clone-website/SKILL.md`:

````markdown
---
description: Clone any website 1:1 into a Next.js / Astro / React project using `parity`. Use this skill whenever the user asks to clone, mirror, replicate, or copy a website's UI exactly. Wraps the unified `parity` CLI; do not invoke `scripts/*.ts` directly.
allowed-tools: Bash, Read, Edit, Write
argument-hint: <url1> [<url2> ...] [--target=astro|react|html-mirror]
---

# /clone-website — Wrapper over `parity clone-site`

This skill is a thin shell over the `parity` CLI. It does NOT call scripts directly. It does NOT compose its own pipeline. There is exactly one canonical command sequence below; deviating from it is the bug, not the feature.

## How to invoke

The user provides one or more URLs. Optional target flag picks the output framework (`astro` is the default).

```
/clone-website https://example.com
/clone-website https://example.com https://example.com/about --target=react
```

## Canonical command sequence

For each URL, run the sequence below in order. Do not skip steps, do not substitute scripts, do not spawn `tsx scripts/*.ts` directly.

```bash
# 0. Sanity-check the environment (one-time per session is fine).
parity doctor

# 1. Run the full clone pipeline. This single command does capture → parse → complete-assets → clone → build → qa-verify in one process with a unified run log.
parity clone-site "<url>" --target=<target>

# 2. Read the run summary. The runId is printed in the last line of step 1; you can also discover it via:
parity runs list --last=1
parity runs show <run-id>

# 3. If parity failed any viewport, run targeted verification:
parity qa verify "<project-dir>" --viewport=<failed-viewport>

# 4. Preview the result for the user:
npx serve "<project-dir>/dist"
```

The `<project-dir>` path is in `SUMMARY.md` under "Artefacts → Project".

## Edge cases — pick the right flag, don't reach for a different script

| Situation | Flag to add to `parity clone-site` |
|---|---|
| Site requires login (Pinterest, internal tools) | `--mode=persistent --user-data-dir=~/.config/playwright-<app>` |
| Need to attach to an already-running Chrome (Image Studio, debugging) | `--mode=cdp` (single viewport only) |
| Only want one viewport (faster iteration) | `--viewport=desktop` |
| Want to skip the lazy-load tour | `--no-tour` |
| Site has a stable URL list (no crawling needed) | use `parity clone-urls --urls=<file>` instead of `clone-site` |
| Want to re-run inside the same run log | `--run-id=<existing-id>` |
| Want headed browser (debugging) | `--headed` |
| Want to widen / tighten parity gate | `--parity-threshold=0.03` |
| Want to skip the build step (capture only) | `--phases=capture,parse,clone` |

## What NOT to do

Claude must NOT reach for any of these. They all route through `parity` now.

- `npx tsx scripts/capture.ts ...`
- `npx tsx scripts/clone-site.ts ...`
- `npx tsx scripts/clone-urls.ts ...`
- `npx tsx scripts/run-clone.ts ...`
- `npx tsx scripts/clone-page.ts ...`
- `npx tsx scripts/parse-har.ts ...`
- `npx tsx scripts/parse-trace.ts ...`
- `npx tsx scripts/complete-assets.ts ...`
- `npx tsx scripts/build.ts ...`
- `npx tsx scripts/rebuild-pro.ts ...`
- `npx tsx scripts/verify-parity.ts ...`
- `npx tsx scripts/qa.ts ...`
- `npx tsx scripts/extract.ts ...` (use `parity analyze legacy <url>` if you genuinely need the original extractor)
- `npm run clone-site -- ...` (works via alias but always prefer the `parity` form so logs are coherent)
- Hand-composing pipelines step-by-step ("first run capture, then parse-har, then ..."). Use `parity clone` or `parity clone-site`.

If you find yourself wanting a script that isn't in the table above, run `parity --help` and `parity <area> --help` first. There is almost certainly a verb for it.

## After the run

1. Read `SUMMARY.md` (path printed by step 1). Surface the parity outcome and any issues to the user.
2. If issues exist that look like Dr Parity bugs rather than target-site quirks, suggest the user run `parity runs harvest` to add them to the self-improvement queue at `docs/parity-issues/`.
3. Never delete the `.runs/<run-id>/` directory — even after the heavy clone is moved out, the summary is the durable record.
````

(Front-matter delimiters above are escaped in the example; the actual file uses normal `---` fences.)

---

### G. Phased rollout plan

The principle: at no point is the repo broken. Each phase ends in a green build with all existing `npm run …` commands still working. Old commands stay alive as shims through phase N-1 and are deleted in phase N.

**Phase 1 — Scaffolding (no behaviour change)**

- Add `bin/parity.mjs` and declare `package.json#bin: { "parity": "bin/parity.mjs", "dr-parity": "bin/parity.mjs" }`.
- Install citty; create `src/cli/index.ts` with the command tree skeleton from B.2.
- Every command's handler is a single line: `await import(`../../scripts/<old>.ts`).then(m => m.main(rebuildArgv(args)))`. Each old script gets a small refactor to export `main(argv)` instead of running at import.
- `npm link` makes `parity` global; smoke-test that `parity capture <url>` runs the unchanged `scripts/capture.ts`.
- Old `npm run …` commands continue to point at `tsx scripts/*.ts`. Both surfaces work identically.
- Ship `parity doctor`, `parity --help`, `parity --version`.
- **Acceptance:** every existing `npm run` still works; every row in the migration table has a working `parity` alias.

**Phase 2 — Unified logging & in-process composition**

- Build `engine/runtime/with-run.ts`, `engine/runtime/run-context.ts`, `engine/logging/`, and `engine/runtime/orchestrate.ts` per section C.
- Refactor stages to the `Stage<I, O>` shape one at a time, starting with `capture`. After each refactor, both `parity capture` and `npm run capture` route through the new stage; the spawn paths in `clone-site.ts` / `clone-urls.ts` / `run-clone.ts` keep working unchanged in this phase.
- Once all individual stages are in-process, rewrite `clone-site.ts` / `clone-urls.ts` / `run-clone.ts` as composed pipelines that no longer spawn child processes. This is the moment `pipeline.jsonl` starts being coherent.
- Add `.runs/` writing, `manifest.json`, `SUMMARY.md` generation, `.runs/index.jsonl` append.
- `npm run …` aliases now route via `parity` (e.g. `"capture": "parity capture"`).
- **Acceptance:** a full `parity clone-site <url>` produces a single `.runs/<id>/` directory with manifest, pipeline.jsonl, summary, and stage logs. Old npm scripts still work (now via the `parity` alias).

**Phase 3 — Flag normalization & deprecation warnings**

- Standardize on `--key=value` across every command. `scripts/qa.ts` flag style is the main migrant.
- Boolean flag conventions normalized (`--flag` / `--no-flag`; never `--flag=true`).
- Add deprecation warnings: any time an old npm script alias is invoked, emit a one-line `[deprecated] use parity <new> instead` to stderr. Old commands still work.
- Add `parity runs list|show|prune` and `parity logs tail`.
- Ship the skill rewrite from section F. Verify Claude sessions use the new wrapper.
- **Acceptance:** every command accepts only `--key=value`; deprecation banners visible; skill updated.

**Phase 4 — Shim removal & self-improvement loop**

- Delete deprecated npm script aliases from `package.json`. Old shell muscle-memory now fails loud (`npm run capture` errors with "removed — use `parity capture`").
- Remove the old `scripts/clone-site.ts` / `clone-urls.ts` / `run-clone.ts` files entirely; their pipelines now live in `engine/pipelines/`.
- Keep `scripts/sync-skills.mjs` (repo-internal) and a small handful of dev-only scripts; everything else either becomes a `parity` verb or is deleted.
- Ship `parity runs harvest` and the `docs/parity-issues/` queue per section E.
- Add tab completion via citty (`parity completion zsh > ~/.parity-completions.zsh`).
- Bump version to 2.0.0. Tag and document.
- **Acceptance:** the repo has one CLI surface, one log surface, one self-improvement queue. Old commands are gone; nothing in the codebase outside of `engine/` knows how to spawn a stage.

---

## Report back

**3 blocking decisions:** Binary is `parity` (with `dr-parity` alias) via `package.json#bin` + `npm link`, no npm publish in V2.0. All stages run in-process; only Playwright browsers get `try/finally` cleanup, no subprocess boundaries. Schema is hard-versioned with `parity runs migrate` on mismatch, retention `keep:50` / `olderThan:30d` with `SUMMARY.md` always preserved.

**Total migration table rows:** 67 (every `scripts/*.ts`, every `package.json` script, both `.mjs` files, the `/clone-website` skill).

**Stage interface:** A `Stage<I,O>` interface returning `StageResult<O>` is composed by an `orchestrate.ts` pipeline driver, with every stage emitting events through a `RunContext.logger` so `pipeline.jsonl`, per-stage stdout logs, and the human terminal output all share one source of truth.

**Harvest loop:** `parity runs harvest` walks recent `.runs/` directories, aggregates recurring warnings / repeat errors / parity regressions / stage-duration drift, and emits per-finding markdown tickets to `docs/parity-issues/` plus an `INDEX.md` queue Claude can pick from in any future session.

**Phased rollout:**
1. Scaffolding — `parity` binary aliases existing scripts, zero behaviour change.
2. Unified logging & in-process composition — `.runs/` and `pipeline.jsonl` come online; spawn paths deleted.
3. Flag normalization & deprecations — `--key=value` everywhere; skill rewritten; deprecation banners on old npm scripts.
4. Shim removal & harvest loop — old scripts deleted; `parity runs harvest` ships; V2.0 tagged.
