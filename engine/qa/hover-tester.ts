/**
 * Hover State Tester — validates that hover effects in the clone match
 * the original by programmatically hovering interactive elements and
 * capturing style changes.
 *
 * Usage:
 *   const results = await testHoverStates(page, { outputDir: 'qa-output' });
 */

import type { Page } from 'playwright';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HoverTestResult {
  elementSelector: string;
  elementDescription: string;
  beforeScreenshot: string;
  afterScreenshot: string;
  styleChanges: Record<string, { before: string; after: string }>;
  hasVisualDifference: boolean;
}

export interface HoverTestOptions {
  outputDir: string;
  /** Specific selectors to test. Auto-detected when omitted. */
  selectors?: string[];
  /** Maximum interactive elements to test. Default `30`. */
  maxElements?: number;
  /** Viewport size for the test. Uses page default when omitted. */
  viewport?: { width: number; height: number };
}

// ---------------------------------------------------------------------------
// Tracked style properties for hover diff
// ---------------------------------------------------------------------------

const HOVER_TRACKED_PROPERTIES = [
  'color',
  'backgroundColor',
  'transform',
  'opacity',
  'boxShadow',
  'borderColor',
  'textDecoration',
  'scale',
  'outline',
  'filter',
] as const;

type TrackedProp = (typeof HOVER_TRACKED_PROPERTIES)[number];

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function testHoverStates(
  page: Page,
  options: HoverTestOptions,
): Promise<HoverTestResult[]> {
  const results: HoverTestResult[] = [];
  const maxElements = options.maxElements ?? 30;

  // Auto-detect interactive elements if no selectors provided
  const selectors =
    options.selectors ??
    (await autoDetectInteractiveSelectors(page, maxElements));

  for (const selector of selectors.slice(0, maxElements)) {
    try {
      const result = await testSingleHover(page, selector);
      if (result) {
        results.push(result);
      }
    } catch {
      // Skip elements that cannot be hovered (detached, hidden, etc.)
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-detect interactive elements
// ---------------------------------------------------------------------------

async function autoDetectInteractiveSelectors(
  page: Page,
  maxCount: number,
): Promise<string[]> {
  return page.evaluate((limit: number) => {
    const interactive = document.querySelectorAll(
      'a, button, [role="button"], [tabindex], [class*="card"], [class*="link"]',
    );

    return Array.from(interactive)
      .filter((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          cs.display !== 'none' &&
          cs.visibility !== 'hidden' &&
          (cs.transition !== 'all 0s ease 0s' || cs.cursor === 'pointer')
        );
      })
      .slice(0, limit)
      .map((el) => {
        if (el.id) return '#' + CSS.escape(el.id);
        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).slice(0, 2);
        const classPart = classes.length > 0 ? '.' + classes.join('.') : '';
        return tag + classPart;
      });
  }, maxCount);
}

// ---------------------------------------------------------------------------
// Test a single element's hover state
// ---------------------------------------------------------------------------

async function testSingleHover(
  page: Page,
  selector: string,
): Promise<HoverTestResult | null> {
  const el = page.locator(selector).first();
  const isVisible = await el.isVisible().catch(() => false);
  if (!isVisible) return null;

  // Ensure the element is in view
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);

  // Capture styles before hover
  const beforeStyles = await captureHoverStyles(page, selector);
  if (!beforeStyles) return null;

  // Hover
  await el.hover({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(300); // Wait for transitions

  // Capture styles after hover
  const afterStyles = await captureHoverStyles(page, selector);
  if (!afterStyles) return null;

  // Compute diff
  const styleChanges: Record<string, { before: string; after: string }> = {};
  for (const prop of HOVER_TRACKED_PROPERTIES) {
    const beforeVal = beforeStyles[prop];
    const afterVal = afterStyles[prop];
    if (beforeVal !== afterVal) {
      styleChanges[prop] = { before: beforeVal, after: afterVal };
    }
  }

  const hasVisualDifference = Object.keys(styleChanges).length > 0;

  // Reset hover
  await page.mouse.move(0, 0);
  await page.waitForTimeout(100);

  if (!hasVisualDifference) return null;

  // Get element description
  const description = await el
    .evaluate((e) => e.textContent?.trim().slice(0, 50) || e.tagName)
    .catch(() => 'unknown');

  return {
    elementSelector: selector,
    elementDescription: description,
    beforeScreenshot: '',
    afterScreenshot: '',
    styleChanges,
    hasVisualDifference,
  };
}

// ---------------------------------------------------------------------------
// Style capture helper
// ---------------------------------------------------------------------------

async function captureHoverStyles(
  page: Page,
  selector: string,
): Promise<Record<TrackedProp, string> | null> {
  return page.evaluate(
    ({ sel, props }: { sel: string; props: string[] }) => {
      const safeQuery = (s: string): Element | null => {
        try {
          return document.querySelector(s);
        } catch {
          try {
            const escaped = s.replace(
              /\.([^\s.>#~+[\]:]+)/g,
              (_m, cls: string) => '.' + CSS.escape(cls),
            );
            return document.querySelector(escaped);
          } catch {
            return null;
          }
        }
      };

      const el = safeQuery(sel);
      if (!el) return null;

      const cs = getComputedStyle(el);
      const result: Record<string, string> = {};
      for (const prop of props) {
        result[prop] = cs.getPropertyValue(
          prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()),
        );
      }
      return result;
    },
    { sel: selector, props: [...HOVER_TRACKED_PROPERTIES] },
  ) as Promise<Record<TrackedProp, string> | null>;
}
