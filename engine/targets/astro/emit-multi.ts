/**
 * Multi-page Astro emitter.
 *
 * Given N parsed page slices (one per crawled URL), this:
 *   1. Identifies shared components (Header, Footer, etc.) by fingerprint
 *   2. Writes shared components ONCE to src/components/shared/
 *   3. Writes per-page sections to src/components/<route>/
 *   4. Writes one src/pages/<route>.astro per page, importing shared + own
 *
 * Shared component detection uses simple structural equality on the rendered
 * HTML of the component. Two components are "the same" if their normalised
 * HTML (with whitespace collapsed) matches exactly. This is conservative —
 * a real shared layout will produce identical HTML across pages.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { injectIsInline } from './is-inline';
import type { ComponentDef, ExtractedHead } from './types';

export interface PageSlice {
  /** URL pathname, e.g. "/", "/about", "/services/design" */
  route: string;
  /** Astro page filename (no ext), e.g. "index", "about", "services-design" */
  pageName: string;
  head: ExtractedHead;
  components: ComponentDef[];
  pageImports: string[];
}

export interface MultiEmitOptions {
  outDir: string;
  pages: PageSlice[];
}

export interface MultiEmitSummary {
  sharedComponents: string[];
  perPageComponents: number;
  pagesWritten: string[];
}

const SHAREABLE_ROLES = new Set<ComponentDef['role']>([
  'header',
  'footer',
  'preamble',
  'postamble',
  'interstitial',
  'post-main',
]);

export function emitMultiPage(opts: MultiEmitOptions): MultiEmitSummary {
  const { outDir, pages } = opts;
  if (pages.length === 0) {
    throw new Error('emitMultiPage: no pages provided');
  }

  const layoutsDir = join(outDir, 'src', 'layouts');
  const sharedDir = join(outDir, 'src', 'components', 'shared');
  const pagesDir = join(outDir, 'src', 'pages');

  // Layout: use the first (homepage) head as canonical.
  writeLayout(layoutsDir, pages[0].head);

  // Find shareable components: any component whose normalised HTML
  // appears on 2+ pages AND whose role is in SHAREABLE_ROLES.
  const fingerprint = (c: ComponentDef): string =>
    createHash('sha1').update(normaliseHtml(c.html)).digest('hex');

  type SharedEntry = {
    canonicalName: string;
    html: string;
    occurrenceCount: number;
    pages: Set<string>;
    role: ComponentDef['role'];
  };
  const sharedByFingerprint = new Map<string, SharedEntry>();

  for (const page of pages) {
    for (const comp of page.components) {
      if (!SHAREABLE_ROLES.has(comp.role)) continue;
      const fp = fingerprint(comp);
      const existing = sharedByFingerprint.get(fp);
      if (existing) {
        existing.occurrenceCount += 1;
        existing.pages.add(page.route);
      } else {
        sharedByFingerprint.set(fp, {
          canonicalName: comp.name,
          html: comp.html,
          occurrenceCount: 1,
          pages: new Set([page.route]),
          role: comp.role,
        });
      }
    }
  }

  // Keep only fingerprints present on 2+ pages.
  const sharedFingerprints = new Map<string, SharedEntry>();
  for (const [fp, entry] of sharedByFingerprint) {
    if (entry.occurrenceCount >= 2) {
      sharedFingerprints.set(fp, entry);
    }
  }

  // Write shared components. SHAREABLE_ROLES excludes 'main', so shared
  // entries are always leaf components (no wrapper / childComponentNames).
  // Build a minimal ComponentDef from the SharedEntry and pass through the
  // unified writer.
  const sharedNames: string[] = [];
  for (const entry of sharedFingerprints.values()) {
    writeComponentFile(sharedDir, {
      name: entry.canonicalName,
      role: entry.role,
      html: entry.html,
    });
    sharedNames.push(entry.canonicalName);
  }

  // For each page: write per-page components (skipping shared ones) and the page file.
  let perPageCount = 0;
  const pagesWritten: string[] = [];

  for (const page of pages) {
    const pageComponentsDir = join(outDir, 'src', 'components', page.pageName);

    const sharedForPage = new Set<string>();
    const ownComponents: ComponentDef[] = [];

    for (const comp of page.components) {
      const fp = fingerprint(comp);
      if (sharedFingerprints.has(fp)) {
        sharedForPage.add(sharedFingerprints.get(fp)!.canonicalName);
      } else {
        ownComponents.push(comp);
      }
    }

    // Write non-shared components to per-page folder.
    for (const comp of ownComponents) {
      writeComponentFile(pageComponentsDir, comp);
      perPageCount += 1;
    }

    // Resolve final import order using pageImports, mapping shared names where applicable.
    const finalImports: { name: string; from: 'shared' | 'page' }[] = [];
    for (const importName of page.pageImports) {
      const matched = page.components.find((c) => c.name === importName);
      if (!matched) continue;
      const fp = fingerprint(matched);
      if (sharedFingerprints.has(fp)) {
        finalImports.push({ name: sharedFingerprints.get(fp)!.canonicalName, from: 'shared' });
      } else {
        finalImports.push({ name: importName, from: 'page' });
      }
    }

    writePageFile({
      pagesDir,
      pageName: page.pageName,
      imports: finalImports,
      title: page.head.title,
      description: page.head.description,
    });
    pagesWritten.push(page.pageName);
  }

  return {
    sharedComponents: sharedNames,
    perPageComponents: perPageCount,
    pagesWritten,
  };
}

function normaliseHtml(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeComponentFile(componentsDir: string, comp: ComponentDef): void {
  const filePath = join(componentsDir, `${comp.name}.astro`);
  const source = isCompositionComponent(comp)
    ? renderCompositionAstro(comp)
    : comp.html;
  const safeHtml = applyIsInlineToComponentHtml(source);
  const content = safeHtml.endsWith('\n') ? safeHtml : safeHtml + '\n';
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

function isCompositionComponent(comp: ComponentDef): boolean {
  return comp.wrapper !== undefined && comp.childComponentNames !== undefined;
}

function renderCompositionAstro(comp: ComponentDef): string {
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

function applyIsInlineToComponentHtml(html: string): string {
  if (!html.startsWith('---')) return injectIsInline(html);
  const closing = html.indexOf('\n---', 3);
  if (closing === -1) return injectIsInline(html);
  const fenceEnd = closing + '\n---'.length;
  const frontmatter = html.slice(0, fenceEnd);
  const rest = html.slice(fenceEnd);
  return frontmatter + injectIsInline(rest);
}

function writeLayout(layoutsDir: string, head: ExtractedHead): void {
  const filePath = join(layoutsDir, 'SiteLayout.astro');
  const frontmatter = [
    '---',
    "const { title, description } = Astro.props as { title?: string; description?: string };",
    '---',
  ].join('\n');

  const headBlock = injectIsInline(head.innerHTML);
  const titleOverride = '{title ? <title>{title}</title> : null}';
  const descOverride =
    '{description ? <meta name="description" content={description} /> : null}';

  const content = [
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

  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

function escapeForTsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface WritePageArgs {
  pagesDir: string;
  pageName: string;
  imports: { name: string; from: 'shared' | 'page' }[];
  title: string;
  description: string;
}

function writePageFile(args: WritePageArgs): void {
  const { pagesDir, pageName, imports, title, description } = args;
  const filePath = join(pagesDir, `${pageName}.astro`);

  const importLines = [
    "import SiteLayout from '../layouts/SiteLayout.astro';",
    ...imports.map((imp) =>
      imp.from === 'shared'
        ? `import ${imp.name} from '../components/shared/${imp.name}.astro';`
        : `import ${imp.name} from '../components/${pageName}/${imp.name}.astro';`,
    ),
  ].join('\n');

  const titleLine =
    title.length > 0
      ? `const title = '${escapeForTsString(title)}';`
      : `const title = '';`;
  const descLine =
    description.length > 0
      ? `const description = '${escapeForTsString(description)}';`
      : `const description = '';`;

  const bodyTags = imports.map((imp) => `  <${imp.name} />`).join('\n');

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

  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Convert a URL pathname to a flat Astro page name.
 *   "/"                  -> "index"
 *   "/about"             -> "about"
 *   "/services/design"   -> "services-design"
 *   "/blog/post-1"       -> "blog-post-1"
 */
export function routeToPageName(pathname: string): string {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (clean.length === 0) return 'index';
  return clean
    .split('/')
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-'),
    )
    .filter(Boolean)
    .join('-');
}
