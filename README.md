# Dr Parity

> 1:1 website and web app cloning engine. Pixel-perfect, animation-aware, fully automated.

## What is Dr Parity?

Dr Parity is a TypeScript CLI engine that reverse-engineers any website into a clean, static clone and, optionally, into a framework codebase (Astro, React, or a webapp scaffold). It uses Playwright CLI to drive Chromium, record HAR plus traces, and walk every viewport. Dr Parity always runs inside Claude Code, so Claude observes the live Playwright run and flags anomalies during capture. Dr Parity never uses a browser MCP.

## Quick Start

```bash
git clone https://github.com/CameronMc12/dr-parity.git
cd dr-parity
npm install
npx playwright install chromium

# Capture, parse, and produce a static 1:1 clone in one command.
npm run clone-site -- https://example.com
```

Or invoke from inside Claude Code:

```
/clone-website https://example.com
```

## How It Works

Dr Parity runs a multi-phase pipeline.

1. **Capture.** Playwright CLI launches Chromium, navigates the target, runs a programmatic scroll and hover tour to wake lazy content and animations, and records HAR plus trace plus video at the canonical viewports. Three modes are supported: `launch` (default, isolated Chromium), `cdp` (attach to an existing Chrome on port 9222), and `persistent` (shared user-data-dir for logged-in flows).
2. **Parse.** `parse:har` walks the recorded network log and writes per-viewport `document.html` plus deduplicated `styles/`, `scripts/`, and `assets/`. `parse:trace` unzips the Playwright trace and emits DOM snapshots.
3. **Clone.** The clone step rewrites every captured URL to a local clone-relative path. Output is a fully self-contained static snapshot you can serve with `npx serve`.
4. **Build.** Target adapters (`astro`, `react`, `webapp`) slice the captured DOM into framework code via deterministic emitters. No AI is required for the translation.
5. **Verify.** The verify subsystem screenshots the clone against the original, runs a pixel diff, and reports per-section deltas.

## Tech Stack

- **Language:** TypeScript strict mode, executed via `tsx`.
- **Browser automation:** Playwright CLI, Chromium only. No browser MCP.
- **Target emitters:** Custom emitters under `engine/targets/`.
- **Verify:** `engine/verify/` (screenshots, diff, report).
- **Runtime:** Node.js 24 plus.

## Project Structure

```
dr-parity/
├── engine/                 # The cloning engine.
│   ├── extract/            # Playwright CLI browser strategies, viewports, capture tour.
│   ├── analyze/            # Topology, design tokens, component tree.
│   ├── clone/              # HTML, CSS, and asset rewriters used by the clone step.
│   ├── targets/            # Astro, React, webapp, html-mirror emitters.
│   ├── orchestrator/       # Phase runner and post-build hooks.
│   ├── verify/             # Parity verifier (screenshots, diff, report).
│   ├── scope-styles/       # Style scoping and media-preserve.
│   └── qa/                 # Legacy QA helpers. Slated for cleanup in V2.0.
├── scripts/                # CLI entry points wired into package.json.
├── docs/
│   ├── research/           # Per-host captures and inspection notes.
│   ├── V2.0/               # V2.0 audit, action plan, observations.
│   └── blocklists/         # Per-app crawler blocklists.
└── clones/                 # Gitignored scratch space for clone output.
```

## Commands

The real entry points are npm scripts wired in `package.json`.

| Command | What it does |
|---|---|
| `npm run capture -- <url>` | Capture a target. Modes: `launch`, `cdp`, `persistent`. |
| `npm run parse:har -- <capture-dir>` | Parse the recorded network log into structured HTML, CSS, and assets. |
| `npm run parse:trace -- <capture-dir>` | Unzip the Playwright trace and emit DOM snapshots. |
| `npm run clone -- <capture-dir>` | Rewrite the capture into a self-contained static clone. |
| `npm run clone-site -- <url>` | End-to-end orchestrator. Runs capture, parse:har, parse:trace, and clone. |
| `npm run build:astro` | Emit an Astro project from a clone dir. |
| `npm run build:react` | Emit a React project from a clone dir. |
| `npm run build:webapp` | Emit a webapp scaffold from a crawl dir. |
| `npm run verify:parity` | Run the parity verifier. |
| `npm run typecheck` | `tsc --noEmit` across the repo. |

## Limitations

- The clone captures whatever the tour exercises plus everything the network log records. Deep SPA navigation that the tour does not trigger may need a per-route capture.
- For authenticated apps, use `--mode=persistent` with a pre-logged-in profile.
- Scripts in the clone run unmodified. Production analytics endpoints may still fail in a cloned page.

## License

MIT
