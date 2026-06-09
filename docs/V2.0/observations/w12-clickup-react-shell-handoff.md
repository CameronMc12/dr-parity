# W12 ClickUp React Shell Handoff

Date: 2026-05-28

This is the short handoff for the next Claude session.

## What changed

Codex set up the monorepo and continued the ClickUp React shell clone in `apps/web`.

Main additions:

- `apps/web`: Next 15 app for the ClickUp React shell.
- `packages/design-system`: ClickUp tokens, global CSS, and copied vendor/icon assets.
- `packages/ui`: starter shared primitives package.
- Root monorepo files: `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`.

Main shell files touched:

- `apps/web/src/components/ClickUpWorkspace.tsx`
- `apps/web/src/components/shell/sidebars/HomeSidebar.tsx`
- `apps/web/src/components/shell/Sidebar.tsx`
- `packages/design-system/src/clickup-globals.css`

## Key correction

Do not route list/doc/inbox shell views to separate Spaces/Docs sidebars.

The saved oracle screenshots at `tooling/parity-harness/output/2026-05-28T14-00-02` show that the real ClickUp shell keeps the `Home` sidebar for these routes:

- home
- notifications/inbox
- list view
- doc view

Doc routes expand the Spaces tree inside the Home sidebar. The active row is `Getting Started Guide` under `Software Development > Sprint Team`.

Current React behavior now follows that:

- `/home` highlights `My Tasks`
- `/inbox` and `/notifications` highlight `Inbox`
- `/v/l/...` highlights `All Tasks`
- `/v/dc/...` expands `Software Development > Sprint Team` and highlights `Getting Started Guide`

## Commands that passed

```bash
npm run typecheck
pnpm --filter @parity/web exec tsc --noEmit
pnpm --filter @parity/web build
```

`next build` still prints the ESLint warning because ESLint is not installed, but the build exits successfully.

## Dev server cleanup

If Next throws stale Webpack/runtime errors, clear the generated Next cache and restart:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:5174 -sTCP:LISTEN
kill <stale-node-pids>
find apps/web/.next -mindepth 1 -maxdepth 1 -exec rm -r {} +
pnpm --filter @parity/web dev
```

## Next verification

Codex could not bind local ports in its sandbox, so it could not rerun screenshot parity after the final sidebar correction.

Run locally:

```bash
pnpm --filter @parity/web dev
npx serve /private/tmp/dr-parity-clone-final -l 7050
cd tooling/parity-harness
npm run parity:shell
```

Compare against `tooling/parity-harness/output/2026-05-28T14-00-02`. The expected improvement is specifically sidebar parity for list/doc/inbox routes.

## Caution

`SpacesSidebar.tsx` and `DocsSidebar.tsx` exist, but they were an earlier wrong direction for the main shell routes. Keep them only if a captured oracle route actually shows those hub-specific sidebars.
