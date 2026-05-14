/**
 * Walk the body and group its children into Astro components.
 *
 * Top-level grouping (in document order):
 *   nodes before first landmark         -> BodyPreamble
 *   <header>                            -> Header
 *   nodes between </header> and <main>  -> MainInterstitial
 *   <main>                              -> Main (wraps numbered sections)
 *   nodes between </main> and <footer>  -> PostMain
 *   <footer>                            -> Footer
 *   nodes after </footer>               -> BodyPostamble
 *
 * Degenerate cases:
 *   - If <main> is absent and both <header> and <footer> exist, the bucket
 *     between them collapses into a single MainBody component.
 *   - If only one of <header>/<footer> exists, the surrounding loose nodes
 *     fall into BodyPreamble or BodyPostamble as appropriate.
 *
 * Inside <main>: each element child that is <section>, <article>, <aside>,
 * or <div> becomes a SectionNN_<slug> component. Text nodes and comments at
 * the body or main level are retained inside the nearest wrapper component.
 */

import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { normaliseElementPaths } from './paths';
import { deriveSlug, pascalCase } from './slug';
import type { ComponentDef } from './types';

const SECTION_TAGS = new Set(['section', 'article', 'aside', 'div']);

function outerHTML($: CheerioAPI, node: AnyNode): string {
  return $.html(node).trim();
}

/**
 * domhandler reports node.type as 'script' for <script>, 'style' for <style>,
 * and 'tag' for every other element. Treat all three as elements so body-level
 * <script>/<style> nodes (e.g. trailing bootstrap scripts after </footer>) are
 * not silently dropped.
 */
function isTag(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

function isLandmark(node: AnyNode): node is Element {
  return node.type === 'tag';
}

function trimText(node: AnyNode): string {
  if (node.type === 'text') return (node.data ?? '').trim();
  return '';
}

function pickHeader(nodes: AnyNode[]): { headerIdx: number; mainIdx: number; footerIdx: number } {
  let headerIdx = -1;
  let mainIdx = -1;
  let footerIdx = -1;
  nodes.forEach((node, i) => {
    if (!isLandmark(node)) return;
    if (headerIdx === -1 && node.tagName === 'header') headerIdx = i;
    if (mainIdx === -1 && node.tagName === 'main') mainIdx = i;
    if (node.tagName === 'footer') footerIdx = i;
  });
  return { headerIdx, mainIdx, footerIdx };
}

function buildWrapper($: CheerioAPI, nodes: AnyNode[], wrapTag: string): string {
  if (nodes.length === 0) return '';
  const fragments = nodes.map((n) => outerHTML($, n)).filter((s) => s.length > 0);
  if (fragments.length === 0) return '';
  return `<${wrapTag}>\n${fragments.join('\n')}\n</${wrapTag}>`;
}

interface SliceMainResult {
  main: ComponentDef;
  sections: ComponentDef[];
}

function sliceMain($: CheerioAPI, mainEl: Element): SliceMainResult {
  normaliseElementPaths($, $(mainEl));

  const mainTag = mainEl.tagName;
  const mainAttribs = mainEl.attribs;

  const sections: ComponentDef[] = [];
  let sectionIdx = 0;

  const usedSlugs = new Map<string, number>();
  const childNodes: AnyNode[] = mainEl.children as AnyNode[];

  const mainImportTokens: string[] = [];

  let chromeBuffer: string[] = [];
  const flushChrome = (): void => {
    if (chromeBuffer.length === 0) return;
    sectionIdx += 1;
    const padded = String(sectionIdx).padStart(2, '0');
    const componentName = `Section${padded}_Chrome`;
    sections.push({
      name: componentName,
      role: 'section',
      html: chromeBuffer.join('\n'),
    });
    mainImportTokens.push(componentName);
    chromeBuffer = [];
  };

  for (const node of childNodes) {
    if (isTag(node) && SECTION_TAGS.has(node.tagName)) {
      flushChrome();
      sectionIdx += 1;
      const rawSlug = deriveSlug($, node);
      const count = (usedSlugs.get(rawSlug) ?? 0) + 1;
      usedSlugs.set(rawSlug, count);
      const uniqueSlug = count === 1 ? rawSlug : `${rawSlug}-${count}`;
      const padded = String(sectionIdx).padStart(2, '0');
      const componentName = `Section${padded}_${pascalCase(uniqueSlug)}`;
      const html = outerHTML($, node);
      sections.push({ name: componentName, role: 'section', html });
      mainImportTokens.push(componentName);
    } else {
      const text = trimText(node);
      if (text.length > 0 || isTag(node)) {
        chromeBuffer.push(outerHTML($, node));
      }
    }
  }
  flushChrome();

  const attrsString = serialiseAttrs(mainAttribs);
  const mainOpen = `<${mainTag}${attrsString}>`;
  const mainClose = `</${mainTag}>`;

  const importLines = mainImportTokens
    .map((n) => `import ${n} from './${n}.astro';`)
    .join('\n');

  const composed = mainImportTokens.map((token) => `  <${token} />`).join('\n');

  const mainBody = [
    '---',
    importLines,
    '---',
    composed.length > 0 ? `${mainOpen}\n${composed}\n${mainClose}` : `${mainOpen}${mainClose}`,
  ].join('\n');

  return {
    main: { name: 'Main', role: 'main', html: mainBody, children: sections },
    sections,
  };
}

function serialiseAttrs(attribs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attribs)) {
    if (value === undefined || value === null) continue;
    if (value === '') parts.push(key);
    else parts.push(`${key}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`);
  }
  return parts.length === 0 ? '' : ' ' + parts.join(' ');
}

export interface SliceBodyResult {
  components: ComponentDef[];
  pageImports: string[];
}

export function sliceBody($: CheerioAPI): SliceBodyResult {
  const body = $('body').first();
  if (body.length === 0) {
    throw new Error('Captured HTML has no <body> element.');
  }
  normaliseElementPaths($, body);

  const nodes: AnyNode[] = (body.get(0) as Element).children as AnyNode[];
  const { headerIdx, mainIdx, footerIdx } = pickHeader(nodes);

  const firstLandmarkIdx = [headerIdx, mainIdx, footerIdx]
    .filter((i) => i !== -1)
    .reduce((min, i) => (min === -1 || i < min ? i : min), -1);

  const preambleEnd = firstLandmarkIdx === -1 ? nodes.length : firstLandmarkIdx;
  const preambleNodes = nodes.slice(0, preambleEnd);

  let interstitialNodes: AnyNode[] = [];
  let postMainNodes: AnyNode[] = [];
  let postambleNodes: AnyNode[] = [];

  if (headerIdx !== -1 && mainIdx !== -1) {
    interstitialNodes = nodes.slice(headerIdx + 1, mainIdx);
  }
  if (mainIdx !== -1 && footerIdx !== -1) {
    postMainNodes = nodes.slice(mainIdx + 1, footerIdx);
  } else if (mainIdx === -1 && headerIdx !== -1 && footerIdx !== -1) {
    interstitialNodes = nodes.slice(headerIdx + 1, footerIdx);
  } else if (mainIdx !== -1 && footerIdx === -1) {
    postMainNodes = nodes.slice(mainIdx + 1);
  } else if (headerIdx !== -1 && mainIdx === -1 && footerIdx === -1) {
    interstitialNodes = nodes.slice(headerIdx + 1);
  }

  if (footerIdx !== -1) {
    postambleNodes = nodes.slice(footerIdx + 1);
  }

  const components: ComponentDef[] = [];
  const pageImports: string[] = [];

  const meaningful = (list: AnyNode[]): AnyNode[] =>
    list.filter((n) => isTag(n) || trimText(n).length > 0);

  const emit = (name: string, role: ComponentDef['role'], list: AnyNode[]): void => {
    const filtered = meaningful(list);
    if (filtered.length === 0) return;
    components.push({
      name,
      role,
      html: filtered.map((n) => outerHTML($, n)).join('\n'),
    });
    pageImports.push(name);
  };

  emit('BodyPreamble', 'preamble', preambleNodes);

  if (headerIdx !== -1) {
    const node = nodes[headerIdx];
    if (isTag(node)) {
      components.push({ name: 'Header', role: 'header', html: outerHTML($, node) });
      pageImports.push('Header');
    }
  }

  if (mainIdx === -1 && headerIdx !== -1 && footerIdx !== -1) {
    emit('MainBody', 'interstitial', interstitialNodes);
  } else {
    emit('MainInterstitial', 'interstitial', interstitialNodes);
  }

  if (mainIdx !== -1) {
    const mainEl = nodes[mainIdx] as Element;
    const { main, sections } = sliceMain($, mainEl);
    components.push(main);
    components.push(...sections);
    pageImports.push('Main');
  }

  emit('PostMain', 'post-main', postMainNodes);

  if (footerIdx !== -1) {
    const node = nodes[footerIdx];
    if (isTag(node)) {
      components.push({ name: 'Footer', role: 'footer', html: outerHTML($, node) });
      pageImports.push('Footer');
    }
  }

  emit('BodyPostamble', 'postamble', postambleNodes);

  return { components, pageImports };
}

// Suppress unused-builder export warning while keeping the helper available
// for tests if needed in the future.
export const __internal = { buildWrapper };
