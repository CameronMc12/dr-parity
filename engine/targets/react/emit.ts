/**
 * Write .tsx component files and the App/page composition.
 *
 * The shared body-slicer returns Main as a structured composition
 * (`wrapper.openTag` + `wrapper.closeTag` + `childComponentNames`, with
 * `html: ''`). We render that directly as a React component file with
 * ES imports for each child and the wrapper tags around composed JSX
 * child references. Leaf components keep their captured `html` and go
 * through `htmlToJsx`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Element } from 'domhandler';

import type { ComponentDef, ExtractedHead } from '../shared/types';
import { htmlToJsx } from './html-to-jsx';

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(filePath: string, content: string): number {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export interface EmitOptions {
  /**
   * Tag names that should be wrapped in dangerouslySetInnerHTML by the
   * JSX converter. Useful escape hatch for elements that don't roundtrip
   * cleanly (e.g. unusual web components).
   */
  escapeHatchTags?: ReadonlySet<string>;
  /**
   * Predicate for per-element escape-hatching. When it returns true for
   * an element, that element's INNER subtree is emitted as
   * dangerouslySetInnerHTML and React stops reconciling it after mount.
   *
   * Used to seal off subtrees that third-party runtime scripts mutate
   * (e.g. Apple's ac-gallery carousel: the runtime applies
   * `current current-item` classes and inline transforms on slides,
   * which React's StrictMode dev double-render would otherwise wipe).
   * Capability-detected: a predicate that returns false for every node
   * leaves all output unchanged.
   */
  shouldEscapeHatch?: (el: Element) => boolean;
}

function isCompositionComponent(comp: ComponentDef): boolean {
  return comp.wrapper !== undefined && comp.childComponentNames !== undefined;
}

// Placeholder for child composition during the JSX attribute-normalisation
// pass. Chosen to be cheerio-safe (no special chars) and unlikely to clash
// with any real captured HTML.
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
  options: EmitOptions,
): { imports: string[]; body: string } {
  const wrapper = comp.wrapper as { openTag: string; closeTag: string };
  const children = comp.childComponentNames ?? [];
  const composed = children.map((n) => `  <${n} />`).join('\n');

  const normalisedShell = htmlToJsx(
    `${wrapper.openTag}${CHILDREN_PLACEHOLDER}${wrapper.closeTag}`,
    {
      escapeHatchTags: options.escapeHatchTags,
      shouldEscapeHatch: options.shouldEscapeHatch,
    },
  );
  const replacement =
    composed.length > 0 ? `\n${composed}\n` : '';
  const body = normalisedShell.replace(CHILDREN_PLACEHOLDER, replacement);
  return { imports: children, body };
}

export function writeComponent(
  componentsDir: string,
  comp: ComponentDef,
  options: EmitOptions = {},
): { name: string; bytes: number } {
  const filePath = join(componentsDir, `${comp.name}.tsx`);

  let imports: string[];
  let body: string;
  if (isCompositionComponent(comp)) {
    const composed = renderCompositionReact(comp, options);
    imports = composed.imports;
    body = composed.body;
  } else {
    imports = [];
    body = htmlToJsx(comp.html, {
      escapeHatchTags: options.escapeHatchTags,
      shouldEscapeHatch: options.shouldEscapeHatch,
    });
  }

  const wrappedBody = wrapInFragment(body);

  const importLines = imports
    .map((n) => `import { ${n} } from './${n}';`)
    .join('\n');

  const fileContent = [
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

  const bytes = writeText(filePath, fileContent);
  return { name: comp.name, bytes };
}

/**
 * Wrap the body in a React Fragment unless it already has a single root.
 * Trivial heuristic: if the body starts with `<` and ends with `>` and
 * appears to contain a single top-level element, leave it; otherwise
 * wrap with `<>...</>`. We err on the side of always wrapping — JSX is
 * permissive about redundant fragments.
 */
function wrapInFragment(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) return '<></>';
  return `<>\n${trimmed}\n</>`;
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

export function writeApp(args: {
  srcDir: string;
  pageImports: string[];
  title: string;
}): { name: string; bytes: number } {
  const { srcDir, pageImports, title } = args;
  const filePath = join(srcDir, 'App.tsx');

  const importLines = pageImports
    .map((n) => `import { ${n} } from './components/${n}';`)
    .join('\n');
  const bodyTags = pageImports.map((n) => `      <${n} />`).join('\n');

  const content = [
    importLines,
    '',
    'export function App() {',
    '  return (',
    '    <>',
    bodyTags,
    '    </>',
    '  );',
    '}',
    '',
    `App.displayName = ${JSON.stringify(title || 'App')};`,
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'App', bytes };
}

export function writeMain(srcDir: string): { name: string; bytes: number } {
  const filePath = join(srcDir, 'main.tsx');
  // The post-hydration sync runtime is authored at
  // engine/targets/react/post-hydration-sync.ts and emitted once per
  // project to src/lib/post-hydration-sync.ts. Single-page and multi-page
  // entries both import `runPostHydrationSync` from there.
  const content = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import { App } from './App';",
    "import { runPostHydrationSync } from './lib/post-hydration-sync';",
    "import './styles/global.css';",
    '',
    "const rootEl = document.getElementById('root');",
    "if (!rootEl) throw new Error('Missing #root element');",
    '',
    '// No StrictMode: clone output hands runtime-owned DOM regions to foreign scripts; StrictMode\'s dev double-mount wipes their injected DOM. Production never used it.',
    'ReactDOM.createRoot(rootEl).render(<App />);',
    '',
    'runPostHydrationSync();',
    '',
  ].join('\n');
  const bytes = writeText(filePath, content);
  return { name: 'main', bytes };
}

/**
 * Generate the root index.html for the Vite dev server / build. The
 * captured head's <title>, <meta>, and <link> tags are inlined verbatim
 * (per the parity guarantee). The body holds a single `#root` div, the
 * entry script, and any captured body-level scripts hoisted out of the
 * JSX components (React would otherwise DOM-render them without executing).
 *
 * `extraStylesheetHrefs` is an ordered list of additional stylesheet
 * URLs (typically discovered in /public) that the source <head> didn't
 * already link — appended in <head> after the captured innerHTML so the
 * original cascade order is preserved while orphan cache bundles still
 * load.
 *
 * `hoistedBodyScripts` is the ordered list of already-rendered <script>
 * strings to inject at the end of <body>. Matching source execution
 * order matters for GSAP/AOS-style libraries that look for DOM nodes
 * that downstream React components mount.
 */
export function writeIndexHtml(args: {
  outDir: string;
  head: ExtractedHead;
  extraStylesheetHrefs?: readonly string[];
  hoistedBodyScripts?: readonly string[];
}): { name: string; bytes: number } {
  const { outDir, head, extraStylesheetHrefs = [], hoistedBodyScripts = [] } = args;
  const filePath = join(outDir, 'index.html');

  const headHtml = head.innerHTML;

  const extraLinkLines = extraStylesheetHrefs.map(
    (href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`,
  );

  const headBody = [headHtml, ...extraLinkLines].filter((l) => l.length > 0).join('\n');

  // Hoisted scripts go AFTER #root + the entry module so the captured
  // DOM (and React's mounted tree) exists by the time they execute —
  // matches source behaviour (scripts at end of body run after DOM
  // construction).
  const bodyScriptLines = hoistedBodyScripts.filter((s) => s.length > 0);

  const content = [
    '<!doctype html>',
    `<html${head.htmlAttrs}>`,
    '  <head>',
    indent(headBody, '    '),
    '  </head>',
    `  <body${head.bodyAttrs}>`,
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.tsx"></script>',
    ...bodyScriptLines.map((s) => '    ' + s),
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'index.html', bytes };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
