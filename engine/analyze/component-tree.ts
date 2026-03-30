/**
 * Component tree builder — groups extracted elements into logical React
 * components, detects shared patterns, and determines client/server split.
 */

import type { PageData, SectionSpec, ElementSpec } from '../types/extraction';
import type {
  ComponentTree,
  ComponentNode,
  ComponentSpec,
  SharedComponent,
  ImportSpec,
  PropSpec,
} from '../types/component';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildComponentTree(data: PageData): ComponentTree {
  const sectionNodes = data.sections.map(buildSectionNode);
  const sharedComponents = detectSharedComponents(data.sections, sectionNodes);

  // Wire up shared component dependencies
  for (const shared of sharedComponents) {
    for (const node of sectionNodes) {
      if (shared.usedIn.includes(node.id)) {
        node.dependencies.push(shared.id);
        node.spec.imports.push({
          module: `@/components/${shared.name}`,
          namedImports: [shared.name],
        });
      }
    }
  }

  const root: ComponentNode = {
    id: 'root',
    name: 'Page',
    filePath: 'src/app/page.tsx',
    spec: {
      name: 'Page',
      description: 'Root page component composing all sections',
      isClient: false,
      props: [],
      elements: [],
      animations: [],
      responsiveBreakpoints: [],
      interactionModel: 'static',
      imports: sectionNodes.map((node) => ({
        module: `@/components/${node.name}`,
        namedImports: [node.name],
      })),
    },
    children: sectionNodes,
    dependencies: sectionNodes.map((n) => n.id),
  };

  return { root, sharedComponents };
}

// ---------------------------------------------------------------------------
// Section → ComponentNode
// ---------------------------------------------------------------------------

function buildSectionNode(section: SectionSpec): ComponentNode {
  const name = toPascalCase(section.name) + 'Section';
  const isClient = determineIsClient(section);
  const imports = buildImports(section, isClient);

  const spec: ComponentSpec = {
    name,
    description: `Section: ${section.name}`,
    isClient,
    props: [],
    elements: section.elements,
    animations: section.animations,
    responsiveBreakpoints: section.responsiveBreakpoints,
    interactionModel: section.interactionModel,
    imports,
  };

  return {
    id: section.id,
    name,
    filePath: `src/components/${name}.tsx`,
    section,
    spec,
    children: [],
    dependencies: [],
  };
}

// ---------------------------------------------------------------------------
// Client component detection
// ---------------------------------------------------------------------------

function determineIsClient(section: SectionSpec): boolean {
  if (section.animations.length > 0) return true;
  if (section.interactionModel !== 'static') return true;
  return hasClientElements(section.elements);
}

function hasClientElements(elements: ElementSpec[]): boolean {
  for (const el of elements) {
    // Form elements need client interactivity
    if (['form', 'input', 'textarea', 'select', 'button'].includes(el.tag)) {
      return true;
    }
    // Elements with click/hover states
    if (el.states.some((s) => s.trigger === 'hover' || s.trigger === 'active')) {
      return true;
    }
    // Elements with animations
    if (el.animations.length > 0) return true;
    // Recurse into children
    if (hasClientElements(el.children)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Import generation
// ---------------------------------------------------------------------------

function buildImports(section: SectionSpec, isClient: boolean): ImportSpec[] {
  const imports: ImportSpec[] = [];

  imports.push({ module: '@/lib/utils', namedImports: ['cn'] });

  if (isClient && section.animations.length > 0) {
    const hasFramerMotion = section.animations.some((a) => a.type === 'framer-motion');
    if (hasFramerMotion) {
      imports.push({ module: 'framer-motion', namedImports: ['motion'] });
    }

    const hasGsap = section.animations.some((a) => a.type === 'gsap');
    if (hasGsap) {
      imports.push({ module: 'gsap', defaultImport: 'gsap' });
    }
  }

  // Check for media elements that need next/image
  if (hasImageElements(section.elements)) {
    imports.push({ module: 'next/image', defaultImport: 'Image' });
  }

  // Check for link elements
  if (hasLinkElements(section.elements)) {
    imports.push({ module: 'next/link', defaultImport: 'Link' });
  }

  return imports;
}

function hasImageElements(elements: ElementSpec[]): boolean {
  for (const el of elements) {
    if (el.tag === 'img' || el.media?.type === 'image') return true;
    if (hasImageElements(el.children)) return true;
  }
  return false;
}

function hasLinkElements(elements: ElementSpec[]): boolean {
  for (const el of elements) {
    if (el.tag === 'a' && el.attributes['href']) return true;
    if (hasLinkElements(el.children)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Shared component detection
// ---------------------------------------------------------------------------

interface ElementFingerprint {
  tag: string;
  childTags: string[];
  classCount: number;
}

function detectSharedComponents(
  sections: SectionSpec[],
  nodes: ComponentNode[],
): SharedComponent[] {
  const patternMap = new Map<string, { sectionIds: Set<string>; elements: ElementSpec[]; fingerprint: ElementFingerprint }>();

  for (const section of sections) {
    detectRepeatingPatterns(section.id, section.elements, patternMap);
  }

  const shared: SharedComponent[] = [];

  for (const [key, pattern] of patternMap) {
    if (pattern.sectionIds.size < 2) continue;

    const name = inferSharedComponentName(pattern.elements[0], key);
    const sectionIds = [...pattern.sectionIds];
    const isClient = pattern.elements.some(
      (el) => el.animations.length > 0 || el.states.length > 0,
    );

    shared.push({
      id: `shared-${name}`,
      name,
      usedIn: sectionIds,
      spec: {
        name,
        description: `Shared component detected in ${sectionIds.length} sections`,
        isClient,
        props: inferProps(pattern.elements),
        elements: pattern.elements,
        animations: pattern.elements.flatMap((el) => el.animations),
        responsiveBreakpoints: [],
        interactionModel: isClient ? 'hybrid' : 'static',
        imports: [{ module: '@/lib/utils', namedImports: ['cn'] }],
      },
    });
  }

  return shared;
}

function detectRepeatingPatterns(
  sectionId: string,
  elements: ElementSpec[],
  patternMap: Map<string, { sectionIds: Set<string>; elements: ElementSpec[]; fingerprint: ElementFingerprint }>,
): void {
  // Look for sibling groups with similar structure
  for (const el of elements) {
    // Cards: elements with similar structure among siblings
    if (el.children.length >= 2) {
      const groups = groupSimilarSiblings(el.children);
      for (const group of groups) {
        if (group.length < 2) continue;
        const fp = fingerprint(group[0]);
        const key = `${fp.tag}|${fp.childTags.join(',')}|${fp.classCount}`;

        const existing = patternMap.get(key);
        if (existing) {
          existing.sectionIds.add(sectionId);
          existing.elements.push(...group);
        } else {
          patternMap.set(key, {
            sectionIds: new Set([sectionId]),
            elements: group,
            fingerprint: fp,
          });
        }
      }
    }

    // Nav items
    if (el.tag === 'nav') {
      const links = el.children.filter((c) => c.tag === 'a');
      if (links.length >= 2) {
        const key = 'nav-item';
        const existing = patternMap.get(key);
        if (existing) {
          existing.sectionIds.add(sectionId);
        } else {
          patternMap.set(key, {
            sectionIds: new Set([sectionId]),
            elements: links,
            fingerprint: fingerprint(links[0]),
          });
        }
      }
    }

    // List items
    if (el.tag === 'ul' || el.tag === 'ol') {
      const items = el.children.filter((c) => c.tag === 'li');
      if (items.length >= 2) {
        const fp = fingerprint(items[0]);
        const key = `li|${fp.childTags.join(',')}`;
        const existing = patternMap.get(key);
        if (existing) {
          existing.sectionIds.add(sectionId);
        } else {
          patternMap.set(key, {
            sectionIds: new Set([sectionId]),
            elements: items,
            fingerprint: fp,
          });
        }
      }
    }

    // Recurse
    detectRepeatingPatterns(sectionId, el.children, patternMap);
  }
}

function fingerprint(el: ElementSpec): ElementFingerprint {
  return {
    tag: el.tag,
    childTags: el.children.map((c) => c.tag),
    classCount: el.classes.length,
  };
}

function groupSimilarSiblings(elements: ElementSpec[]): ElementSpec[][] {
  const groups: ElementSpec[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < elements.length; i++) {
    if (visited.has(i)) continue;
    const group = [elements[i]];
    visited.add(i);
    const fpA = fingerprint(elements[i]);

    for (let j = i + 1; j < elements.length; j++) {
      if (visited.has(j)) continue;
      const fpB = fingerprint(elements[j]);
      if (isSimilarFingerprint(fpA, fpB)) {
        group.push(elements[j]);
        visited.add(j);
      }
    }

    if (group.length >= 2) {
      groups.push(group);
    }
  }

  return groups;
}

function isSimilarFingerprint(a: ElementFingerprint, b: ElementFingerprint): boolean {
  if (a.tag !== b.tag) return false;
  if (a.childTags.length !== b.childTags.length) return false;
  return a.childTags.every((tag, idx) => tag === b.childTags[idx]);
}

function inferSharedComponentName(el: ElementSpec, key: string): string {
  // Try to derive a name from classes
  const className = el.classes.find((c) =>
    !c.startsWith('w-') && !c.startsWith('h-') && !c.startsWith('p-') &&
    !c.startsWith('m-') && !c.startsWith('flex') && !c.startsWith('grid'),
  );
  if (className) return toPascalCase(className);

  // Fall back to tag + "Card" or "Item"
  if (el.tag === 'li') return 'ListItem';
  if (el.tag === 'a') return 'NavItem';
  return toPascalCase(key.split('|')[0]) + 'Card';
}

function inferProps(elements: ElementSpec[]): PropSpec[] {
  const props: PropSpec[] = [];
  const sample = elements[0];
  if (!sample) return props;

  // If has text content, likely needs a title/label prop
  if (sample.textContent) {
    props.push({ name: 'title', type: 'string', required: true });
  }

  // If has image, needs src prop
  if (sample.media?.type === 'image') {
    props.push({ name: 'imageSrc', type: 'string', required: true });
    if (sample.media.alt) {
      props.push({ name: 'imageAlt', type: 'string', required: true });
    }
  }

  // If has link, needs href
  if (sample.tag === 'a' || sample.children.some((c) => c.tag === 'a')) {
    props.push({ name: 'href', type: 'string', required: true });
  }

  return props;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
