/**
 * Shared types for the CSS analysis pipeline.
 *
 * Modules under engine/analyze/css/ produce these structures from a captured
 * clone directory. Downstream extract-tokens script consumes the JSON outputs.
 */

export type Specificity = [number, number, number];

export interface CssDeclaration {
  prop: string;
  value: string;
}

export interface CssSourceLocation {
  /** File path (relative to clone dir) OR `inline:N` for the Nth `<style>` block in index.html. */
  file: string;
  /** 1-based line number within the original source. */
  line: number;
}

export interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
  mediaQuery: string | null;
  source: CssSourceLocation;
  specificity: Specificity;
}

export interface CssSource {
  /** `inline:N` for inline blocks or a relative file path for external files. */
  id: string;
  /** Absolute or clone-relative origin path (for inline blocks: the html file path). */
  file: string;
  /** Raw CSS text. */
  css: string;
  /** Line offset within the origin file (for inline blocks, the `<style>` open tag line). */
  startLine: number;
}

export interface ColorUsageEntry {
  /** Normalised colour string (lowercase hex, or preserved oklch/named form). */
  value: string;
  /** Total occurrences across all declarations. */
  count: number;
  /** Distinct CSS properties this colour appears in. */
  contexts: string[];
  /** Representative selector for the first occurrence. */
  exampleSelector: string;
}

export interface TypographyClusterEntry {
  property: 'font-family' | 'font-size' | 'font-weight' | 'line-height' | 'letter-spacing';
  /** Representative value (for numeric clusters, the rounded centre value with unit). */
  value: string;
  count: number;
  /** Up to 5 selector examples that drive this cluster. */
  selectors: string[];
}

export interface SpacingClusterEntry {
  /** Representative value (e.g. `16px`). */
  value: string;
  count: number;
  /** Distinct CSS properties this value appears in. */
  contexts: string[];
  /** Up to 5 selector examples. */
  selectors: string[];
}

export interface BreakpointEntry {
  /** `min-width` or `max-width`. */
  feature: 'min-width' | 'max-width';
  /** Numeric value with unit (e.g. `768px`). */
  value: string;
  count: number;
}

export interface ClassCatalogEntry {
  className: string;
  count: number;
  /** Up to 3 CSS selectors that target this class. */
  selectors: string[];
  /** Up to 3 DOM contexts: `parentTag.parentClass`. */
  domContexts: string[];
}

export interface CssSummary {
  totalSources: number;
  totalRules: number;
  totalSelectors: number;
  totalDeclarations: number;
  totalColors: number;
  totalTypographyClusters: number;
  totalSpacingClusters: number;
  totalBreakpoints: number;
  totalClasses: number;
}
