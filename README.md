# Dr Parity

> 1:1 website and web app cloning engine — pixel-perfect, animation-accurate, fully automated.

## What is Dr Parity?

Dr Parity is a Next.js-based cloning engine that reverse-engineers any website into a clean, modern codebase. It uses a dual extraction strategy (Playwright automation + Chrome MCP visual intelligence) to capture every detail — from computed styles to complex scroll-driven animations.

## Quick Start

```bash
# Clone to start a new project
git clone https://github.com/CameronMc12/dr-parity.git my-project
cd my-project
npm install

# Launch Claude Code, then run:
/clone-website https://example.com "Full homepage with all animations"
```

## How It Works

Dr Parity runs a 5-phase pipeline:

1. **Extract** — Playwright crawls the page capturing every computed style, font, asset, and animation. Chrome MCP provides visual intelligence and animation observation.
2. **Analyze** — Structures raw data into typed specs: page topology, component tree, design tokens, behavior models.
3. **Generate** — Builds Next.js components from specs with exact styles, animations, and responsive behavior.
4. **Compare** — Screenshots the clone vs original, runs pixel-diff to find discrepancies.
5. **Iterate** — Fixes sections with >5% pixel difference until the threshold is met.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui + Tailwind CSS v4
- **Extraction:** Playwright + Chrome MCP
- **QA:** pixelmatch for visual regression

## Project Structure

```
dr-parity/
├── src/                    # Next.js app (clone output)
├── engine/                 # The cloning engine
│   ├── extract/            # Playwright + Chrome MCP extraction
│   ├── analyze/            # Topology, components, tokens, behaviors
│   ├── generate/           # Code generation from specs
│   ├── qa/                 # Screenshot comparison & fix loop
│   └── types/              # TypeScript interfaces
├── docs/
│   ├── research/           # Extraction output
│   ├── design-references/  # Screenshots
│   └── animations/         # Documented animations
├── scripts/                # CLI entry points
└── public/                 # Downloaded assets
```

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check

## License

MIT
