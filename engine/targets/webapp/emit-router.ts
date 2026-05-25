/**
 * Emit `src/router.tsx` and update `src/main.tsx` to use it.
 *
 * Phase 1 emitted a stub router via writeRouterStub; this Phase 3 emitter
 * replaces that with a proper BrowserRouter + Routes tree wired to the
 * stateful page components produced by emit-stateful.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { deriveComponentName } from './route-naming';
import type { RouteGroup } from './inference/types';

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(filePath: string, content: string): number {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export interface RouterRouteEntry {
  routePath: string;
  componentName: string;
}

export function buildRouteEntries(routes: RouteGroup[]): RouterRouteEntry[] {
  return routes.map((r) => ({
    routePath: r.routePath,
    componentName: deriveComponentName(r.routePath),
  }));
}

export function emitRouter(
  routes: RouteGroup[],
  outDir: string,
): { name: string; bytes: number } {
  const entries = buildRouteEntries(routes);
  const srcDir = join(outDir, 'src');
  const filePath = join(srcDir, 'router.tsx');

  const imports = entries
    .map((e) => `import ${e.componentName} from './pages/${e.componentName}';`)
    .join('\n');

  const routeTags = entries
    .map((e) => `        <Route path="${e.routePath}" element={<${e.componentName} />} />`)
    .join('\n');

  const content = [
    "import { BrowserRouter, Routes, Route } from 'react-router-dom';",
    imports,
    '',
    'export function AppRouter() {',
    '  return (',
    '    <BrowserRouter>',
    '      <Routes>',
    routeTags,
    '      </Routes>',
    '    </BrowserRouter>',
    '  );',
    '}',
    '',
    'export default AppRouter;',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'router', bytes };
}

export interface EmitStatefulMainOptions {
  /**
   * When true, `main.tsx` imports `./mocks/socket` and starts the captured
   * websocket replay in dev. Defaults to false so the no-realtime path emits
   * exactly the same boot as before.
   */
  startSocketMocks?: boolean;
}

export function emitStatefulMain(
  outDir: string,
  options: EmitStatefulMainOptions = {},
): { name: string; bytes: number } {
  const filePath = join(outDir, 'src', 'main.tsx');
  const withSockets = options.startSocketMocks === true;

  const socketImport = withSockets
    ? ["import { startSocketMocks } from './mocks/socket';"]
    : [];
  const socketBoot = withSockets ? ['    startSocketMocks();'] : [];

  const content = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import { AppRouter } from './router';",
    "import { runPostHydrationSync } from './lib/post-hydration-sync';",
    ...socketImport,
    '',
    'async function bootstrap(): Promise<void> {',
    '  if (import.meta.env.DEV) {',
    "    const { worker } = await import('./mocks/browser');",
    "    await worker.start({ onUnhandledRequest: 'bypass' });",
    ...socketBoot,
    '  }',
    '',
    "  const rootEl = document.getElementById('root');",
    "  if (!rootEl) throw new Error('Missing #root element');",
    '',
    '  ReactDOM.createRoot(rootEl).render(',
    '    <React.StrictMode>',
    '      <AppRouter />',
    '    </React.StrictMode>,',
    '  );',
    '',
    '  runPostHydrationSync();',
    '}',
    '',
    'void bootstrap();',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'main', bytes };
}
