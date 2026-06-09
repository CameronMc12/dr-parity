/**
 * React target entry point.
 *
 * Mirrors the Astro adapter surface: exports the build functions, scaffold
 * helpers, and a `reactAdapter` value conforming to the cross-target
 * `TargetAdapter` contract.
 */

import { basename, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

import type {
  TargetAdapter,
  TargetBuildOptions,
  TargetBuildSummary,
  TargetMultiBuildOptions,
  TargetMultiBuildSummary,
} from '../types';
import { buildReactProject } from './build';
import { buildReactMulti } from './build-multi';

export { buildReactProject, validateCloneDir } from './build';
export { buildReactMulti } from './build-multi';
export type {
  ReactMultiPageInput,
  ReactMultiBuildOptions,
  ReactMultiBuildSummary,
} from './build-multi';
export { emitMultiPageReact, routeToPageName } from './emit-multi';
export type {
  ReactPageSlice,
  MultiEmitOptions,
  MultiEmitSummary,
} from './emit-multi';
export {
  writeMultiScaffold,
  writeMultiViteConfig,
  writeMultiReadme,
} from './scaffold-multi';
export {
  writePostHydrationSyncLib,
  POST_HYDRATION_SYNC_SOURCE,
} from './post-hydration-sync';
export { writeApp, writeComponent, writeIndexHtml, writeMain } from './emit';
export type { EmitOptions } from './emit';
export { htmlToJsx } from './html-to-jsx';
export type { HtmlToJsxOptions } from './html-to-jsx';
export {
  writeScaffold,
  writePackageJson,
  writeViteConfig,
  writeTsConfig,
  writeReadme,
  writeEnvExample,
  writeGitignore,
  writeCustomElementsDts,
  writeGlobalCss,
} from './scaffold';
export type {
  ComponentDef,
  ComponentRole,
  ExtractedHead,
  SliceResult,
  ReactComponentDef,
  BuildOptions,
  BuildSummary,
} from './types';

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
  return basename(resolve(cloneDir, '..')) || 'react-site';
}

/**
 * TargetAdapter implementation for React.
 */
export const reactAdapter: TargetAdapter = {
  name: 'react',
  async build(options: TargetBuildOptions): Promise<TargetBuildSummary> {
    if (!options.cloneDir) {
      throw new Error('React target requires a clone-dir (cloneDir).');
    }
    const absClone = resolve(options.cloneDir);
    const absOut = resolve(options.outDir);
    const name = options.name ?? deriveDefaultName(absClone);
    const force = options.force ?? false;

    const summary = await buildReactProject({
      cloneDir: absClone,
      outDir: absOut,
      name,
      force,
    });

    // Each component entry plus App + main + post-hydration-sync lib +
    // index.html. Subtract those 4 page-infra entries so the count
    // reflects emitted *section* components.
    const componentsEmitted = Math.max(0, summary.components.length - 4);
    return {
      outDir: absOut,
      componentsEmitted,
      pagesEmitted: 1,
      assetCount: summary.assetCount,
      assetBytes: summary.assetBytes,
    };
  },
  async buildMulti(options: TargetMultiBuildOptions): Promise<TargetMultiBuildSummary> {
    if (options.pages.length === 0) {
      throw new Error('reactAdapter.buildMulti: no pages provided');
    }
    const absOut = resolve(options.outDir);
    const name = options.name ?? deriveDefaultName(resolve(options.pages[0].cloneDir));
    const force = options.force ?? false;

    const summary = await buildReactMulti({
      pages: options.pages.map((p) => ({
        cloneDir: p.cloneDir,
        pathname: p.pathname,
        url: p.url,
      })),
      outDir: absOut,
      name,
      force,
    });

    return {
      outDir: absOut,
      pagesEmitted: summary.pagesEmitted,
      sharedComponents: summary.sharedComponents,
      perPageComponents: summary.perPageComponents,
      assetCount: summary.assetCount,
      assetBytes: summary.assetBytes,
    };
  },
};
