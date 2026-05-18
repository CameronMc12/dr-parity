/**
 * Write .tsx component files and the App/page composition.
 *
 * The shared body-slicer emits Astro-flavoured frontmatter on the Main
 * wrapper (a `---` block listing section imports). For React we strip
 * that fence, parse the import names back out, and re-emit them as ES
 * imports at the top of the React component file.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

interface ParsedBody {
  imports: string[];
  html: string;
}

/**
 * The shared slicer wraps `<main>` content like this:
 *
 *   ---
 *   import Section01_Foo from './Section01_Foo.astro';
 *   import Section02_Bar from './Section02_Bar.astro';
 *   ---
 *   <main>
 *     <Section01_Foo />
 *     <Section02_Bar />
 *   </main>
 *
 * For React we need to (a) lift the imports out, (b) drop the fence, and
 * (c) the inner `<SectionNN_Foo />` references become real JSX elements
 * that html-to-jsx will pass through unchanged (they look like custom
 * tags to the parser, which is fine — they're PascalCase so JSX treats
 * them as React components).
 */
function parseAstroFrontmatter(html: string): ParsedBody {
  if (!html.startsWith('---')) {
    return { imports: [], html };
  }
  const closing = html.indexOf('\n---', 3);
  if (closing === -1) {
    return { imports: [], html };
  }
  const frontmatter = html.slice(3, closing);
  const rest = html.slice(closing + '\n---'.length).replace(/^\n/, '');

  const importNames: string[] = [];
  // Match `import Name from './Name.astro';`
  const re = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"][^'"]+['"]\s*;?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(frontmatter)) !== null) {
    importNames.push(match[1]);
  }
  return { imports: importNames, html: rest };
}

/**
 * The shared slicer's Main body contains JSX-like self-closing references
 * like `<Section01_Foo />`. cheerio will lowercase the tag name during
 * parse, which would break the React component reference. Pre-rewrite
 * such tags to a placeholder that survives the round trip, then restore
 * them after JSX conversion.
 */
function preservePascalTags(html: string, names: string[]): { html: string; tokens: Map<string, string> } {
  const tokens = new Map<string, string>();
  let out = html;
  for (const name of names) {
    const placeholder = `__DR_PARITY_COMP_${name}__`;
    tokens.set(placeholder, name);
    // Self-closing and paired forms.
    out = out
      .replace(new RegExp(`<${name}\\s*/>`, 'g'), `<${placeholder.toLowerCase()} />`)
      .replace(new RegExp(`<${name}([\\s>])`, 'g'), `<${placeholder.toLowerCase()}$1`)
      .replace(new RegExp(`</${name}>`, 'g'), `</${placeholder.toLowerCase()}>`);
  }
  return { html: out, tokens };
}

function restorePascalTags(jsx: string, tokens: Map<string, string>): string {
  let out = jsx;
  for (const [placeholder, name] of tokens) {
    const lower = placeholder.toLowerCase();
    out = out
      .replace(new RegExp(`<${lower}\\s*/>`, 'g'), `<${name} />`)
      .replace(new RegExp(`<${lower}([\\s>])`, 'g'), `<${name}$1`)
      .replace(new RegExp(`</${lower}>`, 'g'), `</${name}>`);
  }
  return out;
}

export interface EmitOptions {
  /**
   * Tag names that should be wrapped in dangerouslySetInnerHTML by the
   * JSX converter. Useful escape hatch for elements that don't roundtrip
   * cleanly (e.g. unusual web components).
   */
  escapeHatchTags?: ReadonlySet<string>;
}

export function writeComponent(
  componentsDir: string,
  comp: ComponentDef,
  options: EmitOptions = {},
): { name: string; bytes: number } {
  const filePath = join(componentsDir, `${comp.name}.tsx`);

  const { imports, html: bodyHtml } = parseAstroFrontmatter(comp.html);

  // Protect PascalCase component references through the HTML parser.
  const { html: protectedHtml, tokens } = preservePascalTags(bodyHtml, imports);

  const jsx = htmlToJsx(protectedHtml, {
    escapeHatchTags: options.escapeHatchTags,
  });
  const restored = restorePascalTags(jsx, tokens);

  const importLines = imports
    .map((n) => `import { ${n} } from './${n}';`)
    .join('\n');

  const body = restored.length > 0 ? restored : '';
  const wrappedBody = wrapInFragment(body);

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
    'ReactDOM.createRoot(rootEl).render(',
    '  <React.StrictMode>',
    '    <App />',
    '  </React.StrictMode>,',
    ');',
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
