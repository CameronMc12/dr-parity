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
  /**
   * Raw outerHTML for the node (already path-normalised). When this component
   * is a pure composition wrapper (see `wrapper` + `childComponentNames`),
   * `html` is the empty string and the target emitter assembles the wrapper
   * body from `wrapper` and the composed child tags.
   */
  html: string;
  /** Optional sub-components (used for Main wrapping its sections). */
  children?: ComponentDef[];
  /**
   * Opening + closing tag for a composition wrapper (e.g. `<main id="page">`
   * + `</main>`). Set on the `Main` component returned by `sliceBody`. When
   * present together with `childComponentNames`, the target emitter renders
   * the wrapper around composed child references in that target's native
   * syntax. Null/undefined for leaf components whose `html` is the full
   * node and need no composition.
   */
  wrapper?: { openTag: string; closeTag: string };
  /**
   * Names of child components composed inside this component. Each entry is
   * a sibling component name (e.g. `Section01_Hero`) that the target emitter
   * should reference inside `wrapper.openTag` / `wrapper.closeTag`. Empty
   * means "wrapper renders as an empty pair of tags."
   */
  childComponentNames?: string[];
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
