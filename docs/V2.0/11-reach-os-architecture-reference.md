# reach-os Architecture Reference (for dr-parity React app port)

**Date:** 2026-05-28  
**Source:** /Users/cameronmcallister/Github/reach-os/

---

## Top-level Directory Tree

```
reach-os/
├── apps/
│   ├── web/              (Next.js SPA for operator dashboard)
│   ├── api/              (Hono/Node.js backend)
│   ├── worker/           (Job processor on Redis)
│   ├── image-worker/     (Higgsfield integration)
│   ├── desktop/          (Electron or desktop shell)
│   ├── prototype/        (Design/prototyping sandbox)
│   ├── cli/              (CLI tooling)
│   └── proxy/            (Reverse proxy)
│
├── packages/
│   ├── ui/               (@reach/ui — reusable React components)
│   ├── design-system/    (@reach/design-system — Tailwind v4 tokens + primitives)
│   ├── core/             (@reach/core — utilities, CLI libs, validators)
│   ├── db/               (@reach/db — Drizzle ORM + Store interfaces + seams)
│   ├── agent/            (@reach/agent — LLM orchestration)
│   ├── engine/           (@reach/engine — evaluation/execution runtime)
│   ├── authoring/        (@reach/authoring — prompt engineering tools)
│   ├── integrations/     (@reach/integrations — external APIs)
│   ├── ml/               (@reach/ml — model utilities)
│   ├── eval/             (@reach/eval — evaluation framework)
│   ├── observability/    (@reach/observability — logging/tracing)
│   └── templates/        (@reach/templates — prompt/action templates)
│
├── docker/               (Postgres init scripts)
├── tsconfig.base.json    (Base TS config for monorepo)
├── biome.json            (Code formatter + linter)
├── pnpm-workspace.yaml   (Workspace roots)
├── turbo.json            (Build orchestration)
├── docker-compose.yml    (Local dev environment)
└── package.json          (Monorepo root)
```

---

## Root Configs

### package.json
```json
{
  "name": "reach-os",
  "version": "0.0.1",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo typecheck",
    "test": "turbo test"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "turbo": "^2.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": { "node": ">=20" }
}
```

### tsconfig.base.json (Key Fields)
- `target`: ES2022
- `module`: ESNext
- `moduleResolution`: Bundler
- `strict`: true
- `jsx`: preserve (let bundlers handle JSX)
- `verbatimModuleSyntax`: false (allows type-only imports)
- Excludes: node_modules, dist, .next, build

### biome.json (Full Contents)
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "ignore": [
      "**/node_modules", "**/.next", "**/.turbo", "**/dist", "**/build",
      "**/coverage", "**/*.tsbuildinfo", "**/pnpm-lock.yaml", "**/.venv",
      "packages/design-system/preview/**", "packages/design-system/reference/**"
    ]
  },
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### docker-compose.yml (Services)
- **postgres:15-alpine** → reach-postgres (port 5433)
- **valkey:7.2.11-alpine** → reach-redis (port 6381)
- **minio** → S3-compatible object store (ports 9010/9011)
- **api** → Dockerfile: apps/api/Dockerfile (port 8765)
- **worker** → Dockerfile: apps/worker/Dockerfile (background jobs)
- **image-worker** → Higgsfield integration (port 8100)
- **web** → Dockerfile: apps/web/Dockerfile (port 3000, Next.js)
- **proxy** → Reverse proxy (port 8080)

All connected via reach-net bridge network. Environment variables from .env file.

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## Package Conventions

### Package Naming
All leaf packages use `@reach/` scope:
- `@reach/ui`
- `@reach/design-system`
- `@reach/core`
- `@reach/db`
- `@reach/agent`, etc.

### Representative: @reach/ui

**package.json:**
```json
{
  "name": "@reach/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.tsx",
  "types": "./src/index.tsx",
  "exports": { ".": "./src/index.tsx" },
  "files": ["src"],
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@reach/design-system": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"]
}
```

**Barrel Export (src/index.tsx):**
```typescript
/**
 * @reach/ui — Reach-specific React components composed from @reach/design-system primitives.
 * Surfaces (swipe card, calendar, queue, suggestions inbox) land here in later phases.
 */
export * from "@reach/design-system/primitives";
```

---

## Design-System + UI Wiring

### @reach/design-system

The design-system package exports tokens via Tailwind v4's `@theme` and CSS variables.

**Exports in package.json:**
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./fonts.css": "./src/fonts.css",
    "./primitives": "./src/primitives/index.tsx",
    "./assets/*": "./assets/*"
  }
}
```

**tokens.css Structure:**
```css
/* CSS spec: @import rules first */
@import "../colors_and_type.css";

/* Tailwind v4 @theme mapping */
@import "tailwindcss";

@theme inline {
  /* Krevio color palette */
  --color-krevio-ink: #0c0c0c;
  --color-krevio-white: #ffffff;
  --color-krevio-light-grey: #f5f5f5;
  --color-krevio-border: #e4e4e4;
  --color-krevio-muted: #6b6b6b;
  --color-krevio-red: #ff600a;
  --color-krevio-acid: #d2ff37;

  /* Semantic aliases */
  --color-fg-1: #0c0c0c;
  --color-fg-2: #6b6b6b;
  --color-bg-page: #ffffff;
  --color-bg-inset: #f5f5f5;
  --color-accent-action: #ff600a;
  /* ... status palette, spacing, typography, etc. */
}
```

### Web App Consumption

**apps/web/src/app/layout.tsx:**
```typescript
import "@reach/design-system/fonts.css";
import "@reach/design-system/tokens.css";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-bg-page text-fg-1">
      <body className="bg-bg-page text-fg-1 antialiased">{children}</body>
    </html>
  );
}
```

**apps/web/src/app/globals.css:**
```css
@import "tailwindcss";

/* Token sheet is imported in layout.tsx as a global module.
   Tailwind v4 picks up @theme block from there. */

@layer base {
  html, body {
    min-height: 100%;
  }
  body {
    font-family: var(--font-sans);
  }
}
```

**apps/web/postcss.config.mjs:**
```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

Result: Utilities like `bg-bg-page`, `text-fg-1`, `text-krevio-acid` resolve to the canonical Krevio tokens.

---

## Repository Pattern (Concrete Example: CycleStore)

### Interface + Type Definitions

**packages/db/src/stores/cycle-store.ts:**
```typescript
export type CycleScope = "week" | "month";

export interface CycleRow {
  id: string;
  clientId: string;
  scope: CycleScope;
  isoKey: string;           // ISO week ("2026-W23") or month ("2026-06")
  theme: string | null;
  goals: Record<string, unknown> | null;
  status: string;
  createdAt: Date;
}

export interface CycleInput {
  clientId: string;
  scope: CycleScope;
  isoKey: string;
  theme?: string | null;
  goals?: Record<string, unknown> | null;
  status?: string;
}

export interface CycleStore {
  /**
   * Idempotent upsert. If cycle exists for (clientId, scope, isoKey),
   * return it unchanged (created=false). Authored fields (theme/goals/status)
   * are NEVER overwritten.
   */
  upsert(input: CycleInput): Promise<{ row: CycleRow; created: boolean }>;
  get(id: string): Promise<CycleRow | null>;
  byKey(clientId: string, scope: CycleScope, isoKey: string): Promise<CycleRow | null>;
}
```

### DbCycleStore (Drizzle Implementation)

```typescript
export class DbCycleStore implements CycleStore {
  async upsert(input: CycleInput): Promise<{ row: CycleRow; created: boolean }> {
    // Read-then-write: preserves authored fields on conflict
    const existing = await this.byKey(input.clientId, input.scope, input.isoKey);
    if (existing) return { row: existing, created: false };

    const [inserted] = await db
      .insert(cycles)
      .values({
        clientId: input.clientId,
        scope: input.scope,
        isoKey: input.isoKey,
        theme: input.theme ?? null,
        goals: input.goals ?? null,
        status: input.status ?? "draft",
      })
      .onConflictDoNothing({
        target: [cycles.clientId, cycles.scope, cycles.isoKey],
      })
      .returning();

    if (!inserted) {
      const row = await this.byKey(input.clientId, input.scope, input.isoKey);
      if (!row) throw new Error("Insert conflicted but no existing row found.");
      return { row, created: false };
    }
    return { row: toRow(inserted), created: true };
  }

  async get(id: string): Promise<CycleRow | null> {
    const rows = await db.select().from(cycles).where(eq(cycles.id, id)).limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }

  async byKey(clientId: string, scope: CycleScope, isoKey: string): Promise<CycleRow | null> {
    const rows = await db
      .select()
      .from(cycles)
      .where(and(eq(cycles.clientId, clientId), eq(cycles.scope, scope), eq(cycles.isoKey, isoKey)))
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  }
}
```

### MemoryCycleStore (In-Memory Implementation)

```typescript
export class MemoryCycleStore implements CycleStore {
  private rows: CycleRow[] = [];

  async upsert(input: CycleInput): Promise<{ row: CycleRow; created: boolean }> {
    const existing = await this.byKey(input.clientId, input.scope, input.isoKey);
    if (existing) return { row: existing, created: false };

    const row: CycleRow = {
      id: randomUUID(),
      clientId: input.clientId,
      scope: input.scope,
      isoKey: input.isoKey,
      theme: input.theme ?? null,
      goals: input.goals ?? null,
      status: input.status ?? "draft",
      createdAt: new Date(),
    };
    this.rows.push(row);
    return { row, created: true };
  }

  async get(id: string): Promise<CycleRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async byKey(clientId: string, scope: CycleScope, isoKey: string): Promise<CycleRow | null> {
    return this.rows.find(
      (r) => r.clientId === clientId && r.scope === scope && r.isoKey === isoKey,
    ) ?? null;
  }

  reset(): void { this.rows = []; }
  all(): CycleRow[] { return [...this.rows]; }
}
```

**Pattern:** Interface defines contract. DbCycleStore talks to Drizzle/Postgres. MemoryCycleStore is a test double. Both implement identical async semantics.

---

## Service Seams

### SecretsProvider

**packages/db/src/seams/secrets.ts:**
```typescript
export interface SecretsProvider {
  get(key: string): Promise<string | null>;
}

export class EnvSecretsProvider implements SecretsProvider {
  async get(key: string): Promise<string | null> {
    return process.env[key] ?? null;
  }
}
```

### IdentityProvider

**packages/db/src/seams/identity.ts:**
```typescript
export interface Identity {
  userId: string;
  currentClientSlug: string | null;
}

export interface IdentityProvider {
  getCurrent(): Promise<Identity>;
}

export class LocalIdentityProvider implements IdentityProvider {
  async getCurrent(): Promise<Identity> {
    return {
      userId: "cameron",
      currentClientSlug: process.env.REACH_CURRENT_CLIENT ?? null,
    };
  }
}
```

**Pattern:** Seams (provider interfaces) define how external dependencies are accessed. Multiple implementations (Env, Local, Remote, Mock) can be swapped without changing consumer code. Used throughout for testing and environment flexibility.

---

## API Structure & URL Prefix Enforcement

### api/v1/reach Prefix

**apps/api/src/index.ts:**
```typescript
import { Hono } from "hono";

const app = new Hono();
app.use("*", loggingMiddleware());
app.use("*", logger());
app.use("*", cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }));

const reach = new Hono();
reach.route("/health", healthRoute);
reach.route("/clients", clientsRoute);
reach.route("/cycles", cyclesRoute);
reach.route("/nodes", nodesRoute);
// ... more routes

app.route("/api/v1/reach", reach);

serve(app, (info) => {
  console.log(`[reach-api] listening on http://localhost:${info.port}/api/v1/reach`);
});
```

All reach routes are grouped under a subrouter, then mounted at `/api/v1/reach`. Result: routes are callable at `/api/v1/reach/health`, `/api/v1/reach/nodes/:nodeId`, etc.

---

## App Shell Convention

### Web App Structure

**apps/web/ layout:**
```
src/
├── app/
│   ├── layout.tsx           (Root RootLayout, imports design-system CSS)
│   ├── globals.css          (Tailwind import)
│   └── [routes]/            (Next.js App Router pages)
├── components/              (Reusable React components)
├── lib/                      (Utilities: api.ts, iso-week.ts, status-colors.ts, etc.)
```

**apps/web/package.json (Key Dependencies):**
```json
{
  "dependencies": {
    "@reach/design-system": "workspace:*",
    "@reach/ui": "workspace:*",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "clsx": "^2.1.1",
    "framer-motion": "^12.0.0",
    "swr": "^2.2.5"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.1.0"
  }
}
```

**next.config.mjs:**
```js
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@reach/design-system", "@reach/ui"],
  experimental: {},
};
export default nextConfig;
```

---

## Dockerfile Pattern

### Multi-stage pnpm build

**apps/api/Dockerfile (pattern used for all apps):**
```dockerfile
# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/
RUN pnpm install --frozen-lockfile --filter @reach/api...

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY --from=deps /repo /repo
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @reach/api... build || true

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 8000
CMD ["pnpm", "dev"]
```

Pattern: deps (install) → build (compile) → runtime (copy built artifacts, run).

---

## How to Mirror This in dr-parity

### Recommended Strategy

1. **Flatten apps/clickup-react into apps/web**
   - Keep Next.js 15 + React 19 stack
   - Move src/ files intact
   - Adopt @reach/design-system + @reach/ui approach

2. **Create packages/ directory with core packages:**
   - `packages/design-system/` — your Tailwind v4 tokens (mirror colors_and_type.css + tokens.css structure)
   - `packages/ui/` — reusable primitives (barrel export from @reach/design-system/primitives)
   - `packages/core/` — shared utilities, validators, CLI libs
   - `packages/db/` (if needed) — Drizzle stores + service seams

3. **Root configs:**
   - Use pnpm workspaces (pnpm-workspace.yaml)
   - Turbo for task orchestration (turbo.json)
   - Biome for formatting + linting (biome.json) with recommended:true
   - Single tsconfig.base.json that all packages extend

4. **Package naming:**
   - Use `@<your-org>/` scope (e.g., `@parity/ui`, `@parity/design-system`)
   - Workspace dependencies: `"workspace:*"`
   - Each package: type="module", exports { ".": "./src/index.ts" }

5. **Design system wiring (critical):**
   - Design-system exports `./tokens.css` with @theme block (Tailwind v4)
   - apps/web imports `@<your-org>/design-system/tokens.css` in layout.tsx
   - postcss.config.mjs: `plugins: { "@tailwindcss/postcss": {} }`
   - globals.css: just `@import "tailwindcss"` (theme comes from tokens.css)

6. **Dockerfile:**
   - Multi-stage: deps → build → runtime
   - Use pnpm workspaces + --filter flags for selective install
   - Base: node:20-alpine

**Result:** Monorepo where all packages share types, tokens, and components; easy to extract and scale.

