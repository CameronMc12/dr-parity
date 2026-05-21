/**
 * Webapp scaffold orchestrator. Composes the per-concern writers in
 * `scaffold/*.ts` so callers only need a single entrypoint.
 *
 * `writeScaffold` is idempotent — calling it twice over the same outDir
 * overwrites the generated files in place. That mirrors the React target.
 */

import { writePostHydrationSyncLib } from '../react/post-hydration-sync';
import type { RouteEntry } from './emit';

import { writePackageJson } from './scaffold/package-json';
import { writeViteConfig } from './scaffold/vite-config';
import { writeTsConfig } from './scaffold/tsconfig';
import { writeMswSetup } from './scaffold/msw-setup';
import { writeRouterStub } from './scaffold/router-stub';
import {
  writeReadme,
  writeEnvExample,
  writeGitignore,
  writeCustomElementsDts,
} from './scaffold/static-files';

import { join } from 'node:path';

export {
  writePackageJson,
  writeViteConfig,
  writeTsConfig,
  writeMswSetup,
  writeRouterStub,
  writeReadme,
  writeEnvExample,
  writeGitignore,
  writeCustomElementsDts,
};

export interface WriteScaffoldOptions {
  name: string;
  routes: readonly RouteEntry[];
}

export function writeScaffold(outDir: string, options: WriteScaffoldOptions): void {
  writePackageJson(outDir, options.name);
  writeViteConfig(outDir);
  writeTsConfig(outDir);
  writeMswSetup(outDir);
  writeRouterStub(outDir, options.routes);
  writeReadme(outDir, options.name);
  writeEnvExample(outDir);
  writeGitignore(outDir);
  writeCustomElementsDts(outDir);

  writePostHydrationSyncLib(join(outDir, 'src'));
}
