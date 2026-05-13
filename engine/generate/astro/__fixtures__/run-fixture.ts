#!/usr/bin/env tsx
/**
 * Run the Astro renderer against the in-tree fixture (re-using the prototype
 * fixture JSON files). Forces one section to be a React island so the build
 * exercises the @astrojs/react path.
 *
 *   npx tsx engine/generate/astro/__fixtures__/run-fixture.ts
 *
 * Writes to `clone-astro-fixture/` at the repo root.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PageData, SectionSpec } from '../../../types/extraction';
import type { ComponentNode, ComponentTree } from '../../../types/component';
import { renderAstro, type Analysis } from '../renderer';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const fixtureDir = resolve(join(__dirname, '..', '..', 'prototype', '__fixtures__'));
  const pageDataPath = join(fixtureDir, 'sample-page-data.json');
  const analysisPath = join(fixtureDir, 'sample-analysis.json');

  const pageData = JSON.parse(await readFile(pageDataPath, 'utf-8')) as PageData;
  const baseAnalysis = JSON.parse(await readFile(analysisPath, 'utf-8')) as Analysis;

  // Force the second section to be a client island so the build emits a
  // React chunk and we can verify @astrojs/react is wired correctly.
  const islandSection = pageData.sections[1] ?? pageData.sections[0];
  const analysis: Analysis = {
    ...baseAnalysis,
    componentTree: buildForcedTree(pageData.sections, islandSection?.id),
  };

  const result = renderAstro({ pageData, analysis, designName: 'sample' });

  const outDir = resolve(join(__dirname, '..', '..', '..', '..', 'clone-astro-fixture'));
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const [rel, contents] of Object.entries(result.files)) {
    const full = join(outDir, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, contents, 'utf-8');
    console.log(`wrote ${full}`);
  }

  console.log('');
  console.log(`next: cd ${outDir} && npm install && npm run build`);
}

function buildForcedTree(sections: SectionSpec[], islandSectionId: string | undefined): ComponentTree {
  const children: ComponentNode[] = sections.map((section) => ({
    id: section.id,
    name: section.name,
    filePath: `src/components/${section.name}.astro`,
    section,
    spec: {
      name: section.name,
      description: '',
      isClient: section.id === islandSectionId,
      props: [],
      elements: section.elements,
      animations: section.animations,
      responsiveBreakpoints: section.responsiveBreakpoints,
      interactionModel: section.interactionModel,
      imports: [],
    },
    children: [],
    dependencies: [],
  }));

  return {
    root: {
      id: 'root',
      name: 'Page',
      filePath: 'src/pages/index.astro',
      spec: {
        name: 'Page',
        description: 'Root page node',
        isClient: false,
        props: [],
        elements: [],
        animations: [],
        responsiveBreakpoints: [],
        interactionModel: 'static',
        imports: [],
      },
      children,
      dependencies: [],
    },
    sharedComponents: [],
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
