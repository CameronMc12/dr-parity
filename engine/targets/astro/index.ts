/**
 * Astro target entry point.
 *
 * Re-exports the public surface used by scripts and other engine code, and
 * exposes the `astroAdapter` value conforming to the cross-target
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
import { buildAstroProject } from './build';
import { buildAstroMulti as buildAstroMultiInner } from './build-multi';

export { buildAstroProject, validateCloneDir } from './build';
export { buildAstroMulti } from './build-multi';
export type {
  MultiPageInput,
  MultiBuildOptions,
  MultiBuildSummary,
} from './build-multi';
export { writeComponent, writeLayout, writePage } from './emit';
export { emitMultiPage, routeToPageName } from './emit-multi';
export type {
  PageSlice,
  MultiEmitOptions,
  MultiEmitSummary,
} from './emit-multi';
export { centralizeContent } from './centralize-content';
export type { CentralizeSummary } from './centralize-content';
export { prettifyAstro, prettifyEmittedDir, prettifyDisabled, structurallyEquivalent } from './prettify';
export type { PrettifyResult } from './prettify';
export { injectIsInline } from './is-inline';
export {
  writeScaffold,
  writeSeoConfigs,
  writePackageJson,
  writeAstroConfig,
  writeTsConfig,
  writeReadme,
  writeHeaders,
  writeEnvExample,
  renderSeoConfig,
  renderTrackingConfig,
  renderSeoAstro,
} from './scaffold';
export type { SeoSeed, SeoEmitSummary } from './scaffold';
export type { ComponentDef, ComponentRole, ExtractedHead, SliceResult, BuildOptions, BuildSummary } from './types';

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
  return basename(resolve(cloneDir, '..')) || 'astro-site';
}

/**
 * TargetAdapter implementation for Astro.
 *
 * Bridges the cross-target `TargetBuildOptions` shape to the Astro-specific
 * `BuildOptions`, defaulting the project name when not supplied so the
 * adapter contract stays minimal for callers.
 */
export const astroAdapter: TargetAdapter = {
  name: 'astro',
  async build(options: TargetBuildOptions): Promise<TargetBuildSummary> {
    const absClone = resolve(options.cloneDir);
    const absOut = resolve(options.outDir);
    const name = options.name ?? deriveDefaultName(absClone);
    const force = options.force ?? false;

    const summary = await buildAstroProject({
      cloneDir: absClone,
      outDir: absOut,
      name,
      force,
    });

    // Layout + each section + index = components emitted entries; subtract
    // the synthetic index page entry to report it under pagesEmitted.
    const componentsEmitted = Math.max(0, summary.components.length - 1);
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
      throw new Error('astroAdapter.buildMulti: no pages provided');
    }
    const absOut = resolve(options.outDir);
    const name = options.name ?? deriveDefaultName(resolve(options.pages[0].cloneDir));
    const force = options.force ?? false;

    const summary = await buildAstroMultiInner({
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

