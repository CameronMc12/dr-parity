/**
 * Top-level React build orchestrator: validate inputs, copy assets, slice
 * the captured HTML using the shared IR, then emit a Vite + React + TS
 * project.
 *
 * Head extraction, body slicing, and asset copying come from the shared
 * (target-agnostic) layer. This file owns React emit + scaffold.
 */

import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as cheerioModule from 'cheerio';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;

import { extractHead, sliceBody, copyAssetsToPublic } from '../shared';
import { normaliseElementPaths } from '../shared/paths';
import {
  collectAndStripBodyScripts,
  renderHoistedScripts,
  listPublicCssFiles,
  extractSourceStylesheetHrefs,
  planCssLinks,
  filterAlreadyLinked,
} from './collect-hoistable';
import { writeApp, writeComponent, writeIndexHtml, writeMain } from './emit';
import { writePostHydrationSyncLib } from './post-hydration-sync';
import { writeScaffold } from './scaffold';
import type { BuildOptions, BuildSummary } from './types';

export function validateCloneDir(cloneDir: string): void {
  const abs = resolve(cloneDir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`Clone directory not found: ${abs}`);
  }
  if (!existsSync(join(abs, 'index.html'))) {
    throw new Error(`Clone is missing index.html: ${abs}`);
  }
  if (!existsSync(join(abs, 'manifest.json'))) {
    throw new Error(`Clone is missing manifest.json: ${abs}`);
  }
}

export async function buildReactProject(options: BuildOptions): Promise<BuildSummary> {
  const { cloneDir, outDir, name, force } = options;
  const absClone = resolve(cloneDir);
  const absOut = resolve(outDir);

  if (absOut === absClone || absOut.startsWith(absClone + '/')) {
    throw new Error('Refusing to write into the clone directory itself.');
  }

  validateCloneDir(absClone);

  if (existsSync(absOut)) {
    if (!force) {
      throw new Error(
        `Output directory already exists: ${absOut} (pass --force to overwrite)`,
      );
    }
  }

  mkdirSync(absOut, { recursive: true });

  const publicDir = join(absOut, 'public');
  const assetStats = copyAssetsToPublic(absClone, publicDir);

  const html = readFileSync(join(absClone, 'index.html'), 'utf8');
  const $ = cheerio.load(html, null, true);

  const head = extractHead($);

  // Normalise body asset paths BEFORE collecting hoisted scripts. The
  // captured clone serialises every reference as `./foo` because it
  // injects a `<base href="./">`. Vite resolves `<script src="./foo">`
  // against the project root (not /public), so without this rewrite
  // Vite fails the build with "Could not resolve ./foo". `sliceBody`
  // also normalises body paths later, but that runs after script
  // collection so the hoisted scripts would otherwise keep their
  // original `./` prefixes. Calling it twice is idempotent: the
  // second pass sees absolute paths and skips them.
  normaliseElementPaths($, $('body'));

  // Collect body-level <script> tags BEFORE slicing, then remove them
  // from the cheerio tree so the JSX emitter doesn't render them
  // (React DOM-renders script tags without executing them — fatal for
  // GSAP/AOS-style libraries). Hoisted scripts are spliced into the
  // root index.html at end of <body> to match source execution order.
  const bodyScripts = collectAndStripBodyScripts($);
  const hoistedScripts = renderHoistedScripts(bodyScripts);

  const { components, pageImports } = sliceBody($);

  // Discover any cached *.css under /public that the source <head>
  // didn't already link (preloaded or JS-imported bundles) and emit
  // <link rel="stylesheet"> for them in index.html. Source-linked
  // stylesheets already live in head.innerHTML verbatim — we only
  // append the orphans to preserve original cascade order.
  const publicCssFiles = listPublicCssFiles(publicDir);
  const sourceStylesheetHrefs = extractSourceStylesheetHrefs(html);
  const plannedLinks = planCssLinks({ sourceStylesheetHrefs, publicCssFiles });
  const extraStylesheetHrefs = filterAlreadyLinked(head.innerHTML, plannedLinks);

  const srcDir = join(absOut, 'src');
  const componentsDir = join(srcDir, 'components');

  const summary: BuildSummary = {
    components: [],
    assetCount: assetStats.count,
    assetBytes: assetStats.bytes,
  };

  for (const comp of components) {
    summary.components.push(writeComponent(componentsDir, comp));
  }

  summary.components.push(writeApp({ srcDir, pageImports, title: head.title }));
  summary.components.push(writePostHydrationSyncLib(srcDir));
  summary.components.push(writeMain(srcDir));
  summary.components.push(
    writeIndexHtml({
      outDir: absOut,
      head,
      extraStylesheetHrefs,
      hoistedBodyScripts: hoistedScripts,
    }),
  );

  writeScaffold(absOut, name);

  return summary;
}
