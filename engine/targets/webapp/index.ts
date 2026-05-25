/**
 * Webapp target entry point. Mirrors the shape of the React adapter so
 * `scripts/build.ts` can dispatch to either via the `TargetAdapter`
 * contract.
 *
 * Phase 1 ships single-page emission only. `buildMulti` is intentionally
 * omitted — multi-page emission is Phase 2 once the crawler exists to
 * produce per-route clone dirs.
 */

import { basename, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import type {
  TargetAdapter,
  TargetBuildOptions,
  TargetBuildSummary,
} from '../types';
import { buildWebappProject } from './build';

export { buildWebappProject, validateCloneDir } from './build';
export { writeApp, writeComponent, writeIndexHtml, writeMain } from './emit';
export type { RouteEntry } from './emit';
export {
  writeScaffold,
  writePackageJson,
  writeViteConfig,
  writeTsConfig,
  writeMswSetup,
  writeRouterStub,
  writeReadme,
  writeEnvExample,
  writeGitignore,
  writeCustomElementsDts,
} from './scaffold';
export type {
  WebappComponentDef,
  WebappBuildOptions,
  WebappBuildSummary,
  WebappStatePair,
  ComponentDef,
  ComponentRole,
  ExtractedHead,
  SliceResult,
} from './types';
export {
  loadCrawlGraph,
  inferStateGroups,
  diffStates,
  classifyToggle,
  detectDismissStrategy,
} from './inference';
export type {
  DismissStrategy,
  DomDiff,
  DomDiffClassification,
  InferenceResult,
  RouteGroup,
  SerializedElement,
  StateGroup,
  StateToggle,
  ToggleKind,
} from './inference';
export { emitStatefulComponent, writeStatefulPage } from './emit-stateful';
export { emitRouter, emitStatefulMain } from './emit-router';
export { emitMocks } from './emit-mocks';
export { emitRealtime } from './emit-realtime';
export { writeRealtimeOutputs } from './emit-realtime/write-outputs';
export { emitSpec } from './emit-spec';
export type { EmitSpecResult } from './emit-spec';

function deriveDefaultName(cloneDir: string): string {
  const manifestPath = join(cloneDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { documentUrl?: string };
      const url = manifest.documentUrl;
      if (typeof url === 'string' && url.length > 0) {
        try {
          const host = new URL(url).hostname.replace(/^www\./, '');
          if (host.length > 0) return host.replace(/[^a-z0-9.-]/gi, '-');
        } catch {
          // fall through
        }
      }
    } catch {
      // fall through
    }
  }
  return basename(resolve(cloneDir, '..')) || 'webapp-site';
}

export const webappAdapter: TargetAdapter = {
  name: 'webapp',
  async build(options: TargetBuildOptions): Promise<TargetBuildSummary> {
    const absClone = resolve(options.cloneDir);
    const absOut = resolve(options.outDir);
    const name = options.name ?? deriveDefaultName(absClone);
    const force = options.force ?? false;
    // `crawlDir` now lives on the shared `TargetBuildOptions` contract so
    // scripts can pass it through without a structural cast. Astro and
    // React adapters ignore this field; only the webapp target consumes
    // it (stateful build mode).
    const crawlDir = options.crawlDir;

    const summary = await buildWebappProject({
      cloneDir: absClone,
      outDir: absOut,
      name,
      force,
      ...(crawlDir ? { crawlDir: resolve(crawlDir) } : {}),
    });

    return {
      outDir: absOut,
      componentsEmitted: summary.componentsEmitted,
      pagesEmitted: summary.pagesEmitted,
      assetCount: summary.assetCount,
      assetBytes: summary.assetBytes,
    };
  },
};
