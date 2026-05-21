/**
 * Webapp emit: write App.tsx, per-route page components, components,
 * index.html shell, and main.tsx entry that boots React Router + MSW.
 *
 * JSX conversion reuses the React target's `htmlToJsx` so we stay
 * byte-equivalent on the parts of the pipeline already proven against
 * captured sites.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { ExtractedHead } from '../shared/types';
import { htmlToJsx } from '../react/html-to-jsx';
import type { WebappComponentDef } from './types';

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(filePath: string, content: string): number {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export interface RouteEntry {
  path: string;
  componentName: string;
}

/**
 * Write `src/App.tsx` containing the React Router `<Routes>` tree. Each
 * route renders one page component imported from `src/pages/`.
 */
export function writeApp(args: {
  srcDir: string;
  routes: RouteEntry[];
  title: string;
}): { name: string; bytes: number } {
  const { srcDir, routes, title } = args;
  const filePath = join(srcDir, 'App.tsx');

  const importLines = routes
    .map((r) => `import { ${r.componentName} } from './pages/${r.componentName}';`)
    .join('\n');
  const routeTags = routes
    .map((r) => `      <Route path="${escapeAttr(r.path)}" element={<${r.componentName} />} />`)
    .join('\n');

  const content = [
    "import { Routes, Route } from 'react-router-dom';",
    importLines,
    '',
    'export function App() {',
    '  return (',
    '    <Routes>',
    routeTags,
    '    </Routes>',
    '  );',
    '}',
    '',
    `App.displayName = ${JSON.stringify(title || 'App')};`,
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'App', bytes };
}

/**
 * Write a single page component. Phase 1 wraps the captured body slice in
 * a single root `<div>` and converts to JSX. Stateful wiring (useState
 * driven by inferred state pairs) lands in Phase 3.
 */
export function writeComponent(
  pagesDir: string,
  def: WebappComponentDef,
): { name: string; bytes: number } {
  const filePath = join(pagesDir, `${def.name}.tsx`);
  const jsx = def.tsx.length > 0 ? def.tsx : htmlToJsx(def.html);
  const wrapped = `<>\n${jsx.trim()}\n</>`;

  const content = [
    `export function ${def.name}() {`,
    '  return (',
    indent(wrapped, '    '),
    '  );',
    '}',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: def.name, bytes };
}

/**
 * Write the Vite shell `index.html`. Captured head innerHTML is preserved
 * verbatim so the original CSS/font cascade still resolves.
 */
export function writeIndexHtml(args: {
  outDir: string;
  head: ExtractedHead;
}): { name: string; bytes: number } {
  const { outDir, head } = args;
  const filePath = join(outDir, 'index.html');

  const content = [
    '<!doctype html>',
    `<html${head.htmlAttrs}>`,
    '  <head>',
    indent(head.innerHTML, '    '),
    '  </head>',
    `  <body${head.bodyAttrs}>`,
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.tsx"></script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'index.html', bytes };
}

/**
 * Write `src/main.tsx`. Boots React, wraps App in BrowserRouter, and
 * starts the MSW worker in dev. MSW handlers ship empty in Phase 1;
 * Phase 4 populates them from captured XHR/fetch traffic.
 */
export function writeMain(
  srcDir: string,
  _routes: readonly RouteEntry[],
): { name: string; bytes: number } {
  const filePath = join(srcDir, 'main.tsx');

  const content = [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import { BrowserRouter } from 'react-router-dom';",
    "import { App } from './App';",
    "import { runPostHydrationSync } from './lib/post-hydration-sync';",
    '',
    'async function bootstrap(): Promise<void> {',
    '  if (import.meta.env.DEV) {',
    "    const { worker } = await import('./mocks/browser');",
    "    await worker.start({ onUnhandledRequest: 'bypass' });",
    '  }',
    '',
    "  const rootEl = document.getElementById('root');",
    "  if (!rootEl) throw new Error('Missing #root element');",
    '',
    '  ReactDOM.createRoot(rootEl).render(',
    '    <React.StrictMode>',
    '      <BrowserRouter>',
    '        <App />',
    '      </BrowserRouter>',
    '    </React.StrictMode>,',
    '  );',
    '',
    '  runPostHydrationSync();',
    '}',
    '',
    'void bootstrap();',
    '',
  ].join('\n');

  const bytes = writeText(filePath, content);
  return { name: 'main', bytes };
}
