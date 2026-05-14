/**
 * Phase 8: wire token, override, base styles and animation modules
 * into SiteLayout.astro using Astro's idiomatic frontmatter imports
 * and Vite's import.meta.glob. Idempotent via marker comments.
 *
 * Cascade contract (LOCKED — do not reorder STYLE_FILES):
 *   1. tokens.css     — CSS variables only, no applied rules
 *   2. overrides.css  — client variable overrides
 *   3. base.css       — aggressive-mode only; skipped if file is missing
 *
 * Astro emits frontmatter imports as <link> tags BEFORE the template
 * body's <head> contents. Captured global stylesheets referenced in
 * the body therefore load AFTER these imports and win on conflicts.
 *
 * The import.meta.glob animations block sits AFTER <slot/> in the body.
 * Animation modules are side-effect configs only, so load order vs
 * other body scripts does not affect parity.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, sep } from 'node:path';

import type { InlineResult, OrchestratorContext } from './types';

const STYLES_START = '// dr-parity:wire-styles-start';
const STYLES_END = '// dr-parity:wire-styles-end';
const ANIM_START = '<!-- dr-parity:wire-animations-start -->';
const ANIM_END = '<!-- dr-parity:wire-animations-end -->';
const LEGACY_START = '<!-- dr-parity:wire-start -->';
const LEGACY_END = '<!-- dr-parity:wire-end -->';

const STYLE_FILES = ['tokens.css', 'overrides.css', 'base.css'] as const;

function toPosix(input: string): string {
  return input.split(sep).join('/');
}

function posixRelative(from: string, to: string): string {
  return posix.relative(toPosix(from), toPosix(to));
}

function collectAnimationModules(animationsDir: string): string[] {
  if (!existsSync(animationsDir)) return [];
  return readdirSync(animationsDir)
    .filter((name) => /\.(ts|js|mjs)$/.test(name))
    .filter((name) => name !== 'index.ts' && name !== 'index.js' && name !== 'index.mjs')
    .sort();
}

function existingStyles(stylesDir: string): string[] {
  if (!existsSync(stylesDir)) return [];
  return STYLE_FILES.filter((file) => existsSync(join(stylesDir, file)));
}

function buildStylesBlock(layoutDir: string, stylesDir: string): string {
  const files = existingStyles(stylesDir);
  if (files.length === 0) return '';
  const rel = posixRelative(layoutDir, stylesDir);
  const prefix = rel === '' ? './' : rel.startsWith('.') ? `${rel}/` : `./${rel}/`;
  const lines = [STYLES_START];
  for (const file of files) {
    lines.push(`import '${prefix}${file}';`);
  }
  lines.push(STYLES_END);
  return lines.join('\n');
}

function buildAnimationsBlock(layoutDir: string, animationsDir: string): string {
  const modules = collectAnimationModules(animationsDir);
  if (modules.length === 0) return '';
  const rel = posixRelative(layoutDir, animationsDir);
  const prefix = rel === '' ? './' : rel.startsWith('.') ? `${rel}/` : `./${rel}/`;
  const globPattern = `${prefix}*.ts`;
  return [
    ANIM_START,
    '<script>',
    `  const modules = import.meta.glob('${globPattern}', { eager: true });`,
    '  void modules;',
    '</script>',
    ANIM_END,
  ].join('\n');
}

function stripLegacyMarkers(source: string): string {
  if (!source.includes(LEGACY_START) || !source.includes(LEGACY_END)) return source;
  const startIdx = source.indexOf(LEGACY_START);
  const endIdx = source.indexOf(LEGACY_END, startIdx);
  if (startIdx < 0 || endIdx < 0) return source;
  const end = endIdx + LEGACY_END.length;
  let before = source.slice(0, startIdx);
  let after = source.slice(end);
  if (before.endsWith('\n')) before = before.slice(0, -1);
  if (after.startsWith('\n')) after = after.slice(1);
  return before + after;
}

function splitFrontmatter(source: string): {
  hasFrontmatter: boolean;
  frontmatter: string;
  body: string;
} {
  if (source.startsWith('---\n')) {
    const close = source.indexOf('\n---', 4);
    if (close > 0) {
      const frontmatter = source.slice(4, close);
      const afterEnd = close + 4;
      const body = source.slice(afterEnd).replace(/^\n/, '');
      return { hasFrontmatter: true, frontmatter, body };
    }
  }
  return { hasFrontmatter: false, frontmatter: '', body: source };
}

function injectStylesIntoFrontmatter(frontmatter: string, stylesBlock: string): string {
  const startIdx = frontmatter.indexOf(STYLES_START);
  const endIdx = frontmatter.indexOf(STYLES_END);
  if (startIdx >= 0 && endIdx > startIdx) {
    const end = endIdx + STYLES_END.length;
    let before = frontmatter.slice(0, startIdx);
    let after = frontmatter.slice(end);
    if (before.endsWith('\n')) before = before.slice(0, -1);
    if (after.startsWith('\n')) after = after.slice(1);
    if (stylesBlock === '') {
      const joiner = before && after ? '\n' : '';
      return `${before}${joiner}${after}`;
    }
    const head = before ? `${before}\n` : '';
    const tail = after ? `\n${after}` : '';
    return `${head}${stylesBlock}${tail}`;
  }
  if (stylesBlock === '') return frontmatter;
  return frontmatter ? `${stylesBlock}\n${frontmatter}` : stylesBlock;
}

function injectAnimationsBlock(body: string, animationsBlock: string): string {
  const stripped = (() => {
    const startIdx = body.indexOf(ANIM_START);
    const endIdx = body.indexOf(ANIM_END);
    if (startIdx < 0 || endIdx < 0) return body;
    const end = endIdx + ANIM_END.length;
    let before = body.slice(0, startIdx);
    let after = body.slice(end);
    if (before.endsWith('\n')) before = before.slice(0, -1);
    if (after.startsWith('\n')) after = after.slice(1);
    const joiner = before && after ? '\n' : '';
    return `${before}${joiner}${after}`;
  })();

  if (animationsBlock === '') return stripped;

  const slotMatch = stripped.match(/<slot\s*\/>|<slot\s*>\s*<\/slot>/i);
  if (slotMatch && slotMatch.index !== undefined) {
    const insertAt = slotMatch.index + slotMatch[0].length;
    return `${stripped.slice(0, insertAt)}\n${animationsBlock}${stripped.slice(insertAt)}`;
  }

  const bodyCloseIdx = stripped.search(/<\/body\s*>/i);
  if (bodyCloseIdx >= 0) {
    return `${stripped.slice(0, bodyCloseIdx)}${animationsBlock}\n${stripped.slice(bodyCloseIdx)}`;
  }

  return stripped.endsWith('\n')
    ? `${stripped}${animationsBlock}\n`
    : `${stripped}\n${animationsBlock}\n`;
}

function ensureLayout(layoutPath: string): string {
  if (existsSync(layoutPath)) return readFileSync(layoutPath, 'utf8');
  mkdirSync(dirname(layoutPath), { recursive: true });
  const stub = `---\n---\n<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="utf-8" />\n  </head>\n  <body>\n    <slot />\n  </body>\n</html>\n`;
  writeFileSync(layoutPath, stub, 'utf8');
  return stub;
}

function assembleLayout(frontmatter: string, body: string): string {
  const fm = frontmatter.replace(/^\n+/, '').replace(/\n+$/, '');
  const bodyTrimmed = body.replace(/^\n+/, '');
  return `---\n${fm}\n---\n${bodyTrimmed}`;
}

export async function wireLayout(ctx: OrchestratorContext): Promise<InlineResult> {
  if (!ctx?.outDir || typeof ctx.outDir !== 'string') {
    throw new Error('wireLayout: ctx.outDir is required and must be a string');
  }

  const layoutPath = join(ctx.outDir, 'src/layouts/SiteLayout.astro');
  const layoutDir = dirname(layoutPath);
  const stylesDir = join(ctx.outDir, 'src/styles');
  const animationsDir = join(ctx.outDir, 'src/lib/animations');

  let original: string;
  try {
    original = ensureLayout(layoutPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`wireLayout: failed to read/create layout at ${layoutPath}: ${reason}`);
  }

  const cleaned = stripLegacyMarkers(original);
  const { frontmatter, body } = splitFrontmatter(cleaned);

  const stylesBlock = buildStylesBlock(layoutDir, stylesDir);
  const animationsBlock = buildAnimationsBlock(layoutDir, animationsDir);

  const nextFrontmatter = injectStylesIntoFrontmatter(frontmatter, stylesBlock);
  const nextBody = injectAnimationsBlock(body, animationsBlock);

  const updated = assembleLayout(nextFrontmatter, nextBody);

  if (updated === original) {
    return { outputs: [layoutPath], warning: 'Layout already wired; no changes' };
  }

  try {
    writeFileSync(layoutPath, updated, 'utf8');
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`wireLayout: failed to write layout at ${layoutPath}: ${reason}`);
  }

  const warnings: string[] = [];
  if (stylesBlock === '' && existsSync(stylesDir)) {
    warnings.push(`No style files found in ${stylesDir}`);
  }
  if (animationsBlock === '' && existsSync(animationsDir)) {
    warnings.push(`No animation modules found in ${animationsDir}`);
  }

  const result: InlineResult = { outputs: [layoutPath] };
  if (warnings.length > 0) result.warning = warnings.join('; ');
  return result;
}
