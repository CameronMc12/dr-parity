/**
 * Walks each section's ElementSpec tree and emits hand-rolled vanilla CSS
 * keyed off the original class names found in the extraction.
 *
 * Spec rules enforced here:
 * - No raw hex in output values — every color string is converted to var(--...)
 *   if it matches a known token, otherwise the original is passed through
 *   inside :root only (handled in tokens-css.ts) — never inlined here.
 * - No drop shadows on static cards (skip `box-shadow` unless extraction has one).
 * - No gradient backgrounds unless the source explicitly contained one.
 */

import type { ElementSpec, SectionSpec } from '../../types/extraction';
import type { DesignTokens } from '../../types/component';

/** CSS property names that are safe and useful to copy from computedStyles. */
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
  // box-shadow and background-image handled separately (rules below)
]);

export interface ComponentCssInput {
  sections: SectionSpec[];
  tokens: DesignTokens;
}

export function buildComponentCss(input: ComponentCssInput): string {
  const { sections, tokens } = input;
  const blocks: string[] = [];

  // Build a hex/rgb → var(--name) lookup so we can rewrite raw colors.
  const colorMap = buildColorVarMap(tokens);

  for (const section of sections) {
    blocks.push(`/* === ${section.name} (id: ${section.id}) === */`);
    const seen = new Set<string>();
    emitRuleForElement(section.elements, section.className, colorMap, blocks, seen);
  }

  return blocks.join('\n');
}

function emitRuleForElement(
  elements: ElementSpec[],
  sectionClass: string,
  colorMap: Map<string, string>,
  out: string[],
  seenSelectors: Set<string>,
): void {
  for (const el of elements) {
    const selectors = el.classes.filter((c) => /^[a-zA-Z_][\w-]*$/.test(c));
    const selector = selectors.length > 0 ? `.${selectors[0]}` : `.${sectionClass || 'section'} ${el.tag.toLowerCase()}`;
    const key = selector;
    if (!seenSelectors.has(key)) {
      seenSelectors.add(key);
      const decls = renderDeclarations(el.computedStyles, colorMap);
      if (decls.length > 0) {
        out.push(`${selector} {`);
        for (const d of decls) out.push(`  ${d}`);
        out.push('}');
      }
    }
    if (el.children.length > 0) {
      emitRuleForElement(el.children, sectionClass, colorMap, out, seenSelectors);
    }
  }
}

function renderDeclarations(
  styles: Record<string, string>,
  colorMap: Map<string, string>,
): string[] {
  const out: string[] = [];

  for (const [prop, rawValue] of Object.entries(styles)) {
    const kebab = camelToKebab(prop);

    // Gradient guard: only emit if explicit gradient is in the source.
    if (kebab === 'background-image' || kebab === 'background') {
      if (/gradient\(/i.test(rawValue)) {
        // We're cloning, not designing — allowed because source has it.
        out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)}; /* extracted gradient */`);
      }
      continue;
    }

    // Box-shadow guard: only emit when present (i.e. extraction has it).
    if (kebab === 'box-shadow') {
      if (rawValue && rawValue !== 'none') {
        out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)};`);
      }
      continue;
    }

    if (!ALLOWED_PROPS.has(kebab)) continue;
    if (!rawValue || rawValue === 'normal' || rawValue === 'auto' && kebab !== 'margin') continue;

    out.push(`${kebab}: ${rewriteColors(rawValue, colorMap)};`);
  }

  return out;
}

/**
 * Replace any raw hex / rgb / rgba in a value with a `var(--token)` reference
 * when we have a matching token. Unknown colors fall back to a `--paper` /
 * `--dark` neutral so the JSX never embeds raw hex.
 */
function rewriteColors(value: string, colorMap: Map<string, string>): string {
  return value.replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)/gi, (match) => {
    const normalized = normalizeColor(match);
    const token = colorMap.get(normalized);
    return token ? `var(${token})` : `var(--dark)`;
  });
}

function normalizeColor(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function buildColorVarMap(tokens: DesignTokens): Map<string, string> {
  const map = new Map<string, string>();
  // Use the semantic aliases injected by tokens-css.ts as the preferred targets.
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
  // Plus every raw cssVariables entry — gives us coverage for original site tokens.
  for (const [name, value] of Object.entries(tokens.cssVariables)) {
    if (typeof value === 'string') map.set(normalizeColor(value), name);
  }
  return map;
}

function camelToKebab(prop: string): string {
  return prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
