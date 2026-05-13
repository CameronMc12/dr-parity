/**
 * One view-<section>.jsx file per top-level section.
 */

import type { SectionSpec } from '../../types/extraction';
import { elementToJsx } from './jsx-from-elementspec';

export interface ViewEmitterResult {
  /** Filename relative to the output dir, e.g. `view-hero.jsx`. */
  filename: string;
  /** Component name, e.g. `Hero`. */
  componentName: string;
  /** Section slug used as the view key in app.jsx state, e.g. `hero`. */
  slug: string;
  contents: string;
}

export function buildViewJsx(section: SectionSpec): ViewEmitterResult {
  const componentName = pascalCase(section.name);
  const slug = slugify(section.name);

  const childJsx = section.elements
    .map((el) => elementToJsx(el, { classPrefix: section.className || slug }))
    .filter(Boolean)
    .join('\n      ');

  const lines: string[] = [
    `/* view-${slug}.jsx */`,
    `function ${componentName}({ data }) {`,
    '  const safeData = data || {};',
    '  return (',
    `    <section className=${JSON.stringify(section.className || slug)}>`,
    childJsx || `      <h1>{safeData.title || ${JSON.stringify(componentName)}}</h1>`,
    '    </section>',
    '  );',
    '}',
    `Object.assign(window, { ${componentName} });`,
    '',
  ];

  return {
    filename: `view-${slug}.jsx`,
    componentName,
    slug,
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
