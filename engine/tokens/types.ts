/**
 * Types for the token extraction pipeline.
 *
 * Consumes the JSON artifacts emitted by scripts/extract-css.ts and produces
 * a deterministic, numerically named design-token system.
 */

import type {
  BreakpointEntry,
  ColorUsageEntry,
  CssRule,
  SpacingClusterEntry,
  TypographyClusterEntry,
} from '../analyze/css/types';

export type TokenCategory =
  | 'colors'
  | 'spacing'
  | 'fontSizes'
  | 'fontWeights'
  | 'lineHeights'
  | 'letterSpacings'
  | 'fontFamilies'
  | 'breakpoints'
  | 'radius'
  | 'shadows';

export interface TokenEntry {
  /** The CSS custom property name without the leading `--`. */
  name: string;
  /** The literal value emitted to CSS (e.g. `#ff5546`, `4px`). */
  value: string;
  /** Usage count, when known. */
  count: number;
  /** Representative selector example (truncated to <= 80 chars). */
  exampleSelector: string;
}

export interface CategorisedTokens {
  colors: TokenEntry[];
  spacing: TokenEntry[];
  fontSizes: TokenEntry[];
  fontWeights: TokenEntry[];
  lineHeights: TokenEntry[];
  letterSpacings: TokenEntry[];
  fontFamilies: TokenEntry[];
  breakpoints: TokenEntry[];
  radius: TokenEntry[];
  shadows: TokenEntry[];
}

export interface AnalysisBundle {
  colors: ColorUsageEntry[];
  typography: TypographyClusterEntry[];
  spacing: SpacingClusterEntry[];
  breakpoints: BreakpointEntry[];
  rules: CssRule[];
}

export interface TokenMap {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  fontSizes: Record<string, string>;
  fontWeights: Record<string, string>;
  lineHeights: Record<string, string>;
  letterSpacings: Record<string, string>;
  fontFamilies: Record<string, string>;
  breakpoints: Record<string, string>;
  radius: Record<string, string>;
  shadows: Record<string, string>;
}

export const CATEGORY_LABELS: Record<TokenCategory, string> = {
  colors: 'Colors',
  spacing: 'Spacing',
  fontSizes: 'Font Sizes',
  fontWeights: 'Font Weights',
  lineHeights: 'Line Heights',
  letterSpacings: 'Letter Spacing',
  fontFamilies: 'Font Families',
  breakpoints: 'Breakpoints',
  radius: 'Radius',
  shadows: 'Shadows',
};

export const CATEGORY_ORDER: TokenCategory[] = [
  'colors',
  'spacing',
  'fontSizes',
  'fontWeights',
  'lineHeights',
  'letterSpacings',
  'fontFamilies',
  'radius',
  'shadows',
  'breakpoints',
];
