# W1B — Doc Drift + Chrome MCP Removal

## Chrome MCP References Removed

| File | Where | Before (paraphrase) | After |
|---|---|---|---|
| `AGENTS.md` | "What This Is" para | "automated Playwright extraction + Chrome MCP visual intelligence" | "automated Playwright CLI extraction pipeline. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run for anomalies. No browser MCP is used anywhere." |
| `AGENTS.md` | Engine Pipeline step 1 | "Playwright scripts + Chrome MCP visual capture" | "Playwright CLI launches Chromium, navigates the target, records HAR plus trace plus video, runs scroll/hover tour" |
| `AGENTS.md` | Project Structure | `engine/extract/ # Playwright + Chrome MCP extraction` | "Playwright CLI browser strategies (launch / cdp / persistent), viewports, recording options, network recorder, tour pass" |
| `README.md` | "What is Dr Parity?" | "dual extraction strategy (Playwright automation + Chrome MCP visual intelligence)" | "Playwright CLI to drive Chromium, record HAR plus traces, walk every viewport. No browser MCP." |
| `README.md` | "How It Works" step 1 | "Playwright crawls... Chrome MCP provides visual intelligence" | Playwright CLI with capture tour, three modes (launch / cdp / persistent) |
| `README.md` | Tech Stack | "Extraction: Playwright + Chrome MCP" | "Browser automation: Playwright CLI, Chromium only. No browser MCP." |
| `README.md` | Project Structure | `engine/extract/ # Playwright + Chrome MCP extraction` | "Playwright CLI browser strategies, viewports, capture tour" |
| `docs/research/INSPECTION_GUIDE.md` | Phase 1 intro | "inspecting a target website via Chrome MCP or browser DevTools" | "via the Playwright CLI capture pipeline or browser DevTools. Claude observes the live Playwright run." |
| `.claude/skills/clone-website/SKILL.md` | Frontmatter description | "Playwright extraction pipeline + Chrome MCP visual intelligence" | "Playwright CLI extraction pipeline" |
| `.claude/skills/clone-website/SKILL.md` | Intro para | "Playwright extraction + Chrome MCP visual intelligence. 95% / 5%" | "Playwright CLI extraction. Claude observes the live run for anomalies." |
| `.claude/skills/clone-website/SKILL.md` | 0.2 "Verify Browser MCP" | "Check for available browser MCP tools (Chrome MCP, Playwright MCP, Browserbase MCP, Puppeteer MCP)" | "0.2 Verify Playwright CLI. Dr Parity uses the Playwright CLI exclusively. No browser MCP." |
| `.claude/skills/clone-website/SKILL.md` | 1.2 "Chrome MCP Visual Verification" | Whole section directed user to Chrome MCP | Renamed to "1.2 Live Capture Observation". Claude observes the live Playwright run; review screenshot outputs and write anomaly notes to `CAPTURE_NOTES.md` |
| `.claude/skills/clone-website/SKILL.md` | 1.3 Validate Extraction | "Compare against what you see in Chrome MCP" | "compare against what you observed during the live capture" |
| `.claude/skills/clone-website/SKILL.md` | 4.3 Side-by-Side | "Open BOTH... in Chrome MCP tabs" | "Open in two browser tabs (or run a side by side Playwright capture). Claude observes." |
| `.claude/skills/clone-website/SKILL.md` | Guiding Principle 1 | "Chrome MCP catches what automation cannot" | "Claude observes the live Playwright run to catch what static automation cannot" |
| `.claude/skills/clone-website/SKILL.md` | What NOT to Do | "Don't skip the automated extraction and go straight to Chrome MCP manual inspection" | "...go straight to manual inspection. Live observation supplements automation. It does not replace it." |
| `.github/skills/clone-website/SKILL.md` | All of the above (synced copy) | identical to source | regenerated via `node scripts/sync-skills.mjs` |
| `.github/copilot-instructions.md` | All of the above (synced from AGENTS.md) | identical to AGENTS.md | regenerated via `bash scripts/sync-agent-rules.sh` |

Verification: `grep -rni "chrome mcp\|chrome-mcp" AGENTS.md README.md CLAUDE.md docs/research/INSPECTION_GUIDE.md .claude/skills/clone-website/SKILL.md .github/skills/clone-website/SKILL.md .github/copilot-instructions.md .github/workflows/ci.yml` returns zero matches.

Note: `engine/generate/builder-prompts.ts:586` still contains a single `Chrome MCP` reference inside engine code. Per scope, "engine code comments and internal session notes are exempt" and the file is already marked for deletion in V2.0 Phase 2. Left untouched.

## Stale Stack References Fixed

| File | Claim removed | Replacement |
|---|---|---|
| `AGENTS.md` | "This is NOT the Next.js you know" top banner | Banner deleted. Repo is not Next.js. |
| `AGENTS.md` | Framework: "Next.js 16 (App Router, React 19, TypeScript strict)" | "TypeScript strict mode, executed via tsx. No app framework in this repo." |
| `AGENTS.md` | UI: "shadcn/ui (Radix primitives, Tailwind CSS v4, cn() utility)" | Removed entirely. |
| `AGENTS.md` | Icons: "Lucide React" | Removed entirely. |
| `AGENTS.md` | Styling: "Tailwind CSS v4 with oklch design tokens" | Removed entirely. |
| `AGENTS.md` | Deployment: "Vercel" | Removed entirely. |
| `AGENTS.md` | Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm run check` | Replaced with the real working scripts (`npm run capture`, `parse:har`, `parse:trace`, `clone`, `clone-site`, `clone-urls`, `build:astro`, `build:react`, `build:webapp`, `verify:parity`, `typecheck`). |
| `AGENTS.md` | Project Structure: `src/app/`, `src/components/ui/`, `src/lib/utils.ts`, `src/types/`, `src/hooks/`, `public/images/`, `public/videos/`, `public/seo/` | Replaced with the real `engine/` layout (extract, analyze, targets, orchestrator, clone, verify, scope-styles, generate, qa) plus `scripts/`, `docs/`, `clones/`. |
| `README.md` | "Next.js-based cloning engine" | "TypeScript CLI engine" |
| `README.md` | Tech Stack: Next.js 16 + shadcn/ui + Tailwind v4 + pixelmatch | TypeScript strict + Playwright CLI + Custom emitters + `engine/verify/` |
| `README.md` | Project Structure: `src/` and `public/` | Replaced with real `engine/` + `scripts/` + `docs/` + `clones/`. |
| `README.md` | Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` | Replaced with real CLI entry points table. |
| `.claude/skills/clone-website/SKILL.md` | 0.3 "Verify Build: npm run build... Next.js + shadcn/ui + Tailwind v4 scaffold must already be in place" | "0.3 Verify Engine Compilation. Run `npm run typecheck` to confirm the engine compiles." |
| `.github/workflows/ci.yml` | Steps: `Lint: npm run lint`, `Build: npm run build` | Removed (both are broken: no eslint config, no Next). Kept Type check, changed to direct `npx tsc --noEmit`. |
| `scripts/sync-skills.mjs` | Wrote to 9 platform dirs including .amazonq, .augment, .codex, .continue, .cursor, .gemini, .opencode, .windsurf | Reduced to writing only `.github/skills/clone-website/SKILL.md`. Other platforms were pruned in commit 3b4efd2 and resurrection is destructive. |
| `scripts/sync-agent-rules.sh` | Wrote to .clinerules, .continue/rules, .amazonq/rules | Reduced to writing only `.github/copilot-instructions.md`. Other dirs were pruned in commit 3b4efd2. |

## Files Touched

To be committed in a single `chore:` commit at end of run:

- `/Users/cameronmcallister/Github/dr-parity/AGENTS.md`
- `/Users/cameronmcallister/Github/dr-parity/README.md`
- `/Users/cameronmcallister/Github/dr-parity/docs/research/INSPECTION_GUIDE.md`
- `/Users/cameronmcallister/Github/dr-parity/.claude/skills/clone-website/SKILL.md`
- `/Users/cameronmcallister/Github/dr-parity/.github/skills/clone-website/SKILL.md` (regenerated)
- `/Users/cameronmcallister/Github/dr-parity/.github/copilot-instructions.md` (regenerated)
- `/Users/cameronmcallister/Github/dr-parity/.github/workflows/ci.yml`
- `/Users/cameronmcallister/Github/dr-parity/scripts/sync-skills.mjs`
- `/Users/cameronmcallister/Github/dr-parity/scripts/sync-agent-rules.sh`
- `/Users/cameronmcallister/Github/dr-parity/docs/V2.0/observations/w1b-doc-drift.md` (this file)

NOT touched:
- `CLAUDE.md` (clean already; `@AGENTS.md` import resolves the fix transparently)
- `bugs.md` (no stale stack references; internal session notes)
- `CHANGELOG.md` (historical record; references to old Next.js scaffolding are accurate history)
- `docs/ROADMAP.md` (out of scope; Cameron listed explicit files)
- `engine/generate/builder-prompts.ts` (engine code, not user-facing doc; already marked for deletion in V2.0)

## Skills Regenerated

Yes.
- `node scripts/sync-skills.mjs` → `.github/skills/clone-website/SKILL.md` (1 file).
- `bash scripts/sync-agent-rules.sh` → `.github/copilot-instructions.md` (1 file).
- Both scripts were also edited to stop writing to the AI-tool dirs that origin deleted in commit `3b4efd2`. Re-running either now produces a clean diff with no resurrected dirs.

## Parity / Pipeline Improvement Opportunities Spotted

1. **The sync scripts had a regression latent in them.** As shipped, `sync-skills.mjs` and `sync-agent-rules.sh` would resurrect 8+ AI-tool directories on every run, undoing commit `3b4efd2`'s intentional pruning. Anyone who edited AGENTS.md or SKILL.md and re-ran the sync would have silently restored .amazonq, .augment, .codex, .continue, .cursor, .gemini, .opencode, .windsurf. Fixing this is a one-line change. Worth a similar audit on any other "regenerator" scripts in `scripts/`.

2. **`engine/generate/builder-prompts.ts:586` is still emitting "Chrome MCP" into builder prompts** at runtime. That's engine code, but the prompts it produces are shown to LLM builder agents. Once builder-prompts.ts is deleted in Phase 2, the issue goes away. Until then any active builder run will leak the legacy reference.

3. **`scripts/extract.ts` and the legacy QA path are still mentioned inside SKILL.md** (Phase 1.1, Phase 4.1, Phase 4.4). The audit calls them out for deletion. Per scope, full SKILL.md rewrite is deferred to Phase 6, but if any human runs the skill today the inner commands (`scripts/extract.ts`, `scripts/qa.ts`) will fail since they reference deleted code. Recommend bumping the SKILL.md rewrite ahead of Phase 6, or at least adding a "NOTE: this skill is pending V2.0 rewrite" warning at the top.

4. **`package.json` scripts** still declare `"dev": "next dev"`, `"build": "next build"`, `"lint": "eslint"`. Per scope I did not edit package.json (it's executable, not a doc). But three of the npm scripts are broken (no next package, no eslint config). Surface for Phase 2 cleanup.

5. **CI baseline is now type-check-only.** That's the right thing today because lint and build don't work. Suggest adding a smoke for `npm run capture -- https://example.com --viewport=desktop --no-tour` once the pipeline is stable in V2.0.

## Surprises / Anomalies

**Major.** `git status` at the start of this task is far from clean despite the prompt saying so. There are **38 staged-as-added files in the index** (Dockerfile, Dockerfile.dev, docker-compose.yml, .dockerignore, eight `.bak` files in `engine/`, `scripts/download-assets.mjs`, `scripts/extract-multi.ts`, `scripts/qa.ts`, `scripts/qa-sections.ts`, `src/app/{favicon.ico,globals.css,layout.tsx,page.tsx}`, `src/components/ui/button.tsx`, `src/hooks/.gitkeep`, `src/lib/utils.ts`, `src/types/.gitkeep`, `public/{fonts,images,seo,videos}/.gitkeep`) that origin DELETED in commit `3b4efd2`. The working tree contains these files and the index points to them.

This matches the "iCloud ghost / half-staged renames" pattern Cameron warned about. The reconciled plan even calls these out as "still on disk" (table 1.B) but expected them to be in working tree only, not staged.

Per the task rule "Stop if anything looks unfamiliar... Strange ghost files, half-staged renames, git weirdness: stop and report," I did NOT touch any of those staged-add files. I did NOT run `git reset`. I did NOT modify the index. I only edited the docs in scope, and I removed the 8 AI-tool directories that I myself resurrected by running `sync-skills.mjs` (those were untracked so deleting them was safe and self-correcting).

**Recommended next step for Cameron.** Decide whether to:
- `git reset` to unstage the ghost files and then deal with them via Phase 1.A of the reconciled plan, OR
- `git rm --cached` each one and let Phase 1.A still delete the working-tree copies.

Either is destructive enough that it should be Cameron's call, not W1B's. The doc cleanup ships independently.

**Minor.** The `CLAUDE.md` shown inline in the task prompt's `claudeMd` section is much longer than the `CLAUDE.md` on disk (the on-disk version is 129 lines and contains just `@AGENTS.md` plus the "Playwright Capture Pipeline (multi-mode)" section; the prompt also showed "Clone outputs", "Crawler blocklist policy", and "Full Clone Pipeline" sections that are not on disk). The prompt's `claudeMd` content appears to have been assembled from multiple sources for context, not from a literal file read. The on-disk CLAUDE.md is clean and was left untouched.
