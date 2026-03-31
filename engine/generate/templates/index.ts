/**
 * Component template system — matches extraction sections to well-known UI
 * patterns and provides structural skeletons the builder can fill in.
 *
 * Templates are intentionally short (20-40 line skeletons). They provide the
 * component structure, hook patterns, and accessibility baseline. The builder
 * overlays exact styles, content, and animation data from extraction.
 */

import type { AnimationSpec, AssetManifest, ElementSpec } from '../../types/extraction';
import type { DesignTokens } from '../../types/component';
import {
  stickyHeaderTemplate,
  heroWithVideoTemplate,
  featureGridTemplate,
  logoGridTemplate,
  testimonialTemplate,
  ctaBannerTemplate,
  contactFormTemplate,
  footerTemplate,
} from './patterns';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ComponentTemplate {
  name: string;
  description: string;
  /**
   * Return a confidence score (0-1) that this template matches the given
   * section. Only scores above 0.5 are considered viable matches.
   */
  matchPattern: (sectionName: string, elementCount: number, hasAnimations: boolean) => number;
  /** Generate the skeleton component source for the given context. */
  generateCode: (context: TemplateContext) => string;
}

export interface TemplateContext {
  sectionName: string;
  componentName: string;
  elements: ElementSpec[];
  animations: AnimationSpec[];
  tokens: DesignTokens;
  assets: AssetManifest;
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const COMPONENT_TEMPLATES: readonly ComponentTemplate[] = [
  stickyHeaderTemplate,
  heroWithVideoTemplate,
  featureGridTemplate,
  logoGridTemplate,
  testimonialTemplate,
  ctaBannerTemplate,
  contactFormTemplate,
  footerTemplate,
];

// ---------------------------------------------------------------------------
// Template matcher
// ---------------------------------------------------------------------------

/**
 * Find the best-matching template for a section. Returns `null` when no
 * template scores above the 0.5 confidence threshold.
 */
export function matchTemplate(
  sectionName: string,
  elementCount: number,
  hasAnimations: boolean,
): ComponentTemplate | null {
  let bestMatch: ComponentTemplate | null = null;
  let bestScore = 0;

  for (const template of COMPONENT_TEMPLATES) {
    const score = template.matchPattern(sectionName, elementCount, hasAnimations);
    if (score > bestScore && score > 0.5) {
      bestMatch = template;
      bestScore = score;
    }
  }

  return bestMatch;
}
