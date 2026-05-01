/**
 * Dynamic content masking for pixel-diff comparisons.
 *
 * Hides or normalizes transient page content (timestamps, cookie banners,
 * chat widgets, date strings) so pixel-diff scores reflect real styling
 * differences rather than unavoidable content drift.
 */

import type { Page } from 'playwright';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MaskViewport = 'desktop' | 'tablet' | 'mobile';

export interface RegionMask {
  /** CSS selector(s) of regions to overlay with a solid color before screenshot. */
  selector: string;
  /** Optional viewport restriction. When omitted, the mask applies to all viewports. */
  viewports?: MaskViewport[];
  /** Optional human-readable reason (printed in QA output). */
  reason?: string;
  /** Solid fill color (default `#FF00FF` magenta — same on both sides so pixelmatch ignores). */
  fillColor?: string;
}

export interface ContentMask {
  /** CSS selectors of elements to hide via `visibility: hidden`. */
  hideSelectors?: string[];
  /** Replace text content of specific elements. */
  textReplacements?: Array<{
    selector: string;
    replacement: string;
  }>;
  /** Regex patterns applied to all text nodes in `<body>`. */
  regexMasks?: Array<{
    pattern: string;
    replacement: string;
  }>;
  /** User-defined region masks (overlaid with solid color before diffing). */
  regionMasks?: RegionMask[];
}

export interface MaskFireReport {
  selector: string;
  matchCount: number;
  reason?: string;
}

export interface MaskConfigFile {
  masks: RegionMask[];
}

// ---------------------------------------------------------------------------
// Built-in masks for common dynamic content
// ---------------------------------------------------------------------------

export const DEFAULT_MASKS: ContentMask = {
  hideSelectors: [
    '[class*="cookie"]',
    '[class*="consent"]',
    '[id*="cookie"]',
    '[class*="popup"]',
    '[class*="banner"][class*="promo"]',
    'iframe[src*="recaptcha"]',
    '[class*="chat-widget"]',
    '[class*="intercom"]',
  ],
  regexMasks: [
    {
      pattern: '\\d+\\s*(seconds?|minutes?|hours?|days?)\\s*ago',
      replacement: '[time ago]',
    },
    {
      pattern:
        '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2},?\\s+\\d{4}',
      replacement: '[date]',
    },
    {
      pattern: '\\d{1,2}/\\d{1,2}/\\d{2,4}',
      replacement: '[date]',
    },
  ],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Merge user-provided masks with defaults. User values are appended to
 * default arrays, not replaced, so built-in masks always apply.
 */
function mergeMasks(custom?: ContentMask): ContentMask {
  if (!custom) return DEFAULT_MASKS;

  return {
    hideSelectors: [
      ...(DEFAULT_MASKS.hideSelectors ?? []),
      ...(custom.hideSelectors ?? []),
    ],
    textReplacements: [
      ...(DEFAULT_MASKS.textReplacements ?? []),
      ...(custom.textReplacements ?? []),
    ],
    regexMasks: [
      ...(DEFAULT_MASKS.regexMasks ?? []),
      ...(custom.regexMasks ?? []),
    ],
    regionMasks: [...(custom.regionMasks ?? [])],
  };
}

/**
 * Filter user region masks down to those applicable for the current viewport.
 */
export function filterRegionMasksForViewport(
  masks: RegionMask[] | undefined,
  viewport: MaskViewport,
): RegionMask[] {
  if (!masks) return [];
  return masks.filter(
    (m) => !m.viewports || m.viewports.length === 0 || m.viewports.includes(viewport),
  );
}

// ---------------------------------------------------------------------------
// Serialisable types for page.evaluate (no functions cross the boundary)
// ---------------------------------------------------------------------------

interface SerializableMask {
  hideSelectors: string[];
  textReplacements: Array<{ selector: string; replacement: string }>;
  regexMasks: Array<{ pattern: string; replacement: string }>;
  regionMasks: Array<{ selector: string; fillColor: string; reason?: string }>;
}

const DEFAULT_REGION_FILL = '#FF00FF';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply content masks to a Playwright page.
 *
 * Hides dynamic elements, replaces transient text, and normalises date
 * strings so that pixel-diff captures only meaningful visual differences.
 *
 * Returns a **cleanup function** that restores the page to its original
 * state after screenshots are captured.
 */
export interface ApplyMasksResult {
  cleanup: () => Promise<void>;
  fired: MaskFireReport[];
}

export async function applyContentMasks(
  page: Page,
  masks?: ContentMask,
  viewport?: MaskViewport,
): Promise<ApplyMasksResult> {
  const merged = mergeMasks(masks);

  // Filter region masks by viewport if specified
  const regionMasksForViewport = viewport
    ? filterRegionMasksForViewport(merged.regionMasks, viewport)
    : merged.regionMasks ?? [];

  const serializable: SerializableMask = {
    hideSelectors: merged.hideSelectors ?? [],
    textReplacements: merged.textReplacements ?? [],
    regexMasks: merged.regexMasks ?? [],
    regionMasks: regionMasksForViewport.map((m) => ({
      selector: m.selector,
      fillColor: m.fillColor ?? DEFAULT_REGION_FILL,
      reason: m.reason,
    })),
  };

  const fired = await page.evaluate((m: SerializableMask) => {
    // Backup storage so we can restore later
    const backup: Array<
      | { kind: 'visibility'; el: HTMLElement; prev: string }
      | { kind: 'text'; el: HTMLElement; prev: string }
      | { kind: 'textNode'; node: Text; prev: string }
      | { kind: 'overlay'; el: HTMLElement }
    > = [];

    const fireReports: Array<{ selector: string; matchCount: number; reason?: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__drpMaskBackup = backup;

    // 1. Hide elements
    for (const sel of m.hideSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const htmlEl = el as HTMLElement;
        backup.push({ kind: 'visibility', el: htmlEl, prev: htmlEl.style.visibility });
        htmlEl.style.visibility = 'hidden';
      });
    }

    // 2. Text replacements on targeted elements
    for (const { selector, replacement } of m.textReplacements) {
      document.querySelectorAll(selector).forEach((el) => {
        const htmlEl = el as HTMLElement;
        backup.push({ kind: 'text', el: htmlEl, prev: htmlEl.textContent ?? '' });
        htmlEl.textContent = replacement;
      });
    }

    // 3. Regex replacements on all body text nodes
    if (m.regexMasks.length > 0) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const textNode = node as Text;
        let text = textNode.textContent ?? '';
        let changed = false;

        for (const { pattern, replacement } of m.regexMasks) {
          const regex = new RegExp(pattern, 'gi');
          if (regex.test(text)) {
            text = text.replace(new RegExp(pattern, 'gi'), replacement);
            changed = true;
          }
        }

        if (changed) {
          backup.push({ kind: 'textNode', node: textNode, prev: textNode.textContent ?? '' });
          textNode.textContent = text;
        }
      }
    }

    // 4. Region overlays — paint solid color rectangles over user-defined regions
    for (const { selector, fillColor, reason } of m.regionMasks) {
      let matchCount = 0;
      let elements: NodeListOf<Element>;
      try {
        elements = document.querySelectorAll(selector);
      } catch {
        fireReports.push({ selector, matchCount: 0, reason });
        continue;
      }

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const overlay = document.createElement('div');
        overlay.dataset['drpMaskOverlay'] = '1';
        overlay.style.position = 'absolute';
        overlay.style.left = `${rect.left + window.scrollX}px`;
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.style.backgroundColor = fillColor;
        overlay.style.zIndex = '2147483647';
        overlay.style.pointerEvents = 'none';
        overlay.style.margin = '0';
        overlay.style.padding = '0';
        overlay.style.border = 'none';
        document.body.appendChild(overlay);
        backup.push({ kind: 'overlay', el: overlay });
        matchCount++;
      });

      fireReports.push({ selector, matchCount, reason });
    }

    return fireReports;
  }, serializable);

  // Return a cleanup function that restores the page
  const cleanup = async (): Promise<void> => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backup = (window as any).__drpMaskBackup as
        | Array<
            | { kind: 'visibility'; el: HTMLElement; prev: string }
            | { kind: 'text'; el: HTMLElement; prev: string }
            | { kind: 'textNode'; node: Text; prev: string }
            | { kind: 'overlay'; el: HTMLElement }
          >
        | undefined;

      if (!backup) return;

      for (const item of backup) {
        switch (item.kind) {
          case 'visibility':
            item.el.style.visibility = item.prev;
            break;
          case 'text':
            item.el.textContent = item.prev;
            break;
          case 'textNode':
            item.node.textContent = item.prev;
            break;
          case 'overlay':
            item.el.remove();
            break;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__drpMaskBackup;
    });
  };

  return { cleanup, fired };
}

// ---------------------------------------------------------------------------
// Mask config file loading
// ---------------------------------------------------------------------------

/**
 * Load and validate a region-mask config JSON file.
 * Throws if the file is malformed.
 */
export async function loadMaskConfigFile(filePath: string): Promise<RegionMask[]> {
  const { readFile } = await import('fs/promises');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { masks?: unknown }).masks)
  ) {
    throw new Error(
      `Mask config file ${filePath} must be an object with a 'masks' array`,
    );
  }

  const masks = (parsed as MaskConfigFile).masks;
  for (const m of masks) {
    if (!m.selector || typeof m.selector !== 'string') {
      throw new Error(`Mask config entry missing required 'selector' string`);
    }
  }
  return masks;
}

