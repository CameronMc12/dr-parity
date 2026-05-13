/**
 * Emits `src/pages/index.astro` — the root page that imports the layout and
 * every section in order. Islands get `client:visible`.
 */

import type { SectionEmission } from './section-emitter';

export interface PageBuilderInput {
  emissions: SectionEmission[];
  designName: string;
}

export function buildIndexPage(input: PageBuilderInput): string {
  const { emissions, designName } = input;

  const imports: string[] = [
    "import BaseLayout from '../layouts/BaseLayout.astro';",
  ];
  const mounts: string[] = [];

  for (const e of emissions) {
    if (e.kind === 'static') {
      imports.push(
        `import ${e.result.componentName} from '../components/sections/${e.result.componentName}.astro';`,
      );
      mounts.push(`    <${e.result.componentName} />`);
    } else {
      imports.push(
        `import ${e.result.componentName} from '../components/islands/${e.result.componentName}';`,
      );
      mounts.push(`    <${e.result.componentName} client:visible />`);
    }
  }

  return [
    '---',
    ...imports,
    '---',
    `<BaseLayout title=${JSON.stringify(designName)}>`,
    '  <main>',
    ...mounts,
    '  </main>',
    '</BaseLayout>',
    '',
  ].join('\n');
}
