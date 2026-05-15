/**
 * Emit per-component scoped style blocks and the shared base.css.
 *
 * Per-component output is an `<style is:global>` block appended to the .astro
 * file (or replacing a previous generated block, keyed by a deterministic
 * marker comment). All rules are serialised back to CSS preserving the
 * original source order, !important flags, vendor prefixes, and @media
 * wrappers. Each rule is emitted exactly once per component bucket.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CssRule } from '../analyze/css/types';
import type { AssignmentResult, ComponentInfo, SubstitutionStats } from './types';
import { substituteDeclarations } from './substitute';
// MEDIA-AGENT: aggressive emit defers to the media-preserve marker block
// when it already exists in base.css, so the same @media rules aren't
// emitted twice (once verbatim by media-preserve, once token-substituted
// by aggressive scope-styles).
import { MEDIA_BLOCK_START, MEDIA_BLOCK_END } from './media-preserve';

const BLOCK_START = '<!-- dr-parity:scope-styles:start -->';
const BLOCK_END = '<!-- dr-parity:scope-styles:end -->';
const BLOCK_START_RE = /<!--\s*dr-parity:scope-styles:start\s*-->/;
const BLOCK_END_RE = /<!--\s*dr-parity:scope-styles:end\s*-->/;

export interface EmitOptions {
  rules: CssRule[];
  assignment: AssignmentResult;
  components: ComponentInfo[];
  substitutionTable: Map<string, string>;
  substitutionStats: SubstitutionStats;
  stylesOutDir: string;
  force: boolean;
}

export interface EmitResult {
  componentFilesWritten: number;
  baseCssPath: string;
  perComponentCounts: Map<string, number>;
}

export function emit(options: EmitOptions): EmitResult {
  const {
    rules,
    assignment,
    components,
    substitutionTable,
    substitutionStats,
    stylesOutDir,
    force,
  } = options;

  const perComponentCounts = new Map<string, number>();
  let written = 0;

  for (const component of components) {
    const indices = assignment.perComponent.get(component.filePath) ?? [];
    if (indices.length === 0) {
      perComponentCounts.set(component.filePath, 0);
      stripGeneratedBlock(component.filePath, force);
      continue;
    }
    const componentRules = indices.map((i) => rules[i]);
    const css = serialiseRules(componentRules, substitutionTable, substitutionStats);
    upsertGeneratedBlock(component.filePath, css, force);
    perComponentCounts.set(component.filePath, indices.length);
    written++;
  }

  const globalRules = assignment.global.map((i) => rules[i]);
  const baseCssPath = writeBaseCss(stylesOutDir, globalRules, substitutionTable, substitutionStats);

  return {
    componentFilesWritten: written,
    baseCssPath,
    perComponentCounts,
  };
}

function serialiseRules(
  rules: CssRule[],
  table: Map<string, string>,
  stats: SubstitutionStats,
): string {
  const groups = groupByMedia(rules);
  const out: string[] = [];
  for (const { media, items } of groups) {
    if (media === null) {
      for (const r of items) out.push(serialiseRule(r, table, stats, 0));
    } else {
      out.push(`${media} {`);
      for (const r of items) out.push(serialiseRule(r, table, stats, 2));
      out.push('}');
    }
  }
  return out.join('\n');
}

interface MediaGroup {
  media: string | null;
  items: CssRule[];
}

/**
 * Preserve original order: stream the rules and start a new group whenever the
 * media-query context changes. This keeps the cascade identical to the source
 * even when rules from different media queries are interleaved.
 */
function groupByMedia(rules: CssRule[]): MediaGroup[] {
  const groups: MediaGroup[] = [];
  let current: MediaGroup | null = null;
  for (const r of rules) {
    if (!current || current.media !== r.mediaQuery) {
      current = { media: r.mediaQuery, items: [] };
      groups.push(current);
    }
    current.items.push(r);
  }
  return groups;
}

function serialiseRule(
  rule: CssRule,
  table: Map<string, string>,
  stats: SubstitutionStats,
  indent: number,
): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  const decls = substituteDeclarations(rule.declarations, table, stats);
  const body = decls.map((d) => `${inner}${d.prop}: ${d.value};`).join('\n');
  return `${pad}${rule.selector} {\n${body}\n${pad}}`;
}

function upsertGeneratedBlock(astroPath: string, css: string, force: boolean): void {
  const source = readFileSync(astroPath, 'utf8');
  const block = buildBlock(css);

  const stripped = stripExistingBlock(source);
  if (stripped === source && hasManualStyle(source) && !force) {
    throw new Error(
      `Refusing to overwrite manual <style> block in ${astroPath} (re-run with --force)`,
    );
  }
  const next = ensureTrailingNewline(stripped) + block + '\n';
  writeFileSync(astroPath, next, 'utf8');
}

function stripGeneratedBlock(astroPath: string, _force: boolean): void {
  void _force;
  let source: string;
  try {
    source = readFileSync(astroPath, 'utf8');
  } catch {
    return;
  }
  const stripped = stripExistingBlock(source);
  if (stripped !== source) {
    writeFileSync(astroPath, stripped, 'utf8');
  }
}

function buildBlock(css: string): string {
  return [
    BLOCK_START,
    '<style is:global>',
    css,
    '</style>',
    BLOCK_END,
  ].join('\n');
}

function stripExistingBlock(source: string): string {
  if (!BLOCK_START_RE.test(source) || !BLOCK_END_RE.test(source)) return source;
  const startMatch = source.match(BLOCK_START_RE);
  const endMatch = source.match(BLOCK_END_RE);
  if (!startMatch || !endMatch) return source;
  const startIdx = startMatch.index!;
  const endIdx = endMatch.index! + endMatch[0].length;
  const before = source.slice(0, startIdx).replace(/\s+$/, '');
  const after = source.slice(endIdx).replace(/^\s+/, '');
  if (!after) return before + '\n';
  return `${before}\n${after}`;
}

function hasManualStyle(source: string): boolean {
  return /<style\b/i.test(source);
}

function ensureTrailingNewline(s: string): string {
  if (s.endsWith('\n')) return s;
  return s + '\n';
}

function writeBaseCss(
  stylesOutDir: string,
  rules: CssRule[],
  table: Map<string, string>,
  stats: SubstitutionStats,
): string {
  mkdirSync(stylesOutDir, { recursive: true });
  const baseCssPath = join(stylesOutDir, 'base.css');
  const header =
    '/* Generated by dr-parity scope-styles. Global resets + cross-component rules. */\n';

  // MEDIA-AGENT: if media-preserve has already written a marker block into
  // base.css, drop media-wrapped rules from the global set here to avoid
  // duplication. Then re-append the preserved marker block verbatim.
  const preservedMediaBlock = readPreservedMediaBlock(baseCssPath);
  const rulesForBody = preservedMediaBlock ? rules.filter((r) => !r.mediaQuery) : rules;

  const body = serialiseRules(rulesForBody, table, stats);
  const baseBody = body.length > 0 ? header + body + '\n' : header;
  const out = preservedMediaBlock ? `${baseBody}${preservedMediaBlock}\n` : baseBody;

  mkdirSync(dirname(baseCssPath), { recursive: true });
  writeFileSync(baseCssPath, out, 'utf8');
  return baseCssPath;
}

function readPreservedMediaBlock(baseCssPath: string): string | null {
  if (!existsSync(baseCssPath)) return null;
  const source = readFileSync(baseCssPath, 'utf8');
  const startIdx = source.indexOf(MEDIA_BLOCK_START);
  const endIdx = source.indexOf(MEDIA_BLOCK_END);
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return null;
  return source.slice(startIdx, endIdx + MEDIA_BLOCK_END.length);
}
