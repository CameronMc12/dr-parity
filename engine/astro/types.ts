/**
 * Types for the deterministic clone -> Astro slicer.
 */

export type ComponentRole =
  | 'preamble'
  | 'header'
  | 'interstitial'
  | 'main'
  | 'section'
  | 'post-main'
  | 'footer'
  | 'postamble';

export interface ComponentDef {
  /** Final file name (without extension), e.g. "Header" or "Section01_hero". */
  name: string;
  role: ComponentRole;
  /** Raw outerHTML for the node (already path-normalised by the emitter). */
  html: string;
  /** Optional sub-components (used for Main wrapping its sections). */
  children?: ComponentDef[];
}

export interface ExtractedHead {
  /** Inner HTML of <head> after path normalisation and base-stripping. */
  innerHTML: string;
  /** Attribute string for <html> (e.g. ` lang="en"`). May be empty. */
  htmlAttrs: string;
  /** Attribute string for <body>. May be empty. */
  bodyAttrs: string;
  /** Document title (best-effort), used by pages/index.astro. */
  title: string;
  /** Document description (best-effort). */
  description: string;
}

export interface SliceResult {
  head: ExtractedHead;
  components: ComponentDef[];
}

export interface BuildOptions {
  cloneDir: string;
  outDir: string;
  name: string;
  force: boolean;
}

export interface BuildSummary {
  components: Array<{ name: string; bytes: number }>;
  assetCount: number;
  assetBytes: number;
}
