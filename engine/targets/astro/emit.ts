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
  const safeHtml = applyIsInlineToComponentHtml(comp.html);
  const normalised = stripTrailingFrontmatter(safeHtml);
  const content = normalised.endsWith('\n') ? normalised : normalised + '\n';
  const bytes = writeText(filePath, content);
  return { name: comp.name, bytes };
}

/**
 * Components may have an Astro frontmatter fence (`---` ... `---`) at the top,
 * for example Main carries its child imports. We must only post-process the
 * HTML body that follows the closing fence; the frontmatter is TypeScript.
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

/**
 * Guard against a stray `---` at the end of the component body. Astro treats a
 * second fence after the JSX as a syntax error, so we strip any trailing fence
 * (with optional surrounding whitespace) before writing.
 */
function stripTrailingFrontmatter(html: string): string {
  return html.replace(/\s*\n---\s*$/, '\n');
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
