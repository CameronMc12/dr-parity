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
  };
}

// ---------------------------------------------------------------------------
// Serialisable types for page.evaluate (no functions cross the boundary)
// ---------------------------------------------------------------------------

interface SerializableMask {
  hideSelectors: string[];
  textReplacements: Array<{ selector: string; replacement: string }>;
  regexMasks: Array<{ pattern: string; replacement: string }>;
}

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
export async function applyContentMasks(
  page: Page,
  masks?: ContentMask,
): Promise<() => Promise<void>> {
  const merged = mergeMasks(masks);

  const serializable: SerializableMask = {
    hideSelectors: merged.hideSelectors ?? [],
    textReplacements: merged.textReplacements ?? [],
    regexMasks: merged.regexMasks ?? [],
  };

  await page.evaluate((m: SerializableMask) => {
    // Backup storage so we can restore later
    const backup: Array<
      | { kind: 'visibility'; el: HTMLElement; prev: string }
      | { kind: 'text'; el: HTMLElement; prev: string }
      | { kind: 'textNode'; node: Text; prev: string }
    > = [];

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
  }, serializable);

  // Return a cleanup function that restores the page
  return async () => {
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backup = (window as any).__drpMaskBackup as
        | Array<
            | { kind: 'visibility'; el: HTMLElement; prev: string }
            | { kind: 'text'; el: HTMLElement; prev: string }
            | { kind: 'textNode'; node: Text; prev: string }
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
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__drpMaskBackup;
    });
  };
}
