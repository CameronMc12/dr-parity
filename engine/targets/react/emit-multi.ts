/**
 * Multi-page React emitter.
 *
 * Mirrors engine/targets/astro/emit-multi.ts. Given N parsed page slices
 * (one per crawled URL), this:
 *
 *   1. Fingerprints every component by sha1 of normalised HTML.
 *   2. Writes shareable components (header/footer/preamble/postamble/
 *      interstitial/post-main) appearing on 2+ pages ONCE to
 *      src/components/shared/<Name>.tsx.
 *   3. Writes per-page sections to src/components/<pageName>/<Name>.tsx.
 *   4. Emits one src/pages/<PageName>Page.tsx per page composing
 *      shared + own components.
 *   5. Emits one src/entries/<pageName>.tsx per page that mounts the page
 *      into #root and runs runPostHydrationSync.
 *   6. Emits one <outDir>/<pageName>.html per page with the captured head
 *      and a <script type="module" src="/src/entries/<pageName>.tsx">.
 *
 * Parity guarantees (do NOT touch):
 *   - Per-page heads are byte-preserved; no cross-page dedupe.
 *   - Per-page captured body scripts are hoisted into that page's HTML.
 *   - Per-page extra stylesheet hrefs are appended to that page's HTML.
 *   - Cross-page links use full reloads (plain <a href>), not SPA nav,
 *     because each <pageName>.html is a real Vite entry.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Element } from 'domhandler';

import type { ComponentDef, ExtractedHead } from '../shared/types';
import { reactEscapeHatchPredicate } from './escape-hatch-predicates';
import { htmlToJsx } from './html-to-jsx';

export interface ReactPageSlice {
  /** URL pathname, e.g. "/", "/about", "/services/design". */
  route: string;
  /** Flat page name (no ext), e.g. "index", "about", "services-design". */
  pageName: string;
  head: ExtractedHead;
  components: ComponentDef[];
  pageImports: string[];
  /** Extra stylesheet hrefs to append into this page's <head>. */
  extraStylesheetHrefs: string[];
  /** Already-rendered <script> strings to splice into this page's <body>. */
  hoistedBodyScripts: string[];
}

export interface MultiEmitOptions {
  outDir: string;
  pages: ReactPageSlice[];
}

export interface MultiEmitSummary {
  sharedComponents: string[];
  perPageComponents: number;
  pagesWritten: string[];
  entryFiles: string[];
}

const SHAREABLE_ROLES = new Set<ComponentDef['role']>([
  'header',
  'footer',
  'preamble',
  'postamble',
  'interstitial',
  'post-main',
]);

export function emitMultiPageReact(opts: MultiEmitOptions): MultiEmitSummary {
  const { outDir, pages } = opts;
  if (pages.length === 0) {
    throw new Error('emitMultiPageReact: no pages provided');
  }

  const sharedDir = join(outDir, 'src', 'components', 'shared');
  const pagesDir = join(outDir, 'src', 'pages');
  const entriesDir = join(outDir, 'src', 'entries');

  const fingerprint = (c: ComponentDef): string =>
    createHash('sha1').update(normaliseHtml(c.html)).digest('hex');

  interface SharedEntry {
    canonicalName: string;
    component: ComponentDef;
    occurrenceCount: number;
    pages: Set<string>;
  }
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
          component: comp,
          occurrenceCount: 1,
          pages: new Set([page.route]),
        });
      }
    }
  }

  const sharedFingerprints = new Map<string, SharedEntry>();
  for (const [fp, entry] of sharedByFingerprint) {
    if (entry.occurrenceCount >= 2) {
      sharedFingerprints.set(fp, entry);
    }
  }

  // Seal off subtrees that third-party runtime scripts mutate after
  // hydration (e.g. Apple's ac-gallery carousel). Without this, React's
  // StrictMode dev double-render wipes the runtime-applied classNames
  // and inline styles, freezing the carousel on slide 1. Capability-
  // detected via the `data-media-gallery` attribute; sites that do not
  // carry that marker fall through unchanged.
  const escapeHatch = reactEscapeHatchPredicate;

  // Write shared components. SHAREABLE_ROLES excludes 'main', so shared
  // entries are always leaf components (no wrapper / childComponentNames).
  const sharedNames: string[] = [];
  for (const entry of sharedFingerprints.values()) {
    writeReactComponentFile(
      sharedDir,
      {
        ...entry.component,
        name: entry.canonicalName,
      },
      escapeHatch,
    );
    sharedNames.push(entry.canonicalName);
  }

  let perPageCount = 0;
  const pagesWritten: string[] = [];
  const entryFiles: string[] = [];

  for (const page of pages) {
    const pageComponentsDir = join(outDir, 'src', 'components', page.pageName);

    const ownComponents: ComponentDef[] = [];

    for (const comp of page.components) {
      const fp = fingerprint(comp);
      if (sharedFingerprints.has(fp)) {
        continue;
      }
      ownComponents.push(comp);
    }

    for (const comp of ownComponents) {
      writeReactComponentFile(pageComponentsDir, comp, escapeHatch);
      perPageCount += 1;
    }

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
    });
    writeEntryFile({ entriesDir, pageName: page.pageName });
    writePageHtmlFile({
      outDir,
      pageName: page.pageName,
      head: page.head,
      extraStylesheetHrefs: page.extraStylesheetHrefs,
      hoistedBodyScripts: page.hoistedBodyScripts,
    });

    pagesWritten.push(page.pageName);
    entryFiles.push(page.pageName);
  }

  return {
    sharedComponents: sharedNames,
    perPageComponents: perPageCount,
    pagesWritten,
    entryFiles,
  };
}

function normaliseHtml(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

function wrapInFragment(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return '<></>';
  return `<>\n${trimmed}\n</>`;
}

function isCompositionComponent(comp: ComponentDef): boolean {
  return comp.wrapper !== undefined && comp.childComponentNames !== undefined;
}

// Placeholder for child composition during the JSX attribute-normalisation
// pass. Mirrors the same constant in emit.ts; kept local to avoid creating
// a cross-file dependency for an internal implementation detail.
const CHILDREN_PLACEHOLDER = 'W1C_WRAPPER_CHILDREN_PLACEHOLDER';

/**
 * Build the wrapper body. We splice a placeholder inside the captured
 * open/close tags and run the whole thing through `htmlToJsx` so wrapper
 * attributes pick up the same normalisation leaf components get (e.g.
 * `class` → `className`, `for` → `htmlFor`). Then we replace the
 * placeholder with the composed PascalCase child references — those are
 * valid JSX components and never need normalisation.
 */
function renderCompositionReact(
  comp: ComponentDef,
  shouldEscapeHatch?: (el: Element) => boolean,
): { imports: string[]; body: string } {
  const wrapper = comp.wrapper as { openTag: string; closeTag: string };
  const children = comp.childComponentNames ?? [];
  const composed = children.map((n) => `  <${n} />`).join('\n');

  const normalisedShell = htmlToJsx(
    `${wrapper.openTag}${CHILDREN_PLACEHOLDER}${wrapper.closeTag}`,
    { shouldEscapeHatch },
  );
  const replacement = composed.length > 0 ? `\n${composed}\n` : '';
  const body = normalisedShell.replace(CHILDREN_PLACEHOLDER, replacement);
  return { imports: children, body };
}

/**
 * Renders a single React component file. Composition components (e.g. Main
 * with sibling Section child refs) get an ES import per child and the
 * wrapper tags around composed JSX. Leaf components run their captured HTML
 * through htmlToJsx.
 */
function writeReactComponentFile(
  componentsDir: string,
  comp: ComponentDef,
  shouldEscapeHatch?: (el: Element) => boolean,
): void {
  const filePath = join(componentsDir, `${comp.name}.tsx`);

  let imports: string[];
  let body: string;
  if (isCompositionComponent(comp)) {
    const composed = renderCompositionReact(comp, shouldEscapeHatch);
    imports = composed.imports;
    body = composed.body;
  } else {
    imports = [];
    body = htmlToJsx(comp.html, { shouldEscapeHatch });
  }

  const importLines = imports
    .map((n) => `import { ${n} } from './${n}';`)
    .join('\n');

  const wrappedBody = wrapInFragment(body);

  const content = [
    importLines.length > 0 ? importLines : null,
    importLines.length > 0 ? '' : null,
    `export function ${comp.name}() {`,
    '  return (',
    indent(wrappedBody, '    '),
    '  );',
    '}',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

interface WritePageArgs {
  pagesDir: string;
  pageName: string;
  imports: { name: string; from: 'shared' | 'page' }[];
  title: string;
}

function writePageFile(args: WritePageArgs): void {
  const { pagesDir, pageName, imports, title } = args;
  const componentName = `${pascalCasePageName(pageName)}Page`;
  const filePath = join(pagesDir, `${componentName}.tsx`);

  const importLines = imports.map((imp) =>
    imp.from === 'shared'
      ? `import { ${imp.name} } from '../components/shared/${imp.name}';`
      : `import { ${imp.name} } from '../components/${pageName}/${imp.name}';`,
  );
  const bodyTags = imports.map((imp) => `      <${imp.name} />`);

  const content = [
    importLines.join('\n'),
    '',
    `export function ${componentName}() {`,
    '  return (',
    '    <>',
    bodyTags.join('\n'),
    '    </>',
    '  );',
    '}',
    '',
    `${componentName}.displayName = ${JSON.stringify(title || componentName)};`,
    '',
  ].join('\n');

  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

interface WriteEntryArgs {
  entriesDir: string;
  pageName: string;
}

function writeEntryFile(args: WriteEntryArgs): void {
  const { entriesDir, pageName } = args;
  const filePath = join(entriesDir, `${pageName}.tsx`);
  const componentName = `${pascalCasePageName(pageName)}Page`;
  const content = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    `import { ${componentName} } from '../pages/${componentName}';`,
    "import { runPostHydrationSync } from '../lib/post-hydration-sync';",
    "import '../styles/global.css';",
    '',
    "const rootEl = document.getElementById('root');",
    "if (!rootEl) throw new Error('Missing #root element');",
    '',
    'ReactDOM.createRoot(rootEl).render(',
    '  <React.StrictMode>',
    `    <${componentName} />`,
    '  </React.StrictMode>,',
    ');',
    '',
    'runPostHydrationSync();',
    '',
  ].join('\n');
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

interface WritePageHtmlArgs {
  outDir: string;
  pageName: string;
  head: ExtractedHead;
  extraStylesheetHrefs: string[];
  hoistedBodyScripts: string[];
}

function writePageHtmlFile(args: WritePageHtmlArgs): void {
  const { outDir, pageName, head, extraStylesheetHrefs, hoistedBodyScripts } = args;
  const filePath = join(outDir, `${pageName}.html`);

  const extraLinkLines = extraStylesheetHrefs.map(
    (href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`,
  );
  const headBody = [head.innerHTML, ...extraLinkLines]
    .filter((l) => l.length > 0)
    .join('\n');

  const bodyScriptLines = hoistedBodyScripts.filter((s) => s.length > 0);

  const content = [
    '<!doctype html>',
    `<html${head.htmlAttrs}>`,
    '  <head>',
    indent(headBody, '    '),
    '  </head>',
    `  <body${head.bodyAttrs}>`,
    '    <div id="root"></div>',
    `    <script type="module" src="/src/entries/${pageName}.tsx"></script>`,
    ...bodyScriptLines.map((s) => '    ' + s),
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Convert a URL pathname to a flat React page name. Mirrors
 * routeToPageName in the Astro adapter so identical inputs produce
 * identical outputs.
 *
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

/**
 * Flat page name -> PascalCase identifier prefix for the page component.
 *   "index"             -> "Index"
 *   "about-us"          -> "AboutUs"
 *   "services-design"   -> "ServicesDesign"
 */
function pascalCasePageName(pageName: string): string {
  return pageName
    .split('-')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}
