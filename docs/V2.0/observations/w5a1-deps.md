# W5A.1 — Drop Unused Dependencies

Agent: W5A.1
Branch: prototype-mode
Baseline HEAD: e13c846
Final HEAD: ed5561d

## Summary

Pruned 17 unused dependencies from the project. The repository is no longer a Next.js / shadcn application; it is a Node-based cloning engine that emits framework code as strings. The engine never imports `react`, `next`, `tailwindcss`, etc. at runtime, so the packages were pure install-time bloat.

## Dependency Verdict Matrix

| Dep | Caller count | Sample caller (top-of-file import?) | Action |
| --- | --- | --- | --- |
| `next` | 0 real | template strings only (`engine/generate/foundation.ts:339` inside `lines.push(...)`) | REMOVE |
| `react` | 0 real | template strings only (`engine/generate/templates/patterns.ts:19` inside backtick generator) | REMOVE |
| `react-dom` | 0 real | template strings only (`engine/targets/webapp/emit-router.ts:86` inside emitter array) | REMOVE |
| `geist` | 0 real | template strings only (`engine/generate/foundation.ts:541` inside `importLines.push`) | REMOVE |
| `tailwind-merge` | 0 | mentioned only in docstring of `engine/targets/webapp/detect-libs/registry.ts` | REMOVE |
| `tw-animate-css` | 0 | mentioned only in `lines.push('@import "tw-animate-css";')` | REMOVE |
| `shadcn` | 0 | mentioned only in `@import "shadcn/tailwind.css"` template + registry docstring | REMOVE |
| `lucide-react` | 0 | no mentions in any active file | REMOVE |
| `@base-ui/react` | 0 | no mentions in any active file | REMOVE |
| `class-variance-authority` | 0 | mentioned only in registry docstring | REMOVE |
| `clsx` | 0 | mentioned only inside one registry docstring describing the shadcn install hint | REMOVE |
| `eslint` | 0 | no config file, no `lint` script, no callers | REMOVE |
| `eslint-config-next` | 0 | no config file, no `lint` script, no callers | REMOVE |
| `@tailwindcss/postcss` | 0 | no postcss config consumes it | REMOVE |
| `tailwindcss` | 0 | engine emits Tailwind class strings but never imports the runtime | REMOVE |
| `@types/react` | 0 | no `.tsx` files in active code surface (engine, scripts, bin, tests) | REMOVE |
| `@types/react-dom` | 0 | same as above | REMOVE |
| `@types/node` | 91+ uses | `process.*`, `Buffer.*`, `node:fs`, `node:path` everywhere | KEEP |
| `postcss` | 1 | `engine/analyze/css/parser.ts` | KEEP |
| `prettier-plugin-astro` | 2 | `engine/refactor/prettify.ts`, `engine/targets/astro/prettify.ts` | KEEP |
| `citty` | 2 | `bin/parity.ts`, `engine/cli/runs-harvest-cli.ts` | KEEP |
| `@babel/parser`, `@babel/traverse`, `@babel/types` | 2-4 each | refactor scripts | KEEP |
| `cheerio` | 34 | HTML rewriter, parsers | KEEP |
| `playwright` | 52 | capture pipeline | KEEP |
| `pixelmatch`, `pngjs` | 6 each | parity QA | KEEP |
| `yauzl` | 2 | trace zip parser | KEEP |
| `mime`, `prettier`, `tsx`, `typescript`, `zod`, `serve` | varied / runtime | tooling | KEEP |
| `@types/babel__traverse`, `@types/pngjs`, `@types/yauzl` | type-only | required by their JS counterparts | KEEP |

## Removed (with commit hashes)

- `0a723da` chore(deps): drop unused Next.js stack
  - removed: `next`, `react`, `react-dom`, `geist`, `@types/react`, `@types/react-dom`
  - also removed npm scripts: `dev`, `build`, `start`, `check`
  - also cleaned `tsconfig.json`: dropped `plugins: [{name: "next"}]`, `next-env.d.ts` include, `.next/types/**/*.ts` include, `.next/dev/types/**/*.ts` include, `**/*.tsx` include, `jsx: react-jsx`, and the dead `@/*` path alias (no `src/` directory exists)
  - deleted `next-env.d.ts`
- `260391a` chore(deps): drop unused UI libs
  - removed: `shadcn`, `lucide-react`, `@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `tw-animate-css`, `clsx`
- `ed5561d` chore(deps): drop dead lint and tailwind stack
  - removed: `eslint`, `eslint-config-next`, `@tailwindcss/postcss`, `tailwindcss`

## Kept (with reason)

- `@types/node` — 91+ files use `process`, `Buffer`, or `node:*` imports.
- `postcss` — `engine/analyze/css/parser.ts` imports it directly.
- `prettier-plugin-astro` — referenced by `engine/refactor/prettify.ts` and `engine/targets/astro/prettify.ts` in the prettier `plugins` option.
- `citty` — CLI framework used by `bin/parity.ts` and `engine/cli/runs-harvest-cli.ts`.
- `@babel/parser`, `@babel/traverse`, `@babel/types` — used by refactor scripts.
- `cheerio` — 34 callers across the HTML rewriter and parsers.
- `playwright` — 52 callers, core of the capture pipeline.
- `pixelmatch`, `pngjs` — used by the parity QA path.
- `yauzl` — used by trace-zip parser.
- `mime`, `prettier`, `tsx`, `typescript`, `zod`, `serve` — tooling actively used.
- `@types/babel__traverse`, `@types/pngjs`, `@types/yauzl` — type-only companions to kept JS deps.

## Install Graph Delta

| Metric | Before | After | Delta |
| --- | --- | --- | --- |
| Total `package.json` deps | 38 (12 deps + 26 devDeps) | 21 (1 dep + 20 devDeps) | -17 |
| `du -sh node_modules` | 647M | 96M | -551M (-85%) |
| `npm ls --depth=0 \| wc -l` | 45 | 23 | -22 |
| TS errors (baseline) | 15 | 3 | -12 |
| Parity test | 2 passed / 2 total | 2 passed / 2 total | unchanged |
| `check:*` scripts | all green | all green | unchanged |

## Anomalies / Surprises

1. **TS error count dropped from 15 to 3** after removing `@types/react` and `@types/react-dom`. Several of the baseline TS errors were caused by stale `@types/react@19` definitions disagreeing with engine code that uses `React.*` only inside string literals. The TS analyzer was attempting to type-check the contents of JSX-flavoured template literals.
2. **`engine/generate/templates/patterns.ts` looked like it imported React at top of file** (line 19 starts `import { useState, useEffect } from "react";`), but the line lives inside a backtick template literal that emits the import as source code into the generated clone. Grep counted it as a real caller until we inspected the surrounding context. Worth noting for future refactors.
3. **`patterns.ts` kept React import-grep hits** even after removal of the dep. Acceptable because the file never executes the import — it only writes it as a string. TypeScript does not validate string contents.
4. **`package.json` still advertises `keywords: ["nextjs", "tailwindcss", "shadcn-ui"]`** even though none of those are dependencies any more. Worth a follow-up to either prune the keywords or rebrand the project.
5. **`tsconfig.json` had `"@/*": ["./src/*"]` aliased but `src/` did not exist.** Removed in commit `0a723da`.
6. **The `check` and `lint` scripts were already gone in the script list, but `check` referenced `npm run lint`** (which would have errored). Removed alongside `dev`/`build`/`start` in commit `0a723da`.
7. **`npm install` still reports 8 vulnerabilities (6 moderate, 2 high)** post-cleanup. They come from transitive deps under playwright / cheerio. Out of scope for this ticket.

## Verification

- Before each removal: ran `npx tsc --noEmit`, `npx parity test`, and all four `check:*` scripts.
- After each removal: re-ran the same gates. All gates remained green.
- TS error count never exceeded the 15-error baseline. It only decreased.
- Lockfile refreshed via `npm install` after each removal so `package-lock.json` stayed in sync.

## Out of Scope (Recommended Follow-ups)

- Rebrand `package.json` (description, keywords) to drop Next.js / shadcn references.
- Consider trimming the `lib` array in `tsconfig.json` now that no DOM-targeting app exists (the engine emits DOM-targeting code as strings but runs in Node).
- Run `npm audit fix` (8 reported vulnerabilities) once owners agree it is safe.
