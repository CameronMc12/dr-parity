/**
 * Page assembler — composes generated components into a page.tsx file,
 * ordered by topology with overlay handling and scroll container setup.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ComponentNode, TopologyMap } from '../types/component';
import type { ComponentGenOutput } from './component-gen';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PageAssemblyOutput {
  content: string;
  filePath: string;
}

export interface AssemblyOptions {
  projectDir: string;
  topology: TopologyMap;
  components: ComponentGenOutput[];
  componentTree: ComponentNode[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function assemblePageFile(
  options: AssemblyOptions,
): Promise<PageAssemblyOutput> {
  const content = buildPageContent(options);
  const filePath = join(options.projectDir, 'src/app/page.tsx');

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');

  return { content, filePath };
}

// ---------------------------------------------------------------------------
// Page content builder
// ---------------------------------------------------------------------------

function buildPageContent(options: AssemblyOptions): string {
  const { topology, components, componentTree } = options;
  const lines: string[] = [];

  // Classify components into overlays vs flow sections
  const overlayIds = new Set(topology.overlays.map((o) => o.id));
  const orderedSections = orderByTopology(componentTree, topology);
  const overlayComponents = orderedSections.filter((n) => overlayIds.has(n.id));
  const flowComponents = orderedSections.filter((n) => !overlayIds.has(n.id));

  // Build a map from componentName to its generated output for import paths
  const outputByName = new Map<string, ComponentGenOutput>();
  for (const comp of components) {
    outputByName.set(comp.componentName, comp);
  }

  // Determine if the page needs "use client" (for Lenis wrapper)
  const needsClient = topology.hasSmoothScroll && topology.smoothScrollLibrary === 'lenis';

  if (needsClient) {
    lines.push('"use client";');
    lines.push('');
  }

  // Imports
  const importedNames = new Set<string>();

  for (const node of [...overlayComponents, ...flowComponents]) {
    if (importedNames.has(node.name)) continue;
    importedNames.add(node.name);

    const output = outputByName.get(node.name);
    const importPath = output
      ? toRelativeImport(output.filePath)
      : `@/components/${node.name}`;

    lines.push(`import { ${node.name} } from "${importPath}";`);
  }

  if (needsClient) {
    lines.push('import { useEffect, useRef } from "react";');
  }

  lines.push('');

  // Page component
  lines.push('export default function Page() {');

  // Lenis scroll wrapper hook
  if (needsClient) {
    lines.push('  const containerRef = useRef<HTMLDivElement>(null);');
    lines.push('');
    lines.push('  useEffect(() => {');
    lines.push('    let lenis: InstanceType<typeof import("lenis").default> | null = null;');
    lines.push('');
    lines.push('    async function initLenis() {');
    lines.push('      const Lenis = (await import("lenis")).default;');
    lines.push('      lenis = new Lenis();');
    lines.push('      function raf(time: number) {');
    lines.push('        lenis?.raf(time);');
    lines.push('        requestAnimationFrame(raf);');
    lines.push('      }');
    lines.push('      requestAnimationFrame(raf);');
    lines.push('    }');
    lines.push('');
    lines.push('    initLenis();');
    lines.push('    return () => { lenis?.destroy(); };');
    lines.push('  }, []);');
    lines.push('');
  }

  lines.push('  return (');
  lines.push('    <>');

  // Overlays (outside main flow — rendered first for DOM order, styled with fixed/sticky)
  for (const overlay of overlayComponents) {
    const topologyOverlay = topology.overlays.find((o) => o.id === overlay.id);
    if (topologyOverlay) {
      lines.push(`      {/* ${topologyOverlay.type}: ${overlay.name} (${topologyOverlay.position}, z-${topologyOverlay.zIndex}) */}`);
    }
    lines.push(`      <${overlay.name} />`);
  }

  // Main content wrapper
  const mainAttrs = buildMainAttributes(topology);
  lines.push(`      <main${mainAttrs}>`);

  // Flow sections in topology order with transition comments
  for (let i = 0; i < flowComponents.length; i++) {
    const node = flowComponents[i];
    const topoSection = topology.sections.find((s) => s.id === node.id);

    // Add transition separator comment
    if (topoSection?.transition && topoSection.transition.type !== 'none') {
      lines.push(`        {/* transition: ${topoSection.transition.type} ${topoSection.transition.direction} */}`);
    }

    const snapClass = topology.hasScrollSnap ? ' className="snap-section"' : '';
    if (snapClass) {
      lines.push(`        <div${snapClass}>`);
      lines.push(`          <${node.name} />`);
      lines.push('        </div>');
    } else {
      lines.push(`        <${node.name} />`);
    }
  }

  lines.push('      </main>');
  lines.push('    </>');
  lines.push('  );');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

function orderByTopology(
  componentTree: ComponentNode[],
  topology: TopologyMap,
): ComponentNode[] {
  // Build a map of section id -> topology order
  const orderMap = new Map<string, number>();
  for (const section of topology.sections) {
    orderMap.set(section.id, section.order);
  }
  // Overlays get a high order to sort them separately
  for (const overlay of topology.overlays) {
    orderMap.set(overlay.id, -1);
  }

  // Flatten the component tree (root children are the section components)
  const nodes = flattenNodes(componentTree);

  return [...nodes].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? 9999;
    const orderB = orderMap.get(b.id) ?? 9999;
    return orderA - orderB;
  });
}

function flattenNodes(nodes: ComponentNode[]): ComponentNode[] {
  const result: ComponentNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenNodes(node.children));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main element attributes
// ---------------------------------------------------------------------------

function buildMainAttributes(topology: TopologyMap): string {
  const attrs: string[] = [];
  const classes: string[] = [];

  if (topology.hasScrollSnap) {
    classes.push('snap-container');
  }

  if (topology.scrollContainer !== 'window') {
    classes.push('hide-scrollbar');
  }

  if (classes.length > 0) {
    attrs.push(`className="${classes.join(' ')}"`);
  }

  if (attrs.length === 0) return '';
  return ' ' + attrs.join(' ');
}

// ---------------------------------------------------------------------------
// Import path helpers
// ---------------------------------------------------------------------------

function toRelativeImport(absoluteFilePath: string): string {
  // Convert absolute paths to @/ imports
  const srcIdx = absoluteFilePath.indexOf('src/');
  if (srcIdx !== -1) {
    const relative = absoluteFilePath.slice(srcIdx + 4); // remove "src/"
    const withoutExt = relative.replace(/\.tsx?$/, '');
    return `@/${withoutExt}`;
  }
  return absoluteFilePath;
}
