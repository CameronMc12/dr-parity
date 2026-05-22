/**
 * Write .astro component files and the page/layout pair.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { injectIsInline } from './is-inline';
import type { ComponentDef, ExtractedHead } from './types';

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(filePath: string, content: string): number {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

function escapeForTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function writeComponent(componentsDir: string, comp: ComponentDef): { name: string; bytes: number } {
  const filePath = join(componentsDir, `${comp.name}.astro`);
  const source = isCompositionComponent(comp)
    ? renderCompositionAstro(comp)
    : comp.html;
  const safeHtml = applyIsInlineToComponentHtml(source);
  const content = safeHtml.endsWith('\n') ? safeHtml : safeHtml + '\n';
  const bytes = writeText(filePath, content);
  return { name: comp.name, bytes };
}

/**
 * A component is a composition wrapper when the shared slicer set its
 * `wrapper` + `childComponentNames`. Such a component renders as:
 *   ---
 *   import Child from './Child.astro';
 *   ---
 *   <wrapper>
 *     <Child />
 *   </wrapper>
 */
function isCompositionComponent(comp: ComponentDef): boolean {
  return comp.wrapper !== undefined && comp.childComponentNames !== undefined;
}

function renderCompositionAstro(comp: ComponentDef): string {
  // wrapper is guaranteed non-null here by isCompositionComponent.
  const wrapper = comp.wrapper as { openTag: string; closeTag: string };
  const children = comp.childComponentNames ?? [];
  const importLines = children
    .map((n) => `import ${n} from './${n}.astro';`)
    .join('\n');
  const composed = children.map((token) => `  <${token} />`).join('\n');
  const body =
    composed.length > 0
      ? `${wrapper.openTag}\n${composed}\n${wrapper.closeTag}`
      : `${wrapper.openTag}${wrapper.closeTag}`;
  return ['---', importLines, '---', body].join('\n');
}

/**
 * Composition components carry an Astro frontmatter fence (`---` ... `---`)
 * at the top — we must only post-process the HTML body that follows the
 * closing fence; the frontmatter is TypeScript. Leaf components have no
 * frontmatter and pass straight through.
 */
function applyIsInlineToComponentHtml(html: string): string {
  if (!html.startsWith('---')) return injectIsInline(html);
  const closing = html.indexOf('\n---', 3);
  if (closing === -1) return injectIsInline(html);
  const fenceEnd = closing + '\n---'.length;
  const frontmatter = html.slice(0, fenceEnd);
  const rest = html.slice(fenceEnd);
  return frontmatter + injectIsInline(rest);
}

export function writeLayout(layoutsDir: string, head: ExtractedHead): { name: string; bytes: number } {
  const filePath = join(layoutsDir, 'SiteLayout.astro');
  const frontmatter = [
    '---',
    "const { title, description } = Astro.props as { title?: string; description?: string };",
    '---',
  ].join('\n');

  const headBlock = injectIsInline(head.innerHTML);
  const titleOverride = '{title ? <title>{title}</title> : null}';
  const descOverride = '{description ? <meta name="description" content={description} /> : null}';

  const html = [
    frontmatter,
    '<!doctype html>',
    `<html${head.htmlAttrs}>`,
    '  <head>',
    headBlock,
    `    ${titleOverride}`,
    `    ${descOverride}`,
    '  </head>',
    `  <body${head.bodyAttrs}>`,
    '    <slot />',
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  const bytes = writeText(filePath, html);
  return { name: 'SiteLayout', bytes };
}

export function writePage(args: {
  pagesDir: string;
  pageImports: string[];
  title: string;
  description: string;
}): { name: string; bytes: number } {
  const { pagesDir, pageImports, title, description } = args;
  const filePath = join(pagesDir, 'index.astro');

  const importLines = [
    "import SiteLayout from '../layouts/SiteLayout.astro';",
    ...pageImports.map((name) => `import ${name} from '../components/${name}.astro';`),
  ].join('\n');

  const titleLine = title.length > 0 ? `const title = '${escapeForTsString(title)}';` : `const title = '';`;
  const descLine =
    description.length > 0
      ? `const description = '${escapeForTsString(description)}';`
      : `const description = '';`;

  const bodyTags = pageImports.map((n) => `  <${n} />`).join('\n');

  const content = [
    '---',
    importLines,
    titleLine,
    descLine,
    '---',
    '<SiteLayout title={title} description={description}>',
    bodyTags,
    '</SiteLayout>',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'index', bytes };
}
