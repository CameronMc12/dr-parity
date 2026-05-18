/**
 * Target-agnostic types shared across framework targets.
 *
 * These describe the intermediate representation produced by parsing a clone:
 * a head description plus a list of component definitions. They contain no
 * framework-specific syntax (no `.astro` frontmatter, no JSX) so a React (or
 * any other) target can consume the same output.
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
  /** Raw outerHTML for the node (already path-normalised). */
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
  /** Document title (best-effort). */
  title: string;
  /** Document description (best-effort). */
  description: string;
}

export interface SliceResult {
  head: ExtractedHead;
  components: ComponentDef[];
}
