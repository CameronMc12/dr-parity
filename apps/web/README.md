# @parity/web

Next.js 15 App Router shell for the owned ClickUp reconstruction.

## Run

```bash
pnpm install
pnpm --filter @parity/web dev
```

The dev server uses `http://localhost:5173` so the existing parity harness can keep comparing against the replay oracle at `http://localhost:7050`.

## Current Scope

- ClickUp shell ported from `apps/clickup-react`.
- Catch-all route support for workspace paths:
  - `/:wsId/home`
  - `/:wsId/notifications`
  - `/:wsId/inbox`
  - `/:wsId/settings/*`
  - `/:wsId/v/:viewType/:viewId`
  - `/:wsId/v/dc/:docId/:pageId?`
- ClickUp CSS and captured icon assets live in `@parity/design-system`.

`apps/clickup-react` remains as the Vite reference until this app takes over parity runs.
