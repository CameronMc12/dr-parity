/**
 * Builds a per-section CSS string from an ElementSpec tree. Used inside the
 * scoped `<style>` block of each .astro component (Astro auto-scopes these
 * to the component).
 *
 * Rules:
 *  - No raw hex / rgb colors. Anything resolvable goes to `var(--token)`,
 *    unknown colors fall back to `var(--dark)`.
 *  - No box-shadow on cards unless explicitly extracted.
 *  - No gradients unless explicitly extracted.
 */

import type { ElementSpec, SectionSpec } from '../../types/extraction';
import type { DesignTokens } from '../../types/component';

const ALLOWED_PROPS = new Set([
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
  'color', 'background-color',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'opacity', 'overflow', 'overflow-x', 'overflow-y',
  'z-index', 'cursor',
]);

export function buildSectionCss(section: SectionSpec, tokens: DesignTokens): string {
  const colorMap = buildColorVarMap(tokens);
  const blocks: string[] = [];
  const seen = new Set<string>();
  walk(section.elements, section.className || section.id, colorMap, blocks, seen);
  return blocks.join('\n');
}

function walk(
  elements: ElementSpec[],
  sectionClass: string,
  colorMap: Map<string, string>,
  out: string[],
  seen: Set<string>,
): void {
  for (const el of elements) {
    const classes = el.classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
    const selector = classes.length > 0
      ? `.${classes[0]}`
      : `.${sectionClass || 'section'} ${el.tag.toLowerCase()}`;

    if (!seen.has(selector)) {
      seen.add(selector);
      const decls = renderDeclarations(el.computedStyles, colorMap);
      if (decls.length > 0) {
        out.push(`${selector} {`);
        for (const d of decls) out.push(`  ${d}`);
        out.push('}');
      }
    }
    if (el.children.length > 0) walk(el.children, sectionClass, colorMap, out, seen);
  }
}

function renderDeclarations(styles: Record<string, string>, colorMap: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [prop, rawValue] of Object.entries(styles)) {
    const kebab = camelToKebab(prop);

    if (kebab === 'background-image' || kebab === 'background') {
      if (/gradient\(/i.test(rawValue)) {
        out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)};`);
      }
      continue;
    }

    if (kebab === 'box-shadow') {
      if (rawValue && rawValue !== 'none') {
        out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)};`);
      }
      continue;
    }

    if (!ALLOWED_PROPS.has(kebab)) continue;
    if (!rawValue) continue;
    if (rawValue === 'normal') continue;
    if (rawValue === 'auto' && kebab !== 'margin') continue;

    out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)};`);
  }
  return out;
}

function rewriteColors(value: string, colorMap: Map<string, string>): string {
  return value.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)/gi, (match) => {
    const normalized = normalizeColor(match);
    const token = colorMap.get(normalized);
    return token ? `var(${token})` : 'var(--dark)';
  });
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function buildColorVarMap(tokens: DesignTokens): Map<string, string> {
  const map = new Map<string, string>();
  const aliasPairs: Array<[string, string | undefined]> = [
    ['--paper', tokens.colors.background.value],
    ['--dark', tokens.colors.foreground.value],
    ['--primary', tokens.colors.primary.value],
    ['--muted', tokens.colors.muted.value],
    ['--border', tokens.colors.border.value],
    ['--accent', tokens.colors.accent?.value],
    ['--secondary', tokens.colors.secondary?.value],
  ];
  for (const [name, value] of aliasPairs) {
    if (value) map.set(normalizeColor(value), name);
  }
  for (const [name, value] of Object.entries(tokens.cssVariables)) {
    if (typeof value === 'string') map.set(normalizeColor(value), name);
  }
  return map;
}

function camelToKebab(prop: string): string {
  return prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
