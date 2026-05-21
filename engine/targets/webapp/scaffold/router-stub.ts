/**
 * Router stub. The real routing tree lives in `App.tsx` (emit.ts) so this
 * file just exports a typed list of routes for code that needs to know
 * the route table without importing the page components themselves
 * (e.g. nav menus, sitemap generation in later phases).
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

  writeText(join(outDir, 'src', 'router.ts'), content);
}
