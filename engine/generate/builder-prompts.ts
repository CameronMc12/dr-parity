/**
 * Auto-generates per-section builder prompt files containing ALL raw extraction
 * data a builder agent needs to construct a component -- no human summarization.
 *
 * Each prompt file is a self-contained Markdown document with exact HTML
 * structure, computed styles per element, CSS rules, animations, text content,
 * assets, design tokens, and responsive behavior.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ComponentNode, DesignTokens } from '../types/component';
import type {
  AnimationSpec,
  AssetManifest,
  ElementSpec,
  PageData,
  SectionSpec,
} from '../types/extraction';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BuilderPrompt {
  sectionId: string;
  componentName: string;
  /** Absolute path where the prompt file is written. */
  filePath: string;
  /** Full Markdown prompt text. */
  content: string;
}

export interface PromptGenOptions {
  projectDir: string;
  pageData: PageData;
  tokens: DesignTokens;
  components: ComponentNode[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HTML_BYTES = 30_000;
const PROMPTS_DIR = 'docs/research/prompts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateBuilderPrompts(
  options: PromptGenOptions,
): Promise<BuilderPrompt[]> {
  const { projectDir, pageData, tokens, components } = options;
  const promptsDir = join(projectDir, PROMPTS_DIR);
  await mkdir(promptsDir, { recursive: true });

  const prompts: BuilderPrompt[] = [];

  for (const section of pageData.sections) {
    const component = findComponentForSection(section, components);
    const componentName = component?.name ?? toPascalCase(section.name);
    const targetFile = component?.filePath ?? `src/components/${componentName}.tsx`;

    const slug = slugify(section.name);
    const filename = `section-${section.id}-${slug}.md`;
    const filePath = join(promptsDir, filename);

    const content = buildPromptContent({
      section,
      componentName,
      targetFile,
      tokens,
      assets: pageData.assets,
      promptFilename: filename,
    });

    await writeFile(filePath, content, 'utf-8');

    prompts.push({
      sectionId: section.id,
      componentName,
      filePath,
      content,
    });
  }

  return prompts;
}

// ---------------------------------------------------------------------------
// Prompt content builder
// ---------------------------------------------------------------------------

interface PromptBuildContext {
  section: SectionSpec;
  componentName: string;
  targetFile: string;
  tokens: DesignTokens;
  assets: AssetManifest;
  promptFilename: string;
}

function buildPromptContent(ctx: PromptBuildContext): string {
  const { section, componentName, targetFile, tokens } = ctx;
  const lines: string[] = [];

  // Header
  lines.push(`# Builder Prompt: ${componentName}`);
  lines.push('');

  // Target file
  lines.push('## Target File');
  lines.push(`\`${targetFile}\``);
  lines.push('');

  // Reference screenshot
  lines.push('## Reference Screenshot');
  lines.push(`\`${section.screenshots.desktop}\``);
  if (section.screenshots.tablet) {
    lines.push(`Tablet: \`${section.screenshots.tablet}\``);
  }
  if (section.screenshots.mobile) {
    lines.push(`Mobile: \`${section.screenshots.mobile}\``);
  }
  lines.push('');

  // HTML structure (serialized from element tree)
  lines.push('## HTML Structure (exact DOM from original site)');
  lines.push('```html');
  const html = serializeElementTreeToHtml(section.elements);
  lines.push(truncateString(html, MAX_HTML_BYTES));
  lines.push('```');
  lines.push('');

  // Computed styles per element
  lines.push('## Computed Styles Per Element');
  lines.push('');
  appendElementStyles(lines, section.elements, []);

  // CSS rules -- class-based filtering
  const sectionClasses = collectAllClasses(section.elements);
  lines.push('## CSS Classes Used');
  lines.push('');
  lines.push('Classes present in this section (for Tailwind mapping):');
  lines.push('```');
  lines.push(sectionClasses.join(', '));
  lines.push('```');
  lines.push('');

  // Animations
  if (section.animations.length > 0) {
    lines.push('## Animations');
    lines.push('');
    for (let i = 0; i < section.animations.length; i++) {
      appendAnimation(lines, section.animations[i], i + 1);
    }
  }

  // Element-level animations
  const elementAnims = collectElementAnimations(section.elements);
  if (elementAnims.length > 0) {
    lines.push('## Element-Level Animations');
    lines.push('');
    for (let i = 0; i < elementAnims.length; i++) {
      appendAnimation(lines, elementAnims[i], i + 1);
    }
  }

  // Text content
  lines.push('## Text Content (verbatim)');
  lines.push('');
  const textContent = collectTextContent(section.elements);
  for (const text of textContent) {
    lines.push(text);
  }
  lines.push('');

  // Assets used
  const usedAssets = findUsedAssets(section.elements, ctx.assets);
  if (usedAssets.length > 0) {
    lines.push('## Assets Used');
    lines.push('');
    for (const asset of usedAssets) {
      lines.push(`- \`${asset.localPath}\` (original: ${asset.originalUrl})`);
    }
    lines.push('');
  }

  // Design tokens
  lines.push('## Design Tokens');
  lines.push('```css');
  for (const [varName, value] of Object.entries(tokens.cssVariables)) {
    lines.push(`${varName}: ${value};`);
  }
  lines.push('```');
  lines.push('');

  // Responsive behavior
  if (section.responsiveBreakpoints.length > 0) {
    lines.push('## Responsive Behavior');
    lines.push('');
    for (const bp of section.responsiveBreakpoints) {
      lines.push(`### ${bp.width}px`);
      lines.push('');
      for (const change of bp.changes) {
        lines.push(
          `- \`${change.elementSelector}\`: \`${change.property}\` changes from \`${change.desktopValue}\` to \`${change.breakpointValue}\``,
        );
      }
      lines.push('');
    }
  }

  // Section metadata
  lines.push('## Section Metadata');
  lines.push('');
  lines.push(`- **Position:** ${section.position}`);
  lines.push(`- **Z-Index:** ${section.zIndex}`);
  lines.push(`- **Background Color:** ${section.backgroundColor}`);
  lines.push(`- **Interaction Model:** ${section.interactionModel}`);
  lines.push(
    `- **Bounding Rect:** top=${section.boundingRect.top}, left=${section.boundingRect.left}, width=${section.boundingRect.width}, height=${section.boundingRect.height}`,
  );
  lines.push('');

  // Builder instructions
  lines.push('## Instructions');
  lines.push('');
  lines.push(`1. Create \`${targetFile}\``);
  lines.push('2. Translate the HTML structure above to JSX');
  lines.push(
    '3. Use EXACT computed style values -- map to Tailwind where possible, use arbitrary values for non-standard sizes',
  );
  lines.push('4. Implement ALL animations with exact triggers and timing');
  lines.push('5. Use the downloaded assets (local paths in public/)');
  lines.push('6. Handle responsive breakpoints');
  lines.push('7. Add `"use client"` if ANY interactivity is present (animations, scroll, click, hover effects)');
  lines.push('8. Respect `prefers-reduced-motion` for all animations');
  lines.push('9. Verify: `npx tsc --noEmit`');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Element tree serialization
// ---------------------------------------------------------------------------

function serializeElementTreeToHtml(
  elements: ElementSpec[],
  depth: number = 0,
): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const el of elements) {
    const attrs = buildHtmlAttrs(el);
    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    if (el.children.length === 0 && !el.textContent && !el.innerHTML) {
      lines.push(`${indent}<${el.tag}${attrStr} />`);
    } else {
      lines.push(`${indent}<${el.tag}${attrStr}>`);
      if (el.innerHTML && el.tag === 'svg') {
        lines.push(`${indent}  ${el.innerHTML}`);
      } else if (el.textContent && el.children.length === 0) {
        lines.push(`${indent}  ${el.textContent}`);
      }
      if (el.children.length > 0) {
        lines.push(serializeElementTreeToHtml(el.children, depth + 1));
      }
      lines.push(`${indent}</${el.tag}>`);
    }
  }

  return lines.join('\n');
}

function buildHtmlAttrs(el: ElementSpec): string[] {
  const attrs: string[] = [];

  if (el.id) {
    attrs.push(`id="${el.id}"`);
  }
  if (el.classes.length > 0) {
    attrs.push(`class="${el.classes.join(' ')}"`);
  }
  for (const [key, value] of Object.entries(el.attributes)) {
    if (key === 'class' || key === 'id') continue;
    attrs.push(`${key}="${escapeAttr(value)}"`);
  }

  return attrs;
}

// ---------------------------------------------------------------------------
// Computed styles per element
// ---------------------------------------------------------------------------

function appendElementStyles(
  lines: string[],
  elements: ElementSpec[],
  selectorPath: string[],
): void {
  for (const el of elements) {
    const selector = buildSelector(el, selectorPath);
    const styleEntries = Object.entries(el.computedStyles);

    if (styleEntries.length > 0) {
      const tagDesc = el.classes.length > 0
        ? `${el.tag}.${el.classes.join('.')}`
        : el.tag;
      lines.push(`### ${tagDesc} (\`${selector}\`)`);
      lines.push('```json');
      lines.push(JSON.stringify(el.computedStyles, null, 2));
      lines.push('```');
      lines.push('');
    }

    if (el.states.length > 0) {
      lines.push(`#### States for \`${selector}\``);
      for (const state of el.states) {
        lines.push(`**${state.trigger}:**`);
        lines.push('```json');
        lines.push(JSON.stringify(state.styleChanges, null, 2));
        lines.push('```');
        if (state.transition) {
          lines.push(`Transition: \`${state.transition}\``);
        }
        lines.push('');
      }
    }

    // Recurse into children
    appendElementStyles(lines, el.children, [...selectorPath, buildSelectorSegment(el)]);
  }
}

function buildSelector(el: ElementSpec, path: string[]): string {
  const segment = buildSelectorSegment(el);
  return [...path, segment].join(' > ');
}

function buildSelectorSegment(el: ElementSpec): string {
  if (el.id) return `#${el.id}`;
  if (el.classes.length > 0) return `${el.tag}.${el.classes[0]}`;
  return el.tag;
}

// ---------------------------------------------------------------------------
// Animation formatting
// ---------------------------------------------------------------------------

function appendAnimation(
  lines: string[],
  anim: AnimationSpec,
  index: number,
): void {
  lines.push(`### Animation ${index}: ${anim.humanDescription}`);
  lines.push(`- **Type:** ${anim.type}`);
  lines.push(`- **Trigger:** ${formatTrigger(anim)}`);
  lines.push(`- **Element:** \`${anim.elementSelector}\``);

  for (const prop of anim.properties) {
    lines.push(`- **Property:** \`${prop.property}\`: \`${prop.from}\` -> \`${prop.to}\``);
  }

  lines.push(`- **Duration:** ${anim.duration}ms`);
  lines.push(`- **Easing:** ${anim.easing}`);
  lines.push(`- **Delay:** ${anim.delay}ms`);
  lines.push(`- **Iterations:** ${anim.iterations}`);
  lines.push(`- **Direction:** ${anim.direction}`);
  lines.push(`- **Fill Mode:** ${anim.fillMode}`);

  if (anim.library) {
    lines.push(
      `- **Library:** ${anim.library.name}${anim.library.version ? ` v${anim.library.version}` : ''} (npm: ${anim.library.npmPackage ?? 'n/a'})`,
    );
  }

  if (anim.keyframes && anim.keyframes.length > 0) {
    lines.push('- **Keyframes:**');
    lines.push('```json');
    lines.push(JSON.stringify(anim.keyframes, null, 2));
    lines.push('```');
  }

  lines.push(`- **Implementation Notes:** ${anim.implementationNotes}`);

  if (anim.codeSnippet) {
    lines.push('- **Code Snippet:**');
    lines.push('```tsx');
    lines.push(anim.codeSnippet);
    lines.push('```');
  }

  lines.push('');
}

function formatTrigger(anim: AnimationSpec): string {
  const t = anim.trigger;
  const parts: string[] = [`type=${t.type}`];

  if (t.threshold !== undefined) parts.push(`threshold=${t.threshold}`);
  if (t.rootMargin) parts.push(`rootMargin="${t.rootMargin}"`);
  if (t.scrollStart !== undefined) parts.push(`scrollStart=${t.scrollStart}px`);
  if (t.scrollEnd !== undefined) parts.push(`scrollEnd=${t.scrollEnd}px`);
  if (t.scrollContainer) parts.push(`container="${t.scrollContainer}"`);
  if (t.targetElement) parts.push(`target="${t.targetElement}"`);
  if (t.delay !== undefined) parts.push(`delay=${t.delay}ms`);

  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Content collectors
// ---------------------------------------------------------------------------

function collectTextContent(elements: ElementSpec[]): string[] {
  const texts: string[] = [];

  for (const el of elements) {
    if (el.textContent && el.children.length === 0) {
      texts.push(el.textContent);
    }
    texts.push(...collectTextContent(el.children));
  }

  return texts;
}

function collectAllClasses(elements: ElementSpec[]): string[] {
  const classes = new Set<string>();

  for (const el of elements) {
    for (const cls of el.classes) {
      classes.add(cls);
    }
    for (const cls of collectAllClasses(el.children)) {
      classes.add(cls);
    }
  }

  return [...classes].sort();
}

function collectElementAnimations(elements: ElementSpec[]): AnimationSpec[] {
  const anims: AnimationSpec[] = [];

  for (const el of elements) {
    anims.push(...el.animations);
    anims.push(...collectElementAnimations(el.children));
  }

  return anims;
}

// ---------------------------------------------------------------------------
// Asset matching
// ---------------------------------------------------------------------------

interface AssetRef {
  localPath: string;
  originalUrl: string;
}

function findUsedAssets(
  elements: ElementSpec[],
  manifest: AssetManifest,
): AssetRef[] {
  const usedUrls = new Set<string>();
  collectAssetUrls(elements, usedUrls);

  const refs: AssetRef[] = [];
  const allEntries = [
    ...manifest.images,
    ...manifest.videos,
    ...manifest.svgs,
    ...manifest.other,
  ];

  for (const entry of allEntries) {
    if (usedUrls.has(entry.originalUrl) || usedUrls.has(entry.localPath)) {
      refs.push({
        localPath: entry.localPath,
        originalUrl: entry.originalUrl,
      });
    }
  }

  return refs;
}

function collectAssetUrls(
  elements: ElementSpec[],
  urls: Set<string>,
): void {
  for (const el of elements) {
    // Check media src
    if (el.media?.src) urls.add(el.media.src);
    if (el.media?.localPath) urls.add(el.media.localPath);

    // Check background-image in computed styles
    const bgImage = el.computedStyles['background-image'] ?? el.computedStyles['backgroundImage'];
    if (bgImage && bgImage !== 'none') {
      const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (urlMatch?.[1]) urls.add(urlMatch[1]);
    }

    // Check src attribute
    if (el.attributes['src']) urls.add(el.attributes['src']);

    collectAssetUrls(el.children, urls);
  }
}

// ---------------------------------------------------------------------------
// Component matching
// ---------------------------------------------------------------------------

function findComponentForSection(
  section: SectionSpec,
  components: ComponentNode[],
): ComponentNode | undefined {
  return components.find(
    (c) => c.section?.id === section.id || c.id === section.id,
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncateString(str: string, maxBytes: number): string {
  if (Buffer.byteLength(str, 'utf-8') <= maxBytes) return str;

  // Binary search for the truncation point
  let low = 0;
  let high = str.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (Buffer.byteLength(str.slice(0, mid), 'utf-8') <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return str.slice(0, low) + '\n<!-- truncated -->';
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/&/g, '&amp;');
}
