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
  SectionConfidence,
  AnimationSpec,
  InteractionModel,
  TechStackAnalysis,
  LibraryInfo,
  Rect,
  ColorToken,
  SpacingToken,
  ElementSpec,
  StylesheetExtractionResult,
  RegisteredProperty,
  ViewTransitionRecord,
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
  stylesheets?: StylesheetExtractionResult;
  registeredProperties?: RegisteredProperty[];
  viewTransitions?: ViewTransitionRecord[];
  viewport: { width: number; height: number };
}

export function mergeExtractionData(input: MergeInput): PageData {
  const {
    url,
    scan,
    animations,
    fonts,
    assets,
    interactions,
    stylesheets,
    registeredProperties,
    viewTransitions,
    viewport,
  } = input;

  // 1. Start with sections from the scanner
  const sections = scan.sections.map((section) =>
    enrichSection(section, animations, interactions),
  );

  // 2. Build global behaviors from detected libraries and scroll behavior
  const globalBehaviors = buildGlobalBehaviors(animations);

  // 3. Build tech stack analysis
  const techStack = buildTechStack(animations);

  // 4. Extract color and spacing tokens from actual scan data
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
    stylesheets,
    registeredProperties,
    viewTransitions,
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

  // Item 4.9: calculate extraction confidence for this section
  const confidence = calculateSectionConfidence(
    enrichedElements,
    sectionAnimations,
    interactions,
    section,
  );

  return {
    ...section,
    elements: enrichedElements,
    animations: [...section.animations, ...sectionAnimations],
    responsiveBreakpoints: sectionBreakpoints,
    interactionModel,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Confidence scoring (Item 4.9)
// ---------------------------------------------------------------------------

/**
 * Score how confidently each extraction dimension captured this section's data.
 * Each dimension is scored 0-1; the overall score is a weighted average.
 */
function calculateSectionConfidence(
  elements: ElementSpec[],
  sectionAnimations: AnimationSpec[],
  interactions: InteractionMapResult,
  section: SectionSpec,
): SectionConfidence {
  // Style extraction: ratio of elements with at least one computed style
  const { withStyles, total } = countElementStyles(elements);
  const styleExtraction = total > 0 ? withStyles / total : 0;

  // Animation detection: if no animations exist, confidence is full (nothing to miss).
  // Otherwise, score by how many have substantive implementation notes.
  const animationDetection =
    sectionAnimations.length === 0
      ? 1
      : sectionAnimations.filter(
          (a) => a.implementationNotes && a.implementationNotes.length > 20,
        ).length / sectionAnimations.length;

  // Interaction mapping: did the mapper classify this section?
  const hasSectionModel = interactions.sectionInteractionModels.has(section.id);
  const interactiveElementCount = countInteractiveElements(elements);
  const interactionMapping =
    interactiveElementCount === 0
      ? 1
      : hasSectionModel
        ? 0.9
        : 0.5;

  // Asset coverage: ratio of elements with media that have a localPath
  const { withLocal, totalMedia } = countMediaCoverage(elements);
  const assetCoverage = totalMedia > 0 ? withLocal / totalMedia : 1;

  // Weighted average (style 40%, animation 30%, interaction 15%, assets 15%)
  const overall =
    styleExtraction * 0.4 +
    animationDetection * 0.3 +
    interactionMapping * 0.15 +
    assetCoverage * 0.15;

  return {
    styleExtraction: round2(styleExtraction),
    animationDetection: round2(animationDetection),
    interactionMapping: round2(interactionMapping),
    assetCoverage: round2(assetCoverage),
    overall: round2(overall),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function countElementStyles(elements: ElementSpec[]): { withStyles: number; total: number } {
  let withStyles = 0;
  let total = 0;

  for (const el of elements) {
    total++;
    if (Object.keys(el.computedStyles).length > 0) {
      withStyles++;
    }
    const childCounts = countElementStyles(el.children);
    withStyles += childCounts.withStyles;
    total += childCounts.total;
  }

  return { withStyles, total };
}

function countInteractiveElements(elements: ElementSpec[]): number {
  let count = 0;
  for (const el of elements) {
    if (el.states.length > 0) count++;
    count += countInteractiveElements(el.children);
  }
  return count;
}

function countMediaCoverage(elements: ElementSpec[]): { withLocal: number; totalMedia: number } {
  let withLocal = 0;
  let totalMedia = 0;

  for (const el of elements) {
    if (el.media) {
      totalMedia++;
      if (el.media.localPath) {
        withLocal++;
      }
    }
    const childCounts = countMediaCoverage(el.children);
    withLocal += childCounts.withLocal;
    totalMedia += childCounts.totalMedia;
  }

  return { withLocal, totalMedia };
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
// Token extraction from scan data
// ---------------------------------------------------------------------------

/** CSS color properties to collect from computed styles. */
const COLOR_PROPERTIES = ['color', 'background-color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color'] as const;

/** CSS spacing properties to collect from computed styles. */
const SPACING_PROPERTIES = [
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'gap', 'row-gap', 'column-gap',
] as const;

/**
 * Walk all elements in all sections and collect every unique color value,
 * categorised by usage (background, text, border).
 */
function extractColorTokens(scan: PageScanResult): ColorToken[] {
  const colorMap = new Map<string, { usage: Set<string>; frequency: number }>();

  const collectFromElement = (el: ElementSpec): void => {
    for (const prop of COLOR_PROPERTIES) {
      const value = el.computedStyles[prop];
      if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === 'inherit' || value === 'currentcolor') {
        continue;
      }

      const usage = prop.includes('background')
        ? 'background'
        : prop.includes('border') || prop.includes('outline')
          ? 'border'
          : 'text';

      const existing = colorMap.get(value);
      if (existing) {
        existing.usage.add(usage);
        existing.frequency += 1;
      } else {
        colorMap.set(value, { usage: new Set([usage]), frequency: 1 });
      }
    }

    for (const child of el.children) {
      collectFromElement(child);
    }
  };

  for (const section of scan.sections) {
    for (const el of section.elements) {
      collectFromElement(el);
    }
  }

  // Sort by frequency descending, assign auto-generated names
  const sorted = Array.from(colorMap.entries()).sort(
    (a, b) => b[1].frequency - a[1].frequency,
  );

  return sorted.map(([value, data], idx) => ({
    name: `color-${idx}`,
    value,
    usage: Array.from(data.usage),
    frequency: data.frequency,
  }));
}

/**
 * Walk all elements in all sections and collect every unique spacing value
 * from padding, margin, and gap properties.
 */
function extractSpacingTokens(scan: PageScanResult): SpacingToken[] {
  const spacingMap = new Map<number, { usage: Set<string>; frequency: number }>();

  const collectFromElement = (el: ElementSpec): void => {
    for (const prop of SPACING_PROPERTIES) {
      const raw = el.computedStyles[prop];
      if (!raw || raw === '0px' || raw === 'auto' || raw === 'normal') continue;

      const px = parseFloat(raw);
      if (Number.isNaN(px) || px <= 0) continue;

      // Round to nearest integer to reduce near-duplicates
      const rounded = Math.round(px);

      const usage = prop.startsWith('padding')
        ? 'padding'
        : prop.startsWith('margin')
          ? 'margin'
          : 'gap';

      const existing = spacingMap.get(rounded);
      if (existing) {
        existing.usage.add(usage);
        existing.frequency += 1;
      } else {
        spacingMap.set(rounded, { usage: new Set([usage]), frequency: 1 });
      }
    }

    for (const child of el.children) {
      collectFromElement(child);
    }
  };

  for (const section of scan.sections) {
    for (const el of section.elements) {
      collectFromElement(el);
    }
  }

  // Sort by value ascending for a clean spacing scale
  const sorted = Array.from(spacingMap.entries()).sort(
    (a, b) => a[0] - b[0],
  );

  return sorted.map(([value, data]) => ({
    value,
    usage: Array.from(data.usage),
    frequency: data.frequency,
  }));
}
