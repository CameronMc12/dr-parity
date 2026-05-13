/**
 * Top-level orchestrator for the production Astro renderer.
 *
 * Pure-functional: takes the IR (PageData + Analysis), returns a
 * Record<filePath, fileContents>. Writing the files is the caller's job.
 */

import type { PageData } from '../../types/extraction';
import type { BehaviorModel, ComponentTree, DesignTokens, TopologyMap } from '../../types/component';

import { buildScaffold } from './project-scaffolder';
import { buildTokensCss } from './tokens-css';
import { buildBaseCss } from './base-css';
import { buildBaseLayout } from './layout-builder';
import { emitSection, type SectionEmission } from './section-emitter';
import { buildAnimations } from './animations-builder';
import { buildIndexPage } from './page-builder';

export interface Analysis {
  tokens: DesignTokens;
  topology: TopologyMap;
  componentTree?: ComponentTree;
  behaviorModel?: BehaviorModel;
}

export interface RenderOptions {
  pageData: PageData;
  analysis: Analysis;
  /** Slug-style name used as the project name. */
  designName?: string;
}

export interface RenderResult {
  /** Map of relative file path → file contents. */
  files: Record<string, string>;
  /** Entry page path inside the project. */
  entryPage: string;
}

export function renderAstro(options: RenderOptions): RenderResult {
  const { pageData, analysis } = options;
  const designName = options.designName ?? deriveDesignName(pageData);

  const sortedSections = pageData.sections.slice().sort((a, b) => a.order - b.order);

  const emissions: SectionEmission[] = sortedSections.map((section) =>
    emitSection({
      section,
      tokens: analysis.tokens,
      componentTree: analysis.componentTree,
    }),
  );

  const hasIslands = emissions.some((e) => e.kind === 'island');

  const scaffold = buildScaffold({
    name: designName,
    hasIslands,
    designName,
  });

  const tokensCss = buildTokensCss(analysis.tokens).css;
  const baseCss = buildBaseCss();
  const baseLayout = buildBaseLayout({ pageData, designName });
  const animations = buildAnimations(sortedSections);
  const indexPage = buildIndexPage({ emissions, designName });

  const files: Record<string, string> = {
    ...scaffold,
    'src/styles/tokens.css': tokensCss,
    'src/styles/base.css': baseCss,
    'src/layouts/BaseLayout.astro': baseLayout,
    'src/scripts/animations.ts': animations.contents,
    'src/pages/index.astro': indexPage,
  };

  for (const e of emissions) {
    if (e.kind === 'static') {
      files[`src/components/sections/${e.result.filename}`] = e.result.contents;
    } else {
      files[`src/components/islands/${e.result.filename}`] = e.result.contents;
    }
  }

  // Drop a placeholder favicon so the BaseLayout reference resolves.
  files['public/favicon.svg'] = defaultFaviconSvg();

  // Empty public/images/ marker so the directory exists when Astro packages.
  files['public/images/.gitkeep'] = '';

  return { files, entryPage: 'src/pages/index.astro' };
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
    return 'astro-clone';
  }
}

function defaultFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">',
    '  <rect width="16" height="16" rx="3" fill="currentColor"/>',
    '</svg>',
    '',
  ].join('\n');
}
