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
  CSSVariableReference,
  ContainerQueryData,
  RegisteredProperty,
} from '../../types/extraction';

// Re-export types for convenience
export type {
  StylesheetData,
  StylesheetExtractionResult,
  CSSRuleData,
  MediaQueryData,
  KeyframeData,
  CSSVariableData,
  CSSVariableReference,
  ContainerQueryData,
  RegisteredProperty,
};

/** Result returned by `scrapeStylesheets`, augmented with `@property` rules. */
export interface ScrapeResult extends StylesheetExtractionResult {
  registeredProperties: RegisteredProperty[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape all stylesheets accessible from the page and return structured data.
 */
export async function scrapeStylesheets(
  page: Page,
): Promise<ScrapeResult> {
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
      variableRefs: Array<{ selector: string; property: string; variable: string; resolvedValue: string }>;
    } => {
      const properties = extractProperties(rule.style, MAX_PROPERTY_COUNT);
      const variables = extractVariablesFromProperties(rule.style, rule.selectorText);

      // Scan property values for var(--xxx) references
      const variableRefs: Array<{ selector: string; property: string; variable: string; resolvedValue: string }> = [];
      for (const [prop, value] of Object.entries(properties)) {
        const varMatches = value.match(/var\(--[\w-]+/g);
        if (varMatches) {
          for (const match of varMatches) {
            const varName = match.replace('var(', '');
            variableRefs.push({
              selector: rule.selectorText,
              property: prop,
              variable: varName,
              resolvedValue: value,
            });
          }
        }
      }

      return {
        ruleData: { selector: rule.selectorText, properties },
        variables,
        variableRefs,
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
      variableRefs: Array<{ selector: string; property: string; variable: string; resolvedValue: string }>;
    } => {
      const query = rule.conditionText ?? rule.media.mediaText;
      const rules: Array<{ selector: string; properties: Record<string, string> }> = [];
      const variables: Array<{ name: string; value: string; scope: string }> = [];
      const variableRefs: Array<{ selector: string; property: string; variable: string; resolvedValue: string }> = [];

      for (const nested of Array.from(rule.cssRules)) {
        if (nested instanceof CSSStyleRule) {
          const result = processStyleRule(nested);
          rules.push(result.ruleData);
          variables.push(...result.variables);
          variableRefs.push(...result.variableRefs);
        }
      }

      return { mediaData: { query, rules }, variables, variableRefs };
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
      variableReferences: Array<{ selector: string; property: string; variable: string; resolvedValue: string }>;
      containerQueries: Array<{ name: string; condition: string; rules: Array<{ selector: string; properties: Record<string, string> }> }>;
    } => {
      const rules: Array<{ selector: string; properties: Record<string, string> }> = [];
      const mediaQueries: Array<{ query: string; rules: Array<{ selector: string; properties: Record<string, string> }> }> = [];
      const keyframes: Array<{ name: string; frames: Array<{ offset: string; properties: Record<string, string> }> }> = [];
      const cssVariables: Array<{ name: string; value: string; scope: string }> = [];
      const variableReferences: Array<{ selector: string; property: string; variable: string; resolvedValue: string }> = [];
      const containerQueries: Array<{ name: string; condition: string; rules: Array<{ selector: string; properties: Record<string, string> }> }> = [];

      try {
        const cssRules = Array.from(sheet.cssRules);
        const limit = Math.min(cssRules.length, MAX_RULES_PER_SHEET);

        for (let i = 0; i < limit; i++) {
          const rule = cssRules[i];

          if (rule instanceof CSSStyleRule) {
            const result = processStyleRule(rule);
            rules.push(result.ruleData);
            cssVariables.push(...result.variables);
            variableReferences.push(...result.variableRefs);
          } else if (rule instanceof CSSKeyframesRule) {
            keyframes.push(processKeyframesRule(rule));
          } else if (rule instanceof CSSMediaRule) {
            const result = processMediaRule(rule);
            mediaQueries.push(result.mediaData);
            cssVariables.push(...result.variables);
            variableReferences.push(...result.variableRefs);
          } else if (rule.cssText && rule.cssText.includes('@starting-style')) {
            // Detect @starting-style blocks — store as a special rule
            const selectorMatch = rule.cssText.match(/^([^{]+)\{/);
            const startingMatch = rule.cssText.match(/@starting-style\s*\{([^}]+)\}/);
            if (selectorMatch && startingMatch) {
              const startingProps: Record<string, string> = {};
              for (const decl of startingMatch[1].split(';')) {
                const colonIdx = decl.indexOf(':');
                if (colonIdx === -1) continue;
                const prop = decl.slice(0, colonIdx).trim();
                const val = decl.slice(colonIdx + 1).trim();
                if (prop && val) startingProps[prop] = val;
              }
              if (Object.keys(startingProps).length > 0) {
                rules.push({
                  selector: `@starting-style(${selectorMatch[1].trim()})`,
                  properties: startingProps,
                });
              }
            }
          } else if (rule.cssText && rule.cssText.includes('@container')) {
            // Detect container queries — CSSContainerRule may not be typed
            // in all environments, so we fall back to cssText parsing.
            const containerMatch = rule.cssText.match(/@container\s*(\w+)?\s*\(([^)]+)\)/);
            if (containerMatch) {
              const nestedRules: Array<{ selector: string; properties: Record<string, string> }> = [];
              // Extract nested style rules if the rule has cssRules
              const groupRule = rule as CSSRule & { cssRules?: CSSRuleList };
              if (groupRule.cssRules) {
                for (const nested of Array.from(groupRule.cssRules)) {
                  if (nested instanceof CSSStyleRule) {
                    nestedRules.push(processStyleRule(nested).ruleData);
                  }
                }
              }
              containerQueries.push({
                name: containerMatch[1] || '',
                condition: containerMatch[2],
                rules: nestedRules,
              });
            }
          }
        }
      } catch {
        // Cross-origin — rules inaccessible via CSSOM
      }

      return { url, rules, mediaQueries, keyframes, cssVariables, variableReferences, containerQueries };
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

  // --- CSS-in-JS extraction (Item 2.2) ---
  const cssInJsSheets = await extractCSSinJS(page);
  for (const sheet of cssInJsSheets) {
    // Conform to the same shape as processSheet() results
    stylesheets.push({
      ...sheet,
      variableReferences: [],
      containerQueries: sheet.containerQueries ?? [],
    });
  }

  // Compute totals and aggregate variable references
  let totalRules = 0;
  let totalKeyframes = 0;
  let totalMediaQueries = 0;
  let totalVariables = 0;
  const allVariableReferences: CSSVariableReference[] = [];

  for (const sheet of stylesheets) {
    totalRules += sheet.rules.length;
    totalKeyframes += sheet.keyframes.length;
    totalMediaQueries += sheet.mediaQueries.length;
    totalVariables += sheet.cssVariables.length;

    // Collect variable references from each sheet
    if (sheet.variableReferences) {
      for (const ref of sheet.variableReferences) {
        allVariableReferences.push(ref as CSSVariableReference);
      }
    }
  }

  // --- @property declarations (CSSPropertyRule) ---
  const registeredProperties = await scrapeRegisteredProperties(page);

  return {
    stylesheets: stylesheets as StylesheetData[],
    totalRules,
    totalKeyframes,
    totalMediaQueries,
    totalVariables,
    variableReferences: allVariableReferences,
    registeredProperties,
  };
}

// ---------------------------------------------------------------------------
// CSS @property declarations
// ---------------------------------------------------------------------------

/**
 * Iterate every accessible stylesheet rule and capture `@property` declarations.
 * `CSSRule.type === 7` is the legacy numeric type for `CSSPropertyRule`; we also
 * fall back to `cssText.startsWith('@property')` for engines that don't expose
 * that constant.
 */
async function scrapeRegisteredProperties(page: Page): Promise<RegisteredProperty[]> {
  return page.evaluate(() => {
    const collected: Array<{
      name: string;
      syntax: string;
      inherits: boolean;
      initialValue: string;
      sourceStylesheet: string | null;
    }> = [];

    const PROPERTY_RULE_TYPE = 7;

    const parseFromCssText = (
      cssText: string,
      sourceStylesheet: string | null,
    ): void => {
      // @property --name { syntax: ...; inherits: ...; initial-value: ...; }
      const match = cssText.match(/@property\s+(--[a-zA-Z0-9_-]+)\s*\{([^}]*)\}/);
      if (!match) return;
      const name = match[1];
      const body = match[2];
      let syntax = '';
      let inherits = false;
      let initialValue = '';
      for (const decl of body.split(';')) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx === -1) continue;
        const prop = decl.slice(0, colonIdx).trim().toLowerCase();
        const value = decl.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (prop === 'syntax') syntax = value;
        else if (prop === 'inherits') inherits = value === 'true';
        else if (prop === 'initial-value') initialValue = value;
      }
      collected.push({ name, syntax, inherits, initialValue, sourceStylesheet });
    };

    try {
      for (const sheet of Array.from(document.styleSheets)) {
        const sourceUrl = sheet.href ?? null;
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          // CSSPropertyRule may be exposed via name on Chromium; check duck-typed shape too.
          const ruleType = (rule as CSSRule).type;
          const cssText = rule.cssText ?? '';
          const isPropertyRule =
            ruleType === PROPERTY_RULE_TYPE ||
            cssText.startsWith('@property');
          if (!isPropertyRule) continue;

          const propertyRule = rule as CSSRule & {
            name?: string;
            syntax?: string;
            inherits?: boolean;
            initialValue?: string;
          };

          if (typeof propertyRule.name === 'string' && typeof propertyRule.syntax === 'string') {
            collected.push({
              name: propertyRule.name,
              syntax: propertyRule.syntax,
              inherits: !!propertyRule.inherits,
              initialValue: propertyRule.initialValue ?? '',
              sourceStylesheet: sourceUrl,
            });
          } else {
            parseFromCssText(cssText, sourceUrl);
          }
        }
      }
    } catch {
      /* ignore */
    }

    // Deduplicate by name; later declarations win.
    const byName = new Map<string, typeof collected[number]>();
    for (const entry of collected) {
      byName.set(entry.name, entry);
    }
    return Array.from(byName.values());
  });
}

// ---------------------------------------------------------------------------
// CSS-in-JS extraction (Item 2.2)
// ---------------------------------------------------------------------------

const CSS_RULE_RE = /([^{}]+)\{([^}]+)\}/g;

function parseCssTextToRules(
  cssText: string,
): CSSRuleData[] {
  const rules: CSSRuleData[] = [];
  let match: RegExpExecArray | null;
  CSS_RULE_RE.lastIndex = 0;

  while ((match = CSS_RULE_RE.exec(cssText)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();

    // Skip keyframe inner rules and at-rules
    if (
      selector.startsWith('@') ||
      selector.includes('%') ||
      selector === 'from' ||
      selector === 'to'
    ) {
      continue;
    }

    const properties: Record<string, string> = {};
    for (const decl of body.split(';')) {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = decl.slice(0, colonIdx).trim();
      const val = decl.slice(colonIdx + 1).trim();
      if (prop && val) {
        properties[prop] = val;
      }
    }

    if (Object.keys(properties).length > 0) {
      rules.push({ selector, properties });
    }
  }

  return rules;
}

/**
 * Detect and extract CSS-in-JS styles from runtime-injected `<style>` elements
 * (styled-components, Emotion, and generic runtime styles).
 */
async function extractCSSinJS(page: Page): Promise<StylesheetData[]> {
  const rawResults = await page.evaluate(() => {
    const results: Array<{ type: string; css: string }> = [];

    // Styled-components
    document.querySelectorAll('style[data-styled]').forEach((el) => {
      results.push({ type: 'styled-components', css: el.textContent || '' });
    });

    // Emotion
    document.querySelectorAll('style[data-emotion]').forEach((el) => {
      results.push({ type: 'emotion', css: el.textContent || '' });
    });

    // Generic runtime-injected styles (no href, not already captured above)
    const capturedCss = new Set(results.map((r) => r.css));
    document
      .querySelectorAll('style:not([data-styled]):not([data-emotion])')
      .forEach((el) => {
        const text = el.textContent;
        if (text && text.length > 10 && !capturedCss.has(text)) {
          // Exclude styles that are likely from build tools (Tailwind, etc.)
          // by checking for runtime-style markers
          const hasRuntimeMarker =
            !el.hasAttribute('data-precedence') && // Next.js built-in
            !el.hasAttribute('data-next-font');
          if (hasRuntimeMarker) {
            results.push({ type: 'runtime', css: text });
            capturedCss.add(text);
          }
        }
      });

    return results;
  });

  // Parse each CSS-in-JS source into StylesheetData
  const sheets: StylesheetData[] = [];
  for (const entry of rawResults) {
    const rules = parseCssTextToRules(entry.css);
    if (rules.length > 0) {
      // Extract CSS variables from rules
      const cssVariables: CSSVariableData[] = [];
      for (const rule of rules) {
        for (const [prop, val] of Object.entries(rule.properties)) {
          if (prop.startsWith('--')) {
            cssVariables.push({
              name: prop,
              value: val,
              scope: rule.selector,
            });
          }
        }
      }

      sheets.push({
        url: null, // CSS-in-JS has no URL
        rules,
        mediaQueries: [],
        keyframes: [],
        cssVariables,
      });
    }
  }

  return sheets;
}
