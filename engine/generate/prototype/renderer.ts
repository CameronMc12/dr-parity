/**
 * Top-level orchestrator for the zero-build prototype renderer.
 *
 * Pure-functional: takes the IR, returns a Record<filePath, fileContents>.
 * Writing the files to disk is the caller's job.
 */

import type { PageData } from '../../types/extraction';
import type { DesignTokens, TopologyMap, ComponentTree } from '../../types/component';

import { buildTokensCss } from './tokens-css';
import { buildBaseCss } from './base-css';
import { buildComponentCss } from './component-css';
import { buildDataJsx } from './data-emitter';
import { buildChromeJsx } from './chrome-emitter';
import { buildViewJsx, type ViewEmitterResult } from './view-emitter';
import { buildAppJsx } from './app-emitter';
import { buildShellHtml } from './shell-builder';

export interface Analysis {
  tokens: DesignTokens;
  topology: TopologyMap;
  componentTree?: ComponentTree;
}

export interface RenderOptions {
  pageData: PageData;
  analysis: Analysis;
  /** Slug-style name used for the HTML file (e.g. `homepage`). */
  designName?: string;
}

export interface RenderResult {
  /** Map of relative file path → file contents. */
  files: Record<string, string>;
  /** Filename of the entry HTML (e.g. `homepage.html`). */
  entryHtml: string;
}

export function renderPrototype(options: RenderOptions): RenderResult {
  const { pageData, analysis } = options;
  const designName = options.designName ?? deriveDesignName(pageData);

  const tokensResult = buildTokensCss(analysis.tokens);
  const baseCss = buildBaseCss();
  const componentCss = buildComponentCss({
    sections: pageData.sections,
    tokens: analysis.tokens,
  });

  const inlineCss = [tokensResult.rootBlock, baseCss, componentCss, viewSwitcherCss()].join('\n\n');

  const dataJsx = buildDataJsx(pageData.sections);
  const chrome = buildChromeJsx(analysis.topology);
  const views: ViewEmitterResult[] = pageData.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => buildViewJsx(s));
  const appJsx = buildAppJsx(views, chrome.hasChrome);

  const shellHtml = buildShellHtml({
    designName,
    inlineCss,
    viewSlugs: views.map((v) => v.slug),
    hasChrome: chrome.hasChrome,
    fonts: pageData.fonts,
  });

  const entryHtml = `${designName}.html`;
  const files: Record<string, string> = {
    [entryHtml]: shellHtml,
    'data.jsx': dataJsx,
    'chrome.jsx': chrome.contents,
    'app.jsx': appJsx,
  };
  for (const v of views) files[v.filename] = v.contents;

  return { files, entryHtml };
}

function viewSwitcherCss(): string {
  return [
    '/* Prototype view-switcher tab bar */',
    '.view-switcher { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--paper); position: sticky; top: 0; z-index: 100; }',
    '.view-tab { background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; font-family: var(--sans); font-size: 13px; color: var(--dark); }',
    '.view-tab.active { background: var(--dark); color: var(--paper); }',
    '.svg-wrap { display: inline-flex; }',
    '.svg-wrap svg { width: 1em; height: 1em; }',
  ].join('\n');
}

function deriveDesignName(pageData: PageData): string {
  if (pageData.title) {
    const slug = pageData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slug) return slug;
  }
  try {
    const url = new URL(pageData.url);
    return url.hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-');
  } catch {
    return 'prototype';
  }
}
