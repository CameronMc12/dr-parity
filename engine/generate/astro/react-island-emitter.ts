/**
 * Emits a React .tsx island for a section flagged isClient.
 *
 * Astro handles the "use client" boundary via the `client:visible` directive
 * at the call site, so no directive is needed at the top of this file.
 *
 * The island's CSS is moved into a sibling `<style is:global>` or, simpler:
 * we co-locate per-island CSS in the same .tsx via a `<style>` element. To
 * keep things clean and predictable, we instead emit the section's CSS into
 * the .astro page that mounts the island, scoped to the island's root class.
 *
 * For now the island is a presentational React tree — interactivity is up to
 * a future pass that consumes BehaviorModel.clickHandlers.
 */

import type { SectionSpec } from '../../types/extraction';
import { elementToJsx } from './element-jsx';

export interface ReactIslandResult {
  /** Filename relative to src/components/islands/, e.g. `ContactForm.tsx`. */
  filename: string;
  /** PascalCase component name, e.g. `ContactForm`. */
  componentName: string;
  contents: string;
}

export function buildReactIsland(section: SectionSpec): ReactIslandResult {
  const componentName = pascalCase(section.name);
  const sectionClass = section.className || slugify(section.name);

  const childJsx = section.elements
    .map((el) => elementToJsx(el, { classPrefix: sectionClass }))
    .filter(Boolean)
    .join('\n      ');

  const lines: string[] = [
    `// ${componentName}.tsx — React island for an interactive section.`,
    "// Mounted via `client:visible` from the page that imports it.",
    "import { useState } from 'react';",
    '',
    `export default function ${componentName}(): JSX.Element {`,
    '  const [active, setActive] = useState(false);',
    `  return (`,
    `    <section className=${JSON.stringify(sectionClass)} data-anim=${JSON.stringify(section.id)} data-active={active ? 'true' : 'false'}>`,
    `      ${childJsx || '<span />'}`,
    `      <button type="button" onClick={() => setActive((v) => !v)} aria-pressed={active}>`,
    "        {active ? 'Active' : 'Idle'}",
    '      </button>',
    '    </section>',
    '  );',
    '}',
    '',
  ];

  return {
    filename: `${componentName}.tsx`,
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
    .join('') || 'Island';
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'island';
}
