/**
 * Emit `src/router.tsx` for the shell/content split: a single LAYOUT route that
 * renders the persistent shell + <Outlet/>, wrapping one child route per
 * captured route. Navigating between children swaps only the Outlet subtree;
 * the layout (and therefore the shell) stays mounted.
 *
 * A catch-all child redirects unknown paths to the first captured route so a
 * bare `/` load still lands on real content.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { deriveComponentName } from '../route-naming';
import type { RouteGroup } from '../inference/types';

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(filePath: string, content: string): number {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export interface ShellRouterEntry {
  routePath: string;
  contentComponent: string;
}

export function buildShellRouterEntries(routes: RouteGroup[]): ShellRouterEntry[] {
  return routes.map((r) => ({
    routePath: r.routePath,
    contentComponent: `${deriveComponentName(r.routePath)}Content`,
  }));
}

export function emitShellRouter(args: {
  routes: RouteGroup[];
  layoutComponent: string;
  outDir: string;
}): { name: string; bytes: number } {
  const { routes, layoutComponent, outDir } = args;
  const entries = buildShellRouterEntries(routes);
  const filePath = join(outDir, 'src', 'router.tsx');

  const firstPath = entries.length > 0 ? entries[0].routePath : '/';

  const imports = [
    `import { ${layoutComponent} } from './pages/${layoutComponent}';`,
    ...entries.map(
      (e) => `import { ${e.contentComponent} } from './pages/${e.contentComponent}';`,
    ),
  ].join('\n');

  const childRoutes = entries
    .map(
      (e) =>
        `          <Route path="${e.routePath}" element={<${e.contentComponent} />} />`,
    )
    .join('\n');

  const content = [
    "import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';",
    imports,
    '',
    'export function AppRouter() {',
    '  return (',
    '    <BrowserRouter>',
    '      <Routes>',
    `        <Route element={<${layoutComponent} />}>`,
    childRoutes,
    `          <Route path="*" element={<Navigate to="${firstPath}" replace />} />`,
    '        </Route>',
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
