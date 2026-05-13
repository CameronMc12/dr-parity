/**
 * Per-section dispatcher: decides between a static .astro section or a React
 * .tsx island based on the section's ComponentSpec.isClient flag.
 *
 * If no ComponentTree exists in the analysis, every section is treated as
 * static (.astro). To opt in to an island, a section must have a matching
 * ComponentNode with `spec.isClient === true`.
 */

import type { SectionSpec } from '../../types/extraction';
import type { ComponentTree, DesignTokens } from '../../types/component';

import { buildAstroSection, type AstroSectionResult } from './astro-section-emitter';
import { buildReactIsland, type ReactIslandResult } from './react-island-emitter';

export type SectionEmission =
  | { kind: 'static'; result: AstroSectionResult; sectionClass: string; sectionId: string }
  | { kind: 'island'; result: ReactIslandResult; sectionClass: string; sectionId: string };

export interface SectionEmissionInput {
  section: SectionSpec;
  tokens: DesignTokens;
  componentTree?: ComponentTree;
}

export function emitSection(input: SectionEmissionInput): SectionEmission {
  const { section, tokens, componentTree } = input;
  const sectionClass = section.className || slugify(section.name);
  const isClient = lookupIsClient(section, componentTree);

  if (isClient) {
    return {
      kind: 'island',
      result: buildReactIsland(section),
      sectionClass,
      sectionId: section.id,
    };
  }

  return {
    kind: 'static',
    result: buildAstroSection(section, tokens),
    sectionClass,
    sectionId: section.id,
  };
}

function lookupIsClient(section: SectionSpec, tree?: ComponentTree): boolean {
  if (!tree) return false;
  const node = findNodeForSection(tree.root, section.id);
  if (node?.spec.isClient) return true;
  for (const shared of tree.sharedComponents) {
    if (shared.usedIn.includes(section.id) && shared.spec.isClient) return true;
  }
  return false;
}

function findNodeForSection(node: { section?: SectionSpec; children: unknown[]; spec: { isClient: boolean } }, sectionId: string): { spec: { isClient: boolean } } | undefined {
  if (node.section?.id === sectionId) return node;
  for (const child of node.children) {
    const found = findNodeForSection(child as never, sectionId);
    if (found) return found;
  }
  return undefined;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}
