---
name: clone-website
description: Clone one or more websites 1:1 into a Next.js, Astro, or React project using the `parity` CLI. The pipeline runs through Playwright CLI extraction only. No browser MCP, no Chrome MCP, no hand crafted scripts/*.ts invocations. Use this whenever the user asks to clone, replicate, rebuild, mirror, reverse engineer, or copy any website. Triggers on phrases like "make a copy of this site", "rebuild this page", "pixel perfect clone". Provide one or more target URLs as arguments.
argument-hint: "<url1> [<url2> ...] [--target=astro|react|html-mirror]"
user-invocable: true
---

# Dr Parity. Clone Website

This skill is a thin wrapper over the `parity` CLI. It does not compose its own pipeline. It does not call `scripts/*.ts` directly. It does not invoke any browser MCP. There is exactly one canonical command sequence below. Deviating from it is the bug, not the feature.

The user provides one or more URLs. The optional `--target` flag picks the output framework. Defaults: `astro` for static sites, `react` when the user names it, `webapp` when the source is a logged in SPA.

---

## How to invoke

```
/clone-website https://example.com
/clone-website https://example.com https://example.com/about --target=react
```

When multiple URLs come through, process them independently and in parallel where possible. Each URL gets its own `.runs/<runId>/` record so artefacts never collide.

---

## Canonical command sequence

For each URL, run the sequence below in order. Do not skip steps. Do not substitute scripts. Do not spawn `tsx scripts/*.ts` directly.

```bash
# 0. Sanity check the environment (one time per session is enough).
npx playwright --version
npx parity version

# 1. Run the full clone pipeline. One command, full Playwright capture, parse,
#    clone, build, and parity verification under a single durable run record.
npx parity clone "<url>" --target=<target>

# 2. Read the run summary. The runId prints in the closing block of step 1.
#    The .runs/<runId>/SUMMARY.md path is also printed and contains parity
#    scores, pipeline timing, issues, and artefacts.
cat .runs/<runId>/SUMMARY.md

# 3. If parity failed any viewport, run targeted verification.
npx parity qa verify "<project-dir>" --viewport=<failed-viewport>

# 4. Preview the result for the user.
npx serve "<project-dir>"
```

The `<project-dir>` path lives in the SUMMARY.md "Artefacts" section. The summary also names the capture directory, the diff report path, and the per viewport clone outputs.

---

## Edge cases mapped to `parity` flags

Pick the right flag. Do not reach for a different script.

| Situation | Flag to add to `parity clone` |
|---|---|
| Site requires login (Pinterest, internal tools, authenticated SPA) | `--mode=persistent` |
| Only want one viewport for faster iteration | `--viewport=desktop` (or `--viewport=mobile,desktop`) |
| Skip the lazy load tour | `--no-tour` |
| Skip the parity verification gate (development only) | `--no-parity` |
| Headed browser for debugging | `--headed` |
| Tighter or wider parity threshold | `--parity-threshold=0.03` |
| Reuse an existing run record (resume on retry) | `--run-id=<existing-id>` |

For multi page sites with an explicit URL list use `parity clone-urls --urls=<file>`. For broad crawl based site cloning use `parity clone-site <url>` once that wave ships. Today, single page clones via `parity clone` remain the supported path.

---

## What NOT to do

Claude must NOT reach for any of these. They are either replaced by the `parity` CLI or retired entirely.

- `npx tsx scripts/capture.ts` (replaced by `parity capture` under the unified run logger)
- `npx tsx scripts/clone-site.ts` (replaced by `parity clone-site`)
- `npx tsx scripts/clone-urls.ts` (replaced by `parity clone-urls`)
- `npx tsx scripts/run-clone.ts` (replaced by `parity clone`)
- `npx tsx scripts/clone-page.ts` (replaced by `parity clone`)
- `npx tsx scripts/parse-har.ts` (replaced by `parity parse <dir> --har`)
- `npx tsx scripts/parse-trace.ts` (replaced by `parity parse <dir> --trace`)
- `npx tsx scripts/complete-assets.ts` (replaced by `parity complete-assets`)
- `npx tsx scripts/build.ts` (replaced by `parity build`)
- `npx tsx scripts/rebuild-pro.ts` (replaced by `parity rebuild-pro`)
- `npx tsx scripts/verify-parity.ts` (replaced by `parity qa verify`)
- `npx tsx scripts/qa.ts` (replaced by `parity qa run`)
- `npm run capture -- ...` and the other `npm run <script>` aliases (work via shim but always prefer the `parity` form so the run log stays coherent)
- Chrome MCP for any visual pass. The Chrome MCP integration is retired. Claude observes the live Playwright run instead.
- Any browser MCP, period. Playwright CLI is the only extraction surface.
- Hand writing JSX or Astro from screenshots. Let the engine emit the components.
- Hand composing pipelines step by step ("first run capture, then parse, then ..."). Use `parity clone` and the engine composes the steps for you.

If you find yourself wanting a script that is not in the table above, run `npx parity --help` and `npx parity <area> --help` first. There is almost certainly a verb for it.

---

## What the engine does behind the scenes

`parity clone` runs a unified pipeline. Each clone gets one durable record under `.runs/<runId>/` containing:

- `manifest.json` with command, env, target, stage timing, parity score, artefact paths
- `pipeline.jsonl` an append only NDJSON event stream (stage_start, stage_end, warning, error, artefact, decision, metric, log)
- `SUMMARY.md` a human readable digest with the parity outcome, pipeline timing, issues, and artefacts
- `stage-logs/<stage>.log` raw stage stdout and stderr

Stages emitted today: capture, parse-har, parse-trace, complete-assets, clone, build, qa-verify. Each stage emits warnings and errors with structured kinds (`asset-missing`, `parity-threshold`, `page-load`, etc.) so the harvest loop can surface them later.

After the run, the manifest and SUMMARY.md are the durable record. The heavy capture and clone directories can be moved out of the repo without losing the audit trail. The harvest loop reads SUMMARY.md and manifest.json to file Dr Parity self improvement tickets.

---

## After the run

1. Read `.runs/<runId>/SUMMARY.md`. Surface the parity outcome and any issues to the user.
2. If issues look like Dr Parity bugs rather than target site quirks, run `npx parity runs harvest` to add them to the self improvement queue under `docs/parity-issues/`.
3. Do not delete `.runs/<runId>/`. Even after the heavy clone is moved out, the run record is the audit trail.
4. If the user wants a different framework target, re run with `--target=<react|astro|webapp|html-mirror>`. The engine handles the target adapter selection.

---

## Live capture observation

Cameron runs Dr Parity inside Claude Code. Claude is in the loop while `parity clone` executes. While the pipeline runs:

1. Watch the streaming stage events. Each stage prints status, duration, and key metrics.
2. Flag any warning or error event whose `kind` looks like a real engine gap (font 404, parity threshold breach, page load timeout) rather than a target site quirk.
3. Note any stage that takes more than twice its usual budget. The harvest loop will pick this up later as duration drift.
4. On completion, read SUMMARY.md and propose annotations to its USER block based on observed anomalies.
5. If the parity gate fails a viewport, propose targeted fixes per component and offer to re run `parity qa verify` against just the failed viewport.

Claude does not click around the live page in a separate browser. Every observation flows through the Playwright run's structured output.

---

## Scope defaults

Unless the user specifies otherwise:

- **Fidelity:** pixel perfect. Exact match in colors, spacing, typography, animations.
- **In scope:** visual layout, component structure, interactions, responsive design, animations, real content and assets.
- **Out of scope:** real backend, authentication, real time features, SEO audit, accessibility audit.
- **Customisation:** none. Pure emulation.

If the user provides additional instructions, honour those over the defaults.

---

## Completion report

When finished, report:

- Run id and SUMMARY.md path
- Parity scores per viewport
- Total components emitted
- Total assets captured (images, videos, SVGs, fonts)
- Build status
- Any open issues in SUMMARY.md that should land in the harvest queue
- Suggested next command (`parity runs harvest`, `parity qa verify`, or `npx serve <project-dir>`)
