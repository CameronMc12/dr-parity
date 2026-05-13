/**
 * Emits an Astro .astro file for a static section.
 *
 * Format:
 *   ---
 *   // frontmatter (data imports etc.) — currently empty
 *   ---
 *   <section class="...">
 *     ...html...
 *   </section>
 *   <style>
 *     // scoped CSS from section computed styles
 *   </style>
 */

import type { SectionSpec } from '../../types/extraction';
import type { DesignTokens } from '../../types/component';
import { elementToHtml } from './element-html';
import { buildSectionCss } from './section-css';

export interface AstroSectionResult {
  /** Filename relative to src/components/sections/, e.g. `Hero.astro`. */
  filename: string;
  /** PascalCase component name, e.g. `Hero`. */
  componentName: string;
  contents: string;
}

export function buildAstroSection(
  section: SectionSpec,
  tokens: DesignTokens,
): AstroSectionResult {
  const componentName = pascalCase(section.name);
  const sectionClass = section.className || slugify(section.name);

  const childHtml = section.elements
    .map((el) => elementToHtml(el, { classPrefix: sectionClass }))
    .filter(Boolean)
    .join('\n  ');

  const css = buildSectionCss(section, tokens);
  const animAttr = ` data-anim="${escapeAttr(section.id)}"`;

  const lines: string[] = [
    '---',
    `// ${componentName}.astro — static section, zero JS shipped.`,
    '---',
    `<section class="${escapeAttr(sectionClass)}"${animAttr}>`,
    childHtml ? `  ${childHtml}` : '  <!-- empty section -->',
    '</section>',
    '',
    '<style>',
    css || `/* no extracted styles for ${sectionClass} */`,
    '</style>',
    '',
  ];

  return {
    filename: `${componentName}.astro`,
    componentName,
    contents: lines.join('\n'),
  };
}

function pascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') || 'Section';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}
