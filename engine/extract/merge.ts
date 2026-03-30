/**
 * Extraction Merge Module — combines all extraction outputs into a unified PageData.
 *
 * This is a pure data transformation function: no async, no browser interaction.
 * It takes the raw outputs of each extraction step and assembles them into the
 * canonical PageData shape consumed by the generation pipeline.
 */

import type {
  PageData,
  GlobalBehavior,
  SectionSpec,
  AnimationSpec,
  InteractionModel,
  TechStackAnalysis,
  LibraryInfo,
  Rect,
} from '../types/extraction';
import type { PageScanResult } from './playwright/page-scanner';
import type { AnimationDetectionResult } from './playwright/animation-detector';
import type { FontExtractionResult } from './playwright/font-extractor';
import type { AssetCollectionResult } from './playwright/asset-collector';
import type { InteractionMapResult } from './playwright/interaction-mapper';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MergeInput {
  url: string;
  scan: PageScanResult;
  animations: AnimationDetectionResult;
  fonts: FontExtractionResult;
  assets: AssetCollectionResult;
  interactions: InteractionMapResult;
  viewport: { width: number; height: number };
}

export function mergeExtractionData(input: MergeInput): PageData {
  const { url, scan, animations, fonts, assets, interactions, viewport } =
    input;

  // 1. Start with sections from the scanner
  const sections = scan.sections.map((section) =>
    enrichSection(section, animations, interactions),
  );

  // 2. Build global behaviors from detected libraries and scroll behavior
  const globalBehaviors = buildGlobalBehaviors(animations);

  // 3. Build tech stack analysis
  const techStack = buildTechStack(animations);

  // 4. Extract color and spacing tokens from the scan
  //    (These come pre-built from the scanner or will be empty for now)
  const colors = extractColorTokens(scan);
  const spacing = extractSpacingTokens(scan);

  return {
    url,
    title: scan.title,
    description: scan.description,
    viewport: {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
    },
    fonts: fonts.fonts,
    colors,
    spacing,
    sections,
    globalBehaviors,
    assets: assets.manifest,
    techStack,
    extractedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Section enrichment
// ---------------------------------------------------------------------------

function enrichSection(
  section: SectionSpec,
  animations: AnimationDetectionResult,
  interactions: InteractionMapResult,
): SectionSpec {
  // Attach animations that target elements within this section's bounding rect
  const sectionAnimations = findAnimationsInRect(
    animations.animations,
    section.boundingRect,
    section.elements,
  );

  // Attach interaction states to elements within the section
  const enrichedElements = section.elements.map((element) => {
    const selector = buildElementSelector(element);
    const states = interactions.elementStates.get(selector);
    if (states && states.length > 0) {
      return { ...element, states: [...element.states, ...states] };
    }
    return element;
  });

  // Get responsive breakpoints for this section
  const sectionBreakpoints = interactions.responsiveBreakpoints
    .map((bp) => ({
      ...bp,
      changes: bp.changes.filter((change) =>
        isChangeWithinSection(change.elementSelector, section, enrichedElements),
      ),
    }))
    .filter((bp) => bp.changes.length > 0);

  // Get interaction model classification
  const interactionModel =
    interactions.sectionInteractionModels.get(section.id) ??
    classifyFromContent(sectionAnimations, enrichedElements);

  return {
    ...section,
    elements: enrichedElements,
    animations: [...section.animations, ...sectionAnimations],
    responsiveBreakpoints: sectionBreakpoints,
    interactionModel,
  };
}

// ---------------------------------------------------------------------------
// Animation matching
// ---------------------------------------------------------------------------

/**
 * Find animations whose target element selector matches an element within
 * the given section's bounding rectangle or element tree.
 */
function findAnimationsInRect(
  allAnimations: AnimationSpec[],
  sectionRect: Rect,
  elements: SectionSpec['elements'],
): AnimationSpec[] {
  const sectionSelectors = collectSelectors(elements);

  return allAnimations.filter((anim) => {
    // Direct selector match against any element in this section
    if (sectionSelectors.has(anim.elementSelector)) {
      return true;
    }

    // If the animation selector starts with a section-level ID, match it
    for (const sel of sectionSelectors) {
      if (anim.elementSelector.startsWith(sel)) {
        return true;
      }
    }

    return false;
  });
}

function collectSelectors(
  elements: SectionSpec['elements'],
): Set<string> {
  const selectors = new Set<string>();

  for (const el of elements) {
    const selector = buildElementSelector(el);
    selectors.add(selector);
    if (el.children.length > 0) {
      const childSelectors = collectSelectors(el.children);
      for (const s of childSelectors) {
        selectors.add(s);
      }
    }
  }

  return selectors;
}

function buildElementSelector(
  element: SectionSpec['elements'][number],
): string {
  if (element.id) return `#${element.id}`;
  const classes = element.classes.filter(Boolean).join('.');
  if (classes) return `${element.tag}.${classes}`;
  return element.tag;
}

// ---------------------------------------------------------------------------
// Breakpoint matching
// ---------------------------------------------------------------------------

function isChangeWithinSection(
  changeSelector: string,
  section: SectionSpec,
  elements: SectionSpec['elements'],
): boolean {
  // Check if the changed element's selector matches anything in this section
  const sectionSelectors = collectSelectors(elements);

  // Direct match
  if (sectionSelectors.has(changeSelector)) return true;

  // Partial match: the change selector contains a section element selector
  for (const sel of sectionSelectors) {
    if (changeSelector.includes(sel)) return true;
  }

  // If the section has an ID, check if the change selector references it
  if (section.id && changeSelector.includes(section.id)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Interaction model fallback classification
// ---------------------------------------------------------------------------

function classifyFromContent(
  sectionAnimations: AnimationSpec[],
  elements: SectionSpec['elements'],
): InteractionModel {
  const hasScrollAnimation = sectionAnimations.some(
    (a) =>
      a.trigger.type === 'scroll-position' ||
      a.trigger.type === 'scroll-progress' ||
      a.trigger.type === 'intersection',
  );

  const hasClickAnimation = sectionAnimations.some(
    (a) => a.trigger.type === 'click',
  );

  const hasHoverAnimation = sectionAnimations.some(
    (a) => a.trigger.type === 'hover',
  );

  const hasTimeAnimation = sectionAnimations.some(
    (a) => a.trigger.type === 'time' || a.trigger.type === 'load',
  );

  const hasInteractiveElements = elements.some(
    (el) => el.states.length > 0,
  );

  const signals = [
    hasScrollAnimation,
    hasClickAnimation || hasInteractiveElements,
    hasHoverAnimation,
    hasTimeAnimation,
  ].filter(Boolean).length;

  if (signals >= 2) return 'hybrid';
  if (hasClickAnimation || hasInteractiveElements) return 'click-driven';
  if (hasScrollAnimation) return 'scroll-driven';
  if (hasHoverAnimation) return 'hover-driven';
  if (hasTimeAnimation) return 'time-driven';
  return 'static';
}

// ---------------------------------------------------------------------------
// Global behaviors
// ---------------------------------------------------------------------------

function buildGlobalBehaviors(
  animations: AnimationDetectionResult,
): GlobalBehavior[] {
  const behaviors: GlobalBehavior[] = [];

  // Scroll behavior
  if (animations.globalScrollBehavior !== 'native') {
    const scrollLibraryMap: Record<string, string> = {
      lenis: 'Lenis',
      locomotive: 'Locomotive Scroll',
      custom: 'Custom scroll handler',
    };

    const scrollLib = animations.libraries.find(
      (lib) =>
        lib.name.toLowerCase().includes('lenis') ||
        lib.name.toLowerCase().includes('locomotive'),
    );

    behaviors.push({
      type: 'smooth-scroll',
      library: scrollLib,
      description:
        scrollLibraryMap[animations.globalScrollBehavior] ??
        'Custom smooth scrolling detected',
    });
  }

  // Check for other global behaviors from detected libraries
  for (const lib of animations.libraries) {
    const name = lib.name.toLowerCase();

    if (name.includes('gsap') || name.includes('greensock')) {
      behaviors.push({
        type: 'other',
        library: lib,
        description: `GSAP animation library detected (${lib.version ?? 'unknown version'})`,
      });
    }

    if (name.includes('framer-motion') || name.includes('motion')) {
      behaviors.push({
        type: 'other',
        library: lib,
        description: `Framer Motion animation library detected (${lib.version ?? 'unknown version'})`,
      });
    }

    if (name.includes('lottie')) {
      behaviors.push({
        type: 'other',
        library: lib,
        description: `Lottie animation library detected (${lib.version ?? 'unknown version'})`,
      });
    }
  }

  return behaviors;
}

// ---------------------------------------------------------------------------
// Tech stack
// ---------------------------------------------------------------------------

function buildTechStack(
  animations: AnimationDetectionResult,
): TechStackAnalysis {
  const scrollLib = animations.libraries.find(
    (lib) =>
      lib.name.toLowerCase().includes('lenis') ||
      lib.name.toLowerCase().includes('locomotive'),
  );

  return {
    animationLibraries: animations.libraries,
    scrollLibrary: scrollLib,
    isSSR: false, // Determined by other extraction steps if needed
    hasServiceWorker: false, // Determined by other extraction steps if needed
  };
}

// ---------------------------------------------------------------------------
// Token extraction stubs
// ---------------------------------------------------------------------------

/**
 * Extract color tokens from scan data.
 * The scan captures computed styles on every element; a dedicated token
 * extraction pass would parse those into ColorTokens. For now we return
 * an empty array — the token extractor is a separate pipeline step.
 */
function extractColorTokens(
  _scan: PageScanResult,
): PageData['colors'] {
  return [];
}

/**
 * Extract spacing tokens from scan data.
 * Same rationale as extractColorTokens — this is a placeholder for the
 * dedicated token extraction step.
 */
function extractSpacingTokens(
  _scan: PageScanResult,
): PageData['spacing'] {
  return [];
}
