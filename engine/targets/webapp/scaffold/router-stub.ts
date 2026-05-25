/**
 * Routes data stub. The real routing tree lives in `App.tsx` (non-crawl
 * path) or `router.tsx` (crawl path); this file just exports a typed list
 * of routes for code that needs the route table without importing the page
 * components themselves (e.g. nav menus, sitemap generation in later
 * phases).
 *
 * It is written to `src/routes.ts` — NOT `router.ts` — so its basename does
 * not collide with the `router.tsx` component file. `main.tsx` imports
 * `{ AppRouter } from './router'`, which must resolve to `router.tsx`; a
 * sibling `router.ts` would shadow it and break the AppRouter import.
 */

import { join } from 'node:path';

import { writeText } from './fs-utils';
import type { RouteEntry } from '../emit';

export function writeRouterStub(outDir: string, routes: readonly RouteEntry[]): void {
  const entries = routes
    .map((r) => `  { path: ${JSON.stringify(r.path)}, componentName: ${JSON.stringify(r.componentName)} },`)
    .join('\n');

  const content = [
    'export interface RouteRecord {',
    '  path: string;',
    '  componentName: string;',
    '}',
    '',
    'export const routes: readonly RouteRecord[] = [',
    entries,
    '];',
    '',
  ].join('\n');

  writeText(join(outDir, 'src', 'routes.ts'), content);
}
