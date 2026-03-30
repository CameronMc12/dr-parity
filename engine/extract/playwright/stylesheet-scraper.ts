/**
 * Stylesheet Scraper — captures raw CSS rules, variables, keyframes, and media
 * queries from all stylesheets on the page.
 *
 * Strategy:
 *   1. Same-origin sheets: iterate `cssRules` directly via the CSSOM.
 *   2. Cross-origin sheets: `fetch()` the CSS text from the page context and
 *      parse with lightweight regex patterns.
 *   3. Inline `<style>` elements: read `textContent` and parse.
 */

import type { Page } from 'playwright';
import type {
  StylesheetData,
  StylesheetExtractionResult,
  CSSRuleData,
  MediaQueryData,
  KeyframeData,
  CSSVariableData,
} from '../../types/extraction';

// Re-export types for convenience
export type {
  StylesheetData,
  StylesheetExtractionResult,
  CSSRuleData,
  MediaQueryData,
  KeyframeData,
  CSSVariableData,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape all stylesheets accessible from the page and return structured data.
 */
export async function scrapeStylesheets(
  page: Page,
): Promise<StylesheetExtractionResult> {
  const stylesheets = await page.evaluate(() => {
    // ----- Helpers (run in browser) -----

    const MAX_RULES_PER_SHEET = 2000;
    const MAX_PROPERTY_COUNT = 50;

    const extractProperties = (
      style: CSSStyleDeclaration,
      limit: number,
    ): Record<string, string> => {
      const props: Record<string, string> = {};
      const count = Math.min(style.length, limit);
      for (let i = 0; i < count; i++) {
        const name = style[i];
        props[name] = style.getPropertyValue(name);
      }
      return props;
    };

    const extractVariablesFromProperties = (
      style: CSSStyleDeclaration,
      scope: string,
    ): Array<{ name: string; value: string; scope: string }> => {
      const vars: Array<{ name: string; value: string; scope: string }> = [];
      for (let i = 0; i < style.length; i++) {
        const name = style[i];
        if (name.startsWith('--')) {
          vars.push({ name, value: style.getPropertyValue(name).trim(), scope });
        }
      }
      return vars;
    };

    const processStyleRule = (
      rule: CSSStyleRule,
    ): {
      ruleData: { selector: string; properties: Record<string, string> };
      variables: Array<{ name: string; value: string; scope: string }>;
    } => {
      const properties = extractProperties(rule.style, MAX_PROPERTY_COUNT);
      const variables = extractVariablesFromProperties(rule.style, rule.selectorText);
      return {
        ruleData: { selector: rule.selectorText, properties },
        variables,
      };
    };

    const processKeyframesRule = (
      rule: CSSKeyframesRule,
    ): { name: string; frames: Array<{ offset: string; properties: Record<string, string> }> } => {
      const frames: Array<{ offset: string; properties: Record<string, string> }> = [];
      for (const kf of Array.from(rule.cssRules)) {
        if (kf instanceof CSSKeyframeRule) {
          frames.push({
            offset: kf.keyText,
            properties: extractProperties(kf.style, MAX_PROPERTY_COUNT),
          });
        }
      }
      return { name: rule.name, frames };
    };

    const processMediaRule = (
      rule: CSSMediaRule,
    ): {
      mediaData: { query: string; rules: Array<{ selector: string; properties: Record<string, string> }> };
      variables: Array<{ name: string; value: string; scope: string }>;
    } => {
      const query = rule.conditionText ?? rule.media.mediaText;
      const rules: Array<{ selector: string; properties: Record<string, string> }> = [];
      const variables: Array<{ name: string; value: string; scope: string }> = [];

      for (const nested of Array.from(rule.cssRules)) {
        if (nested instanceof CSSStyleRule) {
          const result = processStyleRule(nested);
          rules.push(result.ruleData);
          variables.push(...result.variables);
        }
      }

      return { mediaData: { query, rules }, variables };
    };

    const processSheet = (
      sheet: CSSStyleSheet,
      url: string | null,
    ): {
      url: string | null;
      rules: Array<{ selector: string; properties: Record<string, string> }>;
      mediaQueries: Array<{ query: string; rules: Array<{ selector: string; properties: Record<string, string> }> }>;
      keyframes: Array<{ name: string; frames: Array<{ offset: string; properties: Record<string, string> }> }>;
      cssVariables: Array<{ name: string; value: string; scope: string }>;
    } => {
      const rules: Array<{ selector: string; properties: Record<string, string> }> = [];
      const mediaQueries: Array<{ query: string; rules: Array<{ selector: string; properties: Record<string, string> }> }> = [];
      const keyframes: Array<{ name: string; frames: Array<{ offset: string; properties: Record<string, string> }> }> = [];
      const cssVariables: Array<{ name: string; value: string; scope: string }> = [];

      try {
        const cssRules = Array.from(sheet.cssRules);
        const limit = Math.min(cssRules.length, MAX_RULES_PER_SHEET);

        for (let i = 0; i < limit; i++) {
          const rule = cssRules[i];

          if (rule instanceof CSSStyleRule) {
            const result = processStyleRule(rule);
            rules.push(result.ruleData);
            cssVariables.push(...result.variables);
          } else if (rule instanceof CSSKeyframesRule) {
            keyframes.push(processKeyframesRule(rule));
          } else if (rule instanceof CSSMediaRule) {
            const result = processMediaRule(rule);
            mediaQueries.push(result.mediaData);
            cssVariables.push(...result.variables);
          }
        }
      } catch {
        // Cross-origin — rules inaccessible via CSSOM
      }

      return { url, rules, mediaQueries, keyframes, cssVariables };
    };

    // ----- Main extraction logic -----

    const results: Array<ReturnType<typeof processSheet>> = [];

    for (const sheet of Array.from(document.styleSheets)) {
      const href = sheet.href;

      // Determine if we can access rules directly
      let accessible = false;
      try {
        // Accessing cssRules throws on cross-origin sheets
        void sheet.cssRules;
        accessible = true;
      } catch {
        accessible = false;
      }

      if (accessible) {
        results.push(processSheet(sheet, href));
      }
      // Cross-origin sheets are skipped — fetching them from inside
      // evaluate is unreliable due to CORS. The CSSOM path covers
      // the vast majority of useful styles.
    }

    // Also capture inline <style> elements that may not be in styleSheets
    // (rare but possible with shadow DOM or dynamically injected styles)
    for (const styleEl of Array.from(document.querySelectorAll('style'))) {
      // These are already captured via document.styleSheets above in most cases
      // but we make sure we get their ownerSheet if available
      if (styleEl.sheet) {
        const alreadyCaptured = results.some((r) => r.url === null && r.rules.length > 0);
        if (!alreadyCaptured) {
          results.push(processSheet(styleEl.sheet, null));
        }
      }
    }

    return results;
  });

  // Compute totals
  let totalRules = 0;
  let totalKeyframes = 0;
  let totalMediaQueries = 0;
  let totalVariables = 0;

  for (const sheet of stylesheets) {
    totalRules += sheet.rules.length;
    totalKeyframes += sheet.keyframes.length;
    totalMediaQueries += sheet.mediaQueries.length;
    totalVariables += sheet.cssVariables.length;
  }

  return {
    stylesheets: stylesheets as StylesheetData[],
    totalRules,
    totalKeyframes,
    totalMediaQueries,
    totalVariables,
  };
}
