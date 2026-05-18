/**
 * Target adapter contract.
 *
 * Each framework target (Astro, React, etc.) implements this contract so that
 * higher-level orchestrators can swap targets without changing call sites.
 *
 * Cross-target options/summary fields live here. Target-specific options (e.g.
 * Astro's prettify pass, React's TSX style options) belong on the adapter
 * itself, not on `TargetBuildOptions`.
 */

export interface TargetBuildOptions {
  /** Path to the static HTML clone (input). */
  cloneDir: string;
  /** Where to write the framework project. */
  outDir: string;
  /** Optional project name used in package.json or equivalent scaffold files. */
  name?: string;
  /** Overwrite the output directory if it already exists. */
  force?: boolean;
  /** Primitives config, target-agnostic. */
  primitives?: unknown;
}

export interface TargetBuildSummary {
  outDir: string;
  componentsEmitted: number;
  pagesEmitted: number;
  assetCount: number;
  assetBytes: number;
}

/**
 * One input page for a multi-page build. Each entry refers to an already-
 * captured clone directory; the adapter slices each clone independently and
 * dedupes shared components by fingerprint.
 */
export interface MultiPageInput {
  /** Path to a clone dir (must contain index.html + manifest.json). */
  cloneDir: string;
  /** URL pathname, e.g. "/", "/about-us/", "/social/". */
  pathname: string;
  /** Optional original full URL (for logging). */
  url?: string;
}

export interface TargetMultiBuildOptions {
  pages: MultiPageInput[];
  outDir: string;
  name?: string;
  force?: boolean;
  primitives?: unknown;
}

export interface TargetMultiBuildSummary {
  outDir: string;
  pagesEmitted: string[];
  sharedComponents: string[];
  perPageComponents: number;
  assetCount: number;
  assetBytes: number;
}

export interface TargetAdapter {
  name: 'astro' | 'react';
  build(options: TargetBuildOptions): Promise<TargetBuildSummary>;
  /**
   * Optional multi-page build. Adapters that support multi-page emission
   * (e.g. multi-entry Vite for React, multi-page Astro pages) implement
   * this; single-page-only adapters can omit it.
   */
  buildMulti?(options: TargetMultiBuildOptions): Promise<TargetMultiBuildSummary>;
}
