import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  DomSwapMap,
  IconGroup,
  IconManifest,
  IconManifestEntry,
  IconifyOptions,
  IconifyResult,
} from './types';

const RESERVED_ATTRS = new Set(['class']);

function escapeAttrValue(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function buildSvgOpenTag(attrs: Record<string, string>): string {
  const parts: string[] = ['<svg'];
  const sorted = Object.entries(attrs)
    .filter(([k]) => !RESERVED_ATTRS.has(k))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [k, v] of sorted) {
    parts.push(`${k}="${escapeAttrValue(v)}"`);
  }
  parts.push('class={className}');
  parts.push('{...rest}');
  return `${parts.join(' ')}>`;
}

export function renderAstroComponent(group: IconGroup): string {
  const { representative } = group;
  const openTag = buildSvgOpenTag(representative.attributes);
  const inner = representative.innerHTML;
  const lines = [
    '---',
    "const { class: className = '', ...rest } = Astro.props;",
    '---',
    `${openTag}${inner}</svg>`,
    '',
  ];
  return lines.join('\n');
}

function dedupeContexts(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= 3) break;
  }
  return out;
}

function projectRootRelative(filePath: string, projectRoot: string): string {
  const rel = relative(projectRoot, filePath);
  return rel.split(/[\\/]/).join('/');
}

export async function emitIcons(
  groups: IconGroup[],
  options: IconifyOptions,
  projectRoot: string,
): Promise<IconifyResult> {
  await mkdir(options.outDir, { recursive: true });

  const manifestEntries: IconManifestEntry[] = [];
  const swapMap: DomSwapMap = [];
  let total = 0;

  for (const group of groups) {
    const fileName = `${group.pascalName}.astro`;
    const filePath = join(options.outDir, fileName);
    await writeFile(filePath, renderAstroComponent(group), 'utf-8');

    const contexts = dedupeContexts(
      group.occurrences.map((o) => o.parentSelector),
    );

    manifestEntries.push({
      name: group.kebabName,
      pascalName: group.pascalName,
      hash: group.hash,
      componentFile: projectRootRelative(filePath, projectRoot),
      occurrences: group.occurrences.length,
      contexts,
    });

    for (const occ of group.occurrences) {
      swapMap.push({
        originalOuterHTML: occ.outerHTML,
        hash: group.hash,
        pascalName: group.pascalName,
      });
      total++;
    }
  }

  const manifest: IconManifest = {
    icons: manifestEntries,
    total,
    unique: groups.length,
  };

  const manifestPath = join(options.outDir, 'icon-manifest.json');
  const swapMapPath = join(options.outDir, 'dom-swap-map.json');

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  await writeFile(swapMapPath, JSON.stringify(swapMap, null, 2), 'utf-8');

  return {
    total,
    unique: groups.length,
    manifestPath,
    swapMapPath,
    outDir: options.outDir,
  };
}
