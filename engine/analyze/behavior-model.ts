/**
 * Behavior model analyzer — classifies animations, determines library
 * requirements, and builds a per-section behavior map.
 */

import type {
  PageData,
  AnimationSpec,
  AnimationTriggerType,
  SectionSpec,
  ElementSpec,
} from '../types/extraction';
import type {
  BehaviorModel,
  SectionBehavior,
  LibraryRequirement,
  GlobalScrollBehavior,
  ScrollTrigger,
  ClickHandler,
  ClickAction,
  HoverEffect,
} from '../types/component';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyzeBehaviors(data: PageData): BehaviorModel {
  const sectionBehaviors = new Map<string, SectionBehavior>();

  for (const section of data.sections) {
    sectionBehaviors.set(section.id, buildSectionBehavior(section));
  }

  const requiredLibraries = detectRequiredLibraries(data);
  const globalScrollBehavior = classifyGlobalScroll(data);

  return { sectionBehaviors, requiredLibraries, globalScrollBehavior };
}

// ---------------------------------------------------------------------------
// Section behavior builder
// ---------------------------------------------------------------------------

function buildSectionBehavior(section: SectionSpec): SectionBehavior {
  const allAnimations = collectAllAnimations(section);
  const interactionModel = classifyInteractionModel(allAnimations, section);
  const scrollTriggers = extractScrollTriggers(allAnimations, section);
  const clickHandlers = extractClickHandlers(section.elements);
  const hoverEffects = extractHoverEffects(section.elements);

  return {
    sectionId: section.id,
    interactionModel,
    animations: allAnimations,
    scrollTriggers,
    clickHandlers,
    hoverEffects,
  };
}

// ---------------------------------------------------------------------------
// Animation collection
// ---------------------------------------------------------------------------

function collectAllAnimations(section: SectionSpec): AnimationSpec[] {
  const animations = [...section.animations];
  collectElementAnimations(section.elements, animations);
  return animations;
}

function collectElementAnimations(
  elements: ElementSpec[],
  out: AnimationSpec[],
): void {
  for (const el of elements) {
    for (const anim of el.animations) {
      out.push(anim);
    }
    collectElementAnimations(el.children, out);
  }
}

// ---------------------------------------------------------------------------
// Interaction model classification
// ---------------------------------------------------------------------------

const SCROLL_TRIGGERS: ReadonlySet<AnimationTriggerType> = new Set([
  'scroll-position',
  'scroll-progress',
  'intersection',
]);

const CLICK_TRIGGERS: ReadonlySet<AnimationTriggerType> = new Set([
  'click',
]);

const HOVER_TRIGGERS: ReadonlySet<AnimationTriggerType> = new Set([
  'hover',
]);

const TIME_TRIGGERS: ReadonlySet<AnimationTriggerType> = new Set([
  'load',
  'time',
]);

function classifyInteractionModel(
  animations: AnimationSpec[],
  section: SectionSpec,
): string {
  if (animations.length === 0) return section.interactionModel;

  const triggerTypes = new Set(animations.map((a) => a.trigger.type));

  const hasScroll = [...triggerTypes].some((t) => SCROLL_TRIGGERS.has(t));
  const hasClick = [...triggerTypes].some((t) => CLICK_TRIGGERS.has(t));
  const hasHover = [...triggerTypes].some((t) => HOVER_TRIGGERS.has(t));
  const hasTime = [...triggerTypes].some((t) => TIME_TRIGGERS.has(t));

  const activeCount = [hasScroll, hasClick, hasHover, hasTime].filter(Boolean).length;

  if (activeCount > 1) return 'hybrid';
  if (hasScroll) return 'scroll-driven';
  if (hasClick) return 'click-driven';
  if (hasHover) return 'hover-driven';
  if (hasTime) return 'time-driven';

  return section.interactionModel;
}

// ---------------------------------------------------------------------------
// Scroll trigger extraction
// ---------------------------------------------------------------------------

function extractScrollTriggers(
  animations: AnimationSpec[],
  section: SectionSpec,
): ScrollTrigger[] {
  return animations
    .filter((a) => SCROLL_TRIGGERS.has(a.trigger.type))
    .map((a) => ({
      elementSelector: a.elementSelector,
      triggerPosition: a.trigger.scrollStart ?? section.boundingRect.top,
      action: 'animate' as const,
      details: {
        animationId: a.id,
        type: a.type,
        duration: a.duration,
        easing: a.easing,
      },
    }));
}

// ---------------------------------------------------------------------------
// Click handler extraction
// ---------------------------------------------------------------------------

function extractClickHandlers(elements: ElementSpec[]): ClickHandler[] {
  const handlers: ClickHandler[] = [];
  collectClickHandlers(elements, handlers);
  return handlers;
}

function collectClickHandlers(
  elements: ElementSpec[],
  out: ClickHandler[],
): void {
  for (const el of elements) {
    const clickState = el.states.find((s) => s.trigger === 'active');
    if (clickState) {
      out.push({
        elementSelector: buildSelector(el),
        action: inferClickAction(el),
        details: { styleChanges: clickState.styleChanges },
      });
    }

    // Buttons and links with click behavior
    if (el.tag === 'button' && el.animations.some((a) => a.trigger.type === 'click')) {
      out.push({
        elementSelector: buildSelector(el),
        action: inferClickAction(el),
        details: {},
      });
    }

    collectClickHandlers(el.children, out);
  }
}

function inferClickAction(el: ElementSpec): ClickAction {
  const text = (el.textContent ?? '').toLowerCase();
  const classes = el.classes.join(' ').toLowerCase();
  const role = el.attributes['role'] ?? '';

  if (role === 'tab' || classes.includes('tab')) return 'tab-switch';
  if (classes.includes('modal') || classes.includes('dialog')) return 'modal-open';
  if (classes.includes('accordion') || classes.includes('collapse')) return 'accordion-toggle';
  if (el.tag === 'a' || text.includes('learn more') || text.includes('read more')) return 'navigation';
  return 'custom';
}

// ---------------------------------------------------------------------------
// Hover effect extraction
// ---------------------------------------------------------------------------

function extractHoverEffects(elements: ElementSpec[]): HoverEffect[] {
  const effects: HoverEffect[] = [];
  collectHoverEffects(elements, effects);
  return effects;
}

function collectHoverEffects(
  elements: ElementSpec[],
  out: HoverEffect[],
): void {
  for (const el of elements) {
    const hoverState = el.states.find((s) => s.trigger === 'hover');
    if (hoverState) {
      out.push({
        elementSelector: buildSelector(el),
        styleChanges: hoverState.styleChanges,
        transition: hoverState.transition ?? 'all 200ms ease',
      });
    }
    collectHoverEffects(el.children, out);
  }
}

// ---------------------------------------------------------------------------
// Library requirement detection
// ---------------------------------------------------------------------------

const LIBRARY_MAP: ReadonlyArray<{
  types: readonly string[];
  name: string;
  npmPackage: string;
  reason: string;
}> = [
  {
    types: ['gsap'],
    name: 'GSAP',
    npmPackage: 'gsap',
    reason: 'GSAP animations detected in the target site',
  },
  {
    types: ['lenis'],
    name: 'Lenis',
    npmPackage: 'lenis',
    reason: 'Lenis smooth scroll detected in the target site',
  },
  {
    types: ['locomotive-scroll'],
    name: 'Locomotive Scroll',
    npmPackage: 'locomotive-scroll',
    reason: 'Locomotive Scroll detected in the target site',
  },
  {
    types: ['framer-motion'],
    name: 'Framer Motion',
    npmPackage: 'framer-motion',
    reason: 'Framer Motion animations detected in the target site',
  },
  {
    types: ['lottie'],
    name: 'Lottie React',
    npmPackage: 'lottie-react',
    reason: 'Lottie animations detected in the target site',
  },
  {
    types: ['webgl'],
    name: 'Three.js',
    npmPackage: 'three',
    reason: 'WebGL content detected in the target site',
  },
];

function detectRequiredLibraries(data: PageData): LibraryRequirement[] {
  const allAnimationTypes = new Set<string>();

  for (const section of data.sections) {
    for (const anim of section.animations) {
      allAnimationTypes.add(anim.type);
    }
    collectAnimationTypes(section.elements, allAnimationTypes);
  }

  // Also check techStack for detected libraries
  for (const lib of data.techStack.animationLibraries) {
    if (lib.detected && lib.name) {
      allAnimationTypes.add(lib.name.toLowerCase());
    }
  }

  if (data.techStack.scrollLibrary?.detected) {
    const scrollName = data.techStack.scrollLibrary.name.toLowerCase();
    allAnimationTypes.add(scrollName);
  }

  const requirements: LibraryRequirement[] = [];

  for (const entry of LIBRARY_MAP) {
    if (entry.types.some((t) => allAnimationTypes.has(t))) {
      requirements.push({
        name: entry.name,
        npmPackage: entry.npmPackage,
        reason: entry.reason,
      });
    }
  }

  return requirements;
}

function collectAnimationTypes(
  elements: ElementSpec[],
  out: Set<string>,
): void {
  for (const el of elements) {
    for (const anim of el.animations) {
      out.add(anim.type);
    }
    collectAnimationTypes(el.children, out);
  }
}

// ---------------------------------------------------------------------------
// Global scroll behavior
// ---------------------------------------------------------------------------

function classifyGlobalScroll(data: PageData): GlobalScrollBehavior {
  const scrollLib = data.techStack.scrollLibrary;
  if (scrollLib?.detected) {
    const name = scrollLib.name.toLowerCase();
    if (name.includes('lenis')) return 'lenis';
    if (name.includes('locomotive')) return 'locomotive';
    return 'custom';
  }

  const hasSmoothScroll = data.globalBehaviors.some((b) => b.type === 'smooth-scroll');
  if (hasSmoothScroll) {
    const smoothBehavior = data.globalBehaviors.find((b) => b.type === 'smooth-scroll');
    const libName = smoothBehavior?.library?.name?.toLowerCase();
    if (libName?.includes('lenis')) return 'lenis';
    if (libName?.includes('locomotive')) return 'locomotive';
    return 'custom';
  }

  return 'native';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function buildSelector(el: ElementSpec): string {
  if (el.id) return `#${el.id}`;
  if (el.classes.length > 0) return `.${el.classes[0]}`;
  return el.tag;
}
