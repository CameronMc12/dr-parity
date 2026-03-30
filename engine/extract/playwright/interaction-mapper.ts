/**
 * Interaction Mapper — captures multi-state content and responsive behavior.
 *
 * Three responsibilities:
 *   1. Click tabs, pills, toggles and record each state's content
 *   2. Scroll the page and diff fixed/sticky element styles at each position
 *   3. Resize viewport to test breakpoints and capture layout changes
 *
 * All browser interaction uses batched `page.evaluate()` calls to minimize
 * Node-to-browser round-trips.
 */

import type { Page } from 'playwright';
import type {
  StateSpec,
  BreakpointSpec,
  BreakpointChange,
  InteractionModel,
} from '../../types/extraction';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InteractionMapResult {
  /** selector -> captured states from clicking tabs/toggles */
  elementStates: Map<string, StateSpec[]>;
  /** Styles captured at different scroll positions for fixed/sticky elements */
  scrollStates: ScrollStateCapture[];
  /** Layout changes detected at each tested breakpoint */
  responsiveBreakpoints: BreakpointSpec[];
  /** sectionId -> classified interaction model */
  sectionInteractionModels: Map<string, InteractionModel>;
}

export interface ScrollStateCapture {
  elementSelector: string;
  scrollPosition: number;
  /** CSS property -> value at this scroll position */
  styleChanges: Record<string, string>;
}

export interface InteractionMapOptions {
  /** Viewport widths to test. Default [1440, 768, 390]. */
  testBreakpoints?: number[];
  /** Specific scroll positions to test, or auto-detect if omitted. */
  scrollPositions?: number[];
  /** Click interactive tab/toggle elements. Default true. */
  clickInteractive?: boolean;
  /** Maximum number of interactive elements to click. Default 20. */
  maxClicks?: number;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InteractiveGroup {
  /** Selector for the container holding the interactive elements */
  containerSelector: string;
  /** Selectors for each clickable trigger within the group */
  triggerSelectors: string[];
  /** Selector for the content area that changes */
  targetSelector: string;
  /** 'tab' | 'accordion' | 'toggle' */
  groupType: string;
}

interface CapturedContent {
  textContent: string;
  childCount: number;
  visibility: string;
  boundingHeight: number;
}

interface StickyFixedElement {
  selector: string;
  position: string;
  baseStyles: Record<string, string>;
}

interface BreakpointSnapshot {
  selector: string;
  styles: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<InteractionMapOptions> = {
  testBreakpoints: [1440, 768, 390],
  scrollPositions: [],
  clickInteractive: true,
  maxClicks: 20,
};

const SCROLL_POSITIONS = [0, 50, 100, 200, 500, 1000];

const TRACKED_STYLE_PROPERTIES = [
  'background-color',
  'background',
  'color',
  'opacity',
  'transform',
  'height',
  'max-height',
  'min-height',
  'padding',
  'padding-top',
  'padding-bottom',
  'font-size',
  'box-shadow',
  'border',
  'border-bottom',
  'top',
  'position',
  'width',
  'max-width',
  'backdrop-filter',
] as const;

const RESPONSIVE_TRACKED_PROPERTIES = [
  'display',
  'flex-direction',
  'grid-template-columns',
  'width',
  'max-width',
  'padding',
  'margin',
  'font-size',
  'gap',
  'position',
  'visibility',
  'order',
  'text-align',
  'height',
] as const;

const TRANSITION_SETTLE_MS = 500;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function mapInteractions(
  page: Page,
  options?: InteractionMapOptions,
): Promise<InteractionMapResult> {
  const opts: Required<InteractionMapOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const elementStates = new Map<string, StateSpec[]>();
  let scrollStates: ScrollStateCapture[] = [];
  let responsiveBreakpoints: BreakpointSpec[] = [];
  const sectionInteractionModels = new Map<string, InteractionModel>();

  // 1. Click-driven state capture
  if (opts.clickInteractive) {
    const states = await captureClickStates(page, opts.maxClicks);
    for (const [selector, specs] of states) {
      elementStates.set(selector, specs);
    }
  }

  // 2. Scroll state capture
  scrollStates = await captureScrollStates(page, opts.scrollPositions);

  // 3. Responsive breakpoint detection
  responsiveBreakpoints = await captureResponsiveBreakpoints(
    page,
    opts.testBreakpoints,
  );

  // 4. Classify section interaction models
  const models = await classifySectionModels(
    page,
    elementStates,
    scrollStates,
  );
  for (const [sectionId, model] of models) {
    sectionInteractionModels.set(sectionId, model);
  }

  return {
    elementStates,
    scrollStates,
    responsiveBreakpoints,
    sectionInteractionModels,
  };
}

// ---------------------------------------------------------------------------
// Step 1: Click-driven state capture
// ---------------------------------------------------------------------------

async function captureClickStates(
  page: Page,
  maxClicks: number,
): Promise<Map<string, StateSpec[]>> {
  const result = new Map<string, StateSpec[]>();

  // Discover interactive groups inside the browser
  const groups: InteractiveGroup[] = await page.evaluate(() => {
    const found: InteractiveGroup[] = [];

    function buildSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === el.tagName,
      );
      if (siblings.length === 1) {
        return `${buildSelector(parent)} > ${tag}`;
      }
      const index = siblings.indexOf(el);
      return `${buildSelector(parent)} > ${tag}:nth-child(${index + 1})`;
    }

    // Strategy 1: ARIA tablists
    const tablists = document.querySelectorAll('[role="tablist"]');
    for (const tablist of tablists) {
      const tabs = Array.from(
        tablist.querySelectorAll('[role="tab"]'),
      );
      if (tabs.length < 2) continue;

      const firstTab = tabs[0];
      const panelId = firstTab.getAttribute('aria-controls');
      const targetSelector = panelId
        ? `#${panelId}`
        : buildSelector(tablist.parentElement ?? tablist) + ' [role="tabpanel"]';

      found.push({
        containerSelector: buildSelector(tablist),
        triggerSelectors: tabs.map(buildSelector),
        targetSelector,
        groupType: 'tab',
      });
    }

    // Strategy 2: Buttons/links in a flex/grid container with similar siblings
    const containers = document.querySelectorAll(
      '.tabs, .tab-list, .pills, .segmented-control, [data-tabs]',
    );
    for (const container of containers) {
      const children = Array.from(container.children).filter((c) => {
        const tag = c.tagName.toLowerCase();
        return tag === 'button' || tag === 'a' || c.getAttribute('role') === 'tab';
      });
      if (children.length < 2) continue;

      // Skip if already found as ARIA tablist
      const alreadyCaptured = found.some(
        (g) => g.containerSelector === buildSelector(container),
      );
      if (alreadyCaptured) continue;

      found.push({
        containerSelector: buildSelector(container),
        triggerSelectors: children.map(buildSelector),
        targetSelector: buildSelector(container.parentElement ?? container),
        groupType: 'tab',
      });
    }

    // Strategy 3: Elements with data-tab/data-toggle attributes
    const dataToggleEls = document.querySelectorAll(
      '[data-tab], [data-toggle], [data-bs-toggle="tab"], [data-bs-toggle="pill"]',
    );
    if (dataToggleEls.length >= 2) {
      const parent = dataToggleEls[0].parentElement;
      if (parent) {
        const alreadyCaptured = found.some(
          (g) => g.containerSelector === buildSelector(parent),
        );
        if (!alreadyCaptured) {
          found.push({
            containerSelector: buildSelector(parent),
            triggerSelectors: Array.from(dataToggleEls).map(buildSelector),
            targetSelector: buildSelector(parent.parentElement ?? parent),
            groupType: 'toggle',
          });
        }
      }
    }

    // Strategy 4: Details/summary (accordions)
    const details = document.querySelectorAll('details');
    for (const detail of details) {
      const summary = detail.querySelector('summary');
      if (!summary) continue;
      found.push({
        containerSelector: buildSelector(detail),
        triggerSelectors: [buildSelector(summary)],
        targetSelector: buildSelector(detail),
        groupType: 'accordion',
      });
    }

    return found;
  });

  let clickCount = 0;

  for (const group of groups) {
    if (clickCount >= maxClicks) break;

    for (const triggerSelector of group.triggerSelectors) {
      if (clickCount >= maxClicks) break;

      try {
        // Capture baseline content of the target area
        const baselineContent = await captureTargetContent(
          page,
          group.targetSelector,
        );

        // Capture trigger element styles before click
        const beforeStyles = await captureElementStyles(
          page,
          triggerSelector,
        );

        // Click the trigger
        const trigger = page.locator(triggerSelector).first();
        await trigger.click({ timeout: 2000 }).catch(() => {
          // Element might not be clickable; skip silently
        });
        clickCount++;

        // Wait for transitions to settle
        await page.waitForTimeout(TRANSITION_SETTLE_MS);

        // Capture content and styles after click
        const afterContent = await captureTargetContent(
          page,
          group.targetSelector,
        );
        const afterStyles = await captureElementStyles(
          page,
          triggerSelector,
        );

        // Build style diff
        const styleChanges: Record<string, { from: string; to: string }> = {};
        for (const [prop, fromVal] of Object.entries(beforeStyles)) {
          const toVal = afterStyles[prop];
          if (toVal !== undefined && fromVal !== toVal) {
            styleChanges[prop] = { from: fromVal, to: toVal };
          }
        }

        // Only record if something actually changed
        const contentChanged =
          baselineContent.textContent !== afterContent.textContent ||
          baselineContent.childCount !== afterContent.childCount ||
          baselineContent.boundingHeight !== afterContent.boundingHeight;

        if (contentChanged || Object.keys(styleChanges).length > 0) {
          const existingStates = result.get(triggerSelector) ?? [];
          existingStates.push({
            trigger: 'active',
            styleChanges,
          });
          result.set(triggerSelector, existingStates);
        }
      } catch {
        // Skip elements that can't be interacted with
        continue;
      }
    }
  }

  return result;
}

async function captureTargetContent(
  page: Page,
  selector: string,
): Promise<CapturedContent> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) {
      return {
        textContent: '',
        childCount: 0,
        visibility: 'hidden',
        boundingHeight: 0,
      };
    }
    const rect = el.getBoundingClientRect();
    return {
      textContent: (el.textContent ?? '').trim().slice(0, 200),
      childCount: el.children.length,
      visibility: window.getComputedStyle(el).visibility,
      boundingHeight: Math.round(rect.height),
    };
  }, selector);
}

async function captureElementStyles(
  page: Page,
  selector: string,
): Promise<Record<string, string>> {
  return page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel);
      if (!el) return {};
      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of props) {
        styles[prop] = computed.getPropertyValue(prop);
      }
      return styles;
    },
    { sel: selector, props: [...TRACKED_STYLE_PROPERTIES] },
  );
}

// ---------------------------------------------------------------------------
// Step 2: Scroll state capture
// ---------------------------------------------------------------------------

async function captureScrollStates(
  page: Page,
  customPositions: number[],
): Promise<ScrollStateCapture[]> {
  // Find all fixed/sticky elements
  const stickyElements: StickyFixedElement[] = await page.evaluate(
    (trackedProps) => {
      const results: StickyFixedElement[] = [];

      function buildSelector(el: Element): string {
        if (el.id) return `#${el.id}`;
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (!parent) return tag;
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === el.tagName,
        );
        if (siblings.length === 1) {
          return `${buildSelector(parent)} > ${tag}`;
        }
        const index = siblings.indexOf(el);
        return `${buildSelector(parent)} > ${tag}:nth-child(${index + 1})`;
      }

      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const selector = buildSelector(el);
          const baseStyles: Record<string, string> = {};
          for (const prop of trackedProps) {
            baseStyles[prop] = style.getPropertyValue(prop);
          }
          results.push({
            selector,
            position: style.position,
            baseStyles,
          });
        }
      }

      return results;
    },
    [...TRACKED_STYLE_PROPERTIES],
  );

  if (stickyElements.length === 0) return [];

  // Determine scroll positions to test
  const pageHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const positions =
    customPositions.length > 0
      ? customPositions
      : buildScrollPositions(pageHeight);

  // Save original scroll position
  const originalScroll = await page.evaluate(() => window.scrollY);

  const captures: ScrollStateCapture[] = [];

  // Capture styles at scroll=0 as baseline
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const baselineStyles = new Map<string, Record<string, string>>();
  for (const element of stickyElements) {
    const styles = await captureElementStyles(page, element.selector);
    baselineStyles.set(element.selector, styles);
  }

  // Scroll to each position and capture style diffs
  for (const scrollPos of positions) {
    if (scrollPos === 0) continue;
    if (scrollPos > pageHeight) break;

    await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos);
    await page.waitForTimeout(100);

    for (const element of stickyElements) {
      const currentStyles = await captureElementStyles(
        page,
        element.selector,
      );
      const baseline = baselineStyles.get(element.selector) ?? {};

      // Diff against baseline
      const changedStyles: Record<string, string> = {};
      for (const [prop, val] of Object.entries(currentStyles)) {
        if (baseline[prop] !== val) {
          changedStyles[prop] = val;
        }
      }

      if (Object.keys(changedStyles).length > 0) {
        captures.push({
          elementSelector: element.selector,
          scrollPosition: scrollPos,
          styleChanges: changedStyles,
        });
      }
    }
  }

  // Restore original scroll position
  await page.evaluate((pos) => window.scrollTo(0, pos), originalScroll);

  return captures;
}

function buildScrollPositions(pageHeight: number): number[] {
  const positions = [...SCROLL_POSITIONS];
  // Add positions every 500px beyond the predefined set
  let pos = 1500;
  while (pos < pageHeight) {
    positions.push(pos);
    pos += 500;
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Step 3: Responsive breakpoint detection
// ---------------------------------------------------------------------------

async function captureResponsiveBreakpoints(
  page: Page,
  breakpoints: number[],
): Promise<BreakpointSpec[]> {
  // Save original viewport
  const originalViewport = page.viewportSize();
  if (!originalViewport) return [];

  // Sort breakpoints descending so the first is the desktop baseline
  const sorted = [...breakpoints].sort((a, b) => b - a);
  const desktopWidth = sorted[0];

  // Set desktop viewport and capture baseline
  await page.setViewportSize({
    width: desktopWidth,
    height: originalViewport.height,
  });
  await page.waitForTimeout(TRANSITION_SETTLE_MS);

  const baselineSnapshots = await captureLayoutSnapshot(page);

  const results: BreakpointSpec[] = [];

  // Test each narrower breakpoint
  for (let i = 1; i < sorted.length; i++) {
    const width = sorted[i];

    await page.setViewportSize({
      width,
      height: originalViewport.height,
    });
    await page.waitForTimeout(TRANSITION_SETTLE_MS);

    const currentSnapshots = await captureLayoutSnapshot(page);

    // Diff against desktop baseline
    const changes: BreakpointChange[] = [];
    for (const current of currentSnapshots) {
      const baseline = baselineSnapshots.find(
        (b) => b.selector === current.selector,
      );
      if (!baseline) continue;

      for (const [prop, val] of Object.entries(current.styles)) {
        const baseVal = baseline.styles[prop];
        if (baseVal !== undefined && baseVal !== val) {
          changes.push({
            elementSelector: current.selector,
            property: prop,
            desktopValue: baseVal,
            breakpointValue: val,
          });
        }
      }
    }

    if (changes.length > 0) {
      results.push({ width, changes });
    }
  }

  // Restore original viewport
  await page.setViewportSize(originalViewport);

  return results;
}

async function captureLayoutSnapshot(
  page: Page,
): Promise<BreakpointSnapshot[]> {
  return page.evaluate((trackedProps) => {
    function buildSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return tag;
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === el.tagName,
      );
      if (siblings.length === 1) {
        return `${buildSelector(parent)} > ${tag}`;
      }
      const index = siblings.indexOf(el);
      return `${buildSelector(parent)} > ${tag}:nth-child(${index + 1})`;
    }

    const SKIP_TAGS = new Set([
      'SCRIPT',
      'STYLE',
      'LINK',
      'META',
      'NOSCRIPT',
    ]);

    // Capture key layout elements: sections, main, header, footer, nav,
    // and any direct children of body that aren't skippable.
    const candidates = new Set<Element>();

    const landmarks = document.querySelectorAll(
      'section, main, header, footer, nav, [role="region"], [role="banner"], [role="contentinfo"], [role="navigation"]',
    );
    for (const el of landmarks) {
      candidates.add(el);
      // Also capture their direct children for finer-grained diffs
      for (const child of el.children) {
        if (!SKIP_TAGS.has(child.tagName)) {
          candidates.add(child);
        }
      }
    }

    // Fallback: body direct children
    if (candidates.size === 0) {
      for (const child of document.body.children) {
        if (!SKIP_TAGS.has(child.tagName)) {
          candidates.add(child);
        }
      }
    }

    const snapshots: { selector: string; styles: Record<string, string> }[] =
      [];

    for (const el of candidates) {
      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of trackedProps) {
        styles[prop] = computed.getPropertyValue(prop);
      }
      snapshots.push({
        selector: buildSelector(el),
        styles,
      });
    }

    return snapshots;
  }, [...RESPONSIVE_TRACKED_PROPERTIES]);
}

// ---------------------------------------------------------------------------
// Step 4: Section interaction model classification
// ---------------------------------------------------------------------------

async function classifySectionModels(
  page: Page,
  elementStates: Map<string, StateSpec[]>,
  scrollStates: ScrollStateCapture[],
): Promise<Map<string, InteractionModel>> {
  // Get section IDs and their bounding info from the page
  const sectionInfo: Array<{
    id: string;
    top: number;
    bottom: number;
    hasAutoplay: boolean;
    hasHoverListeners: boolean;
  }> = await page.evaluate(() => {
    function buildSelector(el: Element): string {
      if (el.id) return `#${el.id}`;
      return el.tagName.toLowerCase();
    }

    const sections = document.querySelectorAll(
      'section, [role="region"], header, footer, main > *',
    );
    const results: Array<{
      id: string;
      top: number;
      bottom: number;
      hasAutoplay: boolean;
      hasHoverListeners: boolean;
    }> = [];

    let index = 0;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const id =
        section.id ||
        `section-${index}-${buildSelector(section)}`;

      // Check for auto-playing elements (carousels, videos)
      const hasAutoplay =
        section.querySelector('video[autoplay], [data-autoplay], .swiper, .slick-slider, .carousel') !==
        null;

      // Check for elements with hover-centric interactions
      const hasHoverListeners =
        section.querySelector('[data-hover], .hover-card, [class*="hover"]') !==
        null;

      results.push({
        id,
        top: rect.top + window.scrollY,
        bottom: rect.bottom + window.scrollY,
        hasAutoplay,
        hasHoverListeners,
      });

      index++;
    }

    return results;
  });

  const models = new Map<string, InteractionModel>();

  for (const section of sectionInfo) {
    const signals = {
      hasClickStates: false,
      hasScrollStates: false,
      hasAutoplay: section.hasAutoplay,
      hasHoverInteractions: section.hasHoverListeners,
    };

    // Check if any click-captured element falls within this section
    for (const [selector] of elementStates) {
      const elRect = await page
        .evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
        }, selector)
        .catch(() => null);

      if (
        elRect &&
        elRect.top >= section.top &&
        elRect.bottom <= section.bottom
      ) {
        signals.hasClickStates = true;
        break;
      }
    }

    // Check if any scroll-captured element falls within this section
    for (const capture of scrollStates) {
      const elRect = await page
        .evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
        }, capture.elementSelector)
        .catch(() => null);

      if (
        elRect &&
        elRect.top >= section.top &&
        elRect.bottom <= section.bottom
      ) {
        signals.hasScrollStates = true;
        break;
      }
    }

    // Classify based on signals
    const activeSignals = [
      signals.hasClickStates,
      signals.hasScrollStates,
      signals.hasAutoplay,
      signals.hasHoverInteractions,
    ].filter(Boolean).length;

    let model: InteractionModel;

    if (activeSignals >= 2) {
      model = 'hybrid';
    } else if (signals.hasClickStates) {
      model = 'click-driven';
    } else if (signals.hasScrollStates) {
      model = 'scroll-driven';
    } else if (signals.hasAutoplay) {
      model = 'time-driven';
    } else if (signals.hasHoverInteractions) {
      model = 'hover-driven';
    } else {
      model = 'static';
    }

    models.set(section.id, model);
  }

  return models;
}
