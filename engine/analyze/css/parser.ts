/**
 * CSS discovery and parsing.
 *
 * - Walks a clone directory recursively for `*.css` files.
 * - Parses `<style>...</style>` blocks from `index.html`.
 * - Uses postcss to walk every rule into a flat CssRule[] list with media
 *   query context, source line/file provenance, and CSS specificity.
 *
 * postcss handles modern features (oklch, container queries, :has, layers)
 * by default; it does NOT error on unknown at-rules or selectors.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import postcss, { type AtRule, type Rule } from 'postcss';
import type {
  CssDeclaration,
  CssRule,
  CssSource,
  Specificity,
} from './types';

const HTML_INLINE_STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

export interface DiscoveredSources {
  sources: CssSource[];
}

export interface ParsedCss {
  sources: CssSource[];
  rules: CssRule[];
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverCssSources(cloneDir: string): DiscoveredSources {
  const sources: CssSource[] = [];

  const cssFiles = walkForExt(cloneDir, '.css');
  for (const abs of cssFiles) {
    const css = safeReadText(abs);
    if (css === null) continue;
    sources.push({
      id: relative(cloneDir, abs).split(sep).join('/'),
      file: relative(cloneDir, abs).split(sep).join('/'),
      css,
      startLine: 1,
    });
  }

  const indexPath = join(cloneDir, 'index.html');
  const html = safeReadText(indexPath);
  if (html !== null) {
    const inlines = extractInlineStyles(html);
    inlines.forEach((block, idx) => {
      sources.push({
        id: `inline:${idx + 1}`,
        file: 'index.html',
        css: block.css,
        startLine: block.startLine,
      });
    });
  }

  return { sources };
}

interface InlineBlock {
  css: string;
  /** 1-based line number where the opening `<style>` tag appears. */
  startLine: number;
}

function extractInlineStyles(html: string): InlineBlock[] {
  const out: InlineBlock[] = [];
  HTML_INLINE_STYLE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_INLINE_STYLE_RE.exec(html)) !== null) {
    const before = html.slice(0, match.index);
    const startLine = countLines(before) + 1;
    out.push({ css: match[1], startLine });
  }
  return out;
}

function countLines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n;
}

function walkForExt(root: string, ext: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.git')) continue;
        stack.push(full);
      } else if (st.isFile() && name.toLowerCase().endsWith(ext)) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function safeReadText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseSources(sources: CssSource[]): ParsedCss {
  const rules: CssRule[] = [];
  for (const src of sources) {
    let root;
    try {
      root = postcss.parse(src.css, { from: src.file });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[extract-css] skip ${src.id}: parse failed (${msg})`);
      continue;
    }

    root.walkRules((rule) => {
      const media = findEnclosingMedia(rule);
      const declarations = collectDeclarations(rule);
      if (declarations.length === 0) return;

      const lineWithinSource = rule.source?.start?.line ?? 1;
      const reportedLine = src.startLine === 1
        ? lineWithinSource
        : src.startLine + lineWithinSource - 1;

      const selectors = splitSelectorList(rule.selector);
      for (const selector of selectors) {
        rules.push({
          selector,
          declarations,
          mediaQuery: media,
          source: { file: src.file, line: reportedLine },
          specificity: computeSpecificity(selector),
        });
      }
    });
  }
  return { sources, rules };
}

function collectDeclarations(rule: Rule): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  rule.walkDecls((decl) => {
    out.push({ prop: decl.prop, value: decl.value });
  });
  return out;
}

function findEnclosingMedia(rule: Rule): string | null {
  let parent = rule.parent;
  while (parent) {
    if (parent.type === 'atrule') {
      const at = parent as AtRule;
      if (at.name === 'media') return `@media ${at.params}`.trim();
      if (at.name === 'supports') return `@supports ${at.params}`.trim();
      if (at.name === 'container') return `@container ${at.params}`.trim();
    }
    parent = parent.parent;
  }
  return null;
}

function splitSelectorList(selectorList: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorList) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) out.push(tail);
  return out;
}

// ---------------------------------------------------------------------------
// Specificity calculation
// ---------------------------------------------------------------------------

/**
 * Computes CSS specificity as [ids, classes/attrs/pseudo-classes, types/pseudo-elements].
 *
 * Approximation that matches https://www.w3.org/TR/selectors-4/#specificity rules
 * for typical selectors. Functional pseudo-classes like :is()/:not()/:where()
 * are handled simply: :where() contributes 0; :is()/:not() pick max from inner.
 */
export function computeSpecificity(selector: string): Specificity {
  const sanitized = stripStrings(selector);
  return tally(sanitized);
}

function stripStrings(s: string): string {
  return s.replace(/(['"])(?:\\.|(?!\1).)*\1/g, '""');
}

function tally(selector: string): Specificity {
  let ids = 0;
  let classes = 0;
  let types = 0;

  let i = 0;
  while (i < selector.length) {
    const ch = selector[i];

    if (ch === '#') {
      i += consumeIdent(selector, i + 1) + 1;
      ids++;
      continue;
    }

    if (ch === '.') {
      i += consumeIdent(selector, i + 1) + 1;
      classes++;
      continue;
    }

    if (ch === '[') {
      const end = selector.indexOf(']', i);
      i = end === -1 ? selector.length : end + 1;
      classes++;
      continue;
    }

    if (ch === ':') {
      const isPseudoElement = selector[i + 1] === ':';
      const nameStart = i + (isPseudoElement ? 2 : 1);
      const nameLen = consumeIdent(selector, nameStart);
      const name = selector.slice(nameStart, nameStart + nameLen).toLowerCase();
      i = nameStart + nameLen;

      let argSpec: Specificity = [0, 0, 0];
      if (selector[i] === '(') {
        const depthEnd = findClosingParen(selector, i);
        const inner = selector.slice(i + 1, depthEnd);
        argSpec = maxInnerSpecificity(inner);
        i = depthEnd + 1;
      }

      if (isPseudoElement) {
        types++;
      } else if (name === 'where') {
        // contributes nothing
      } else if (name === 'is' || name === 'not' || name === 'has') {
        ids += argSpec[0];
        classes += argSpec[1];
        types += argSpec[2];
      } else {
        classes++;
      }
      continue;
    }

    if (/[a-zA-Z*_-]/.test(ch)) {
      const len = consumeIdent(selector, i);
      if (len > 0) {
        const ident = selector.slice(i, i + len);
        if (ident !== '*') types++;
        i += len;
        continue;
      }
    }

    i++;
  }

  return [ids, classes, types];
}

function consumeIdent(s: string, start: number): number {
  let i = start;
  while (i < s.length && /[\w-]/.test(s[i])) i++;
  return i - start;
}

function findClosingParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return s.length;
}

function maxInnerSpecificity(inner: string): Specificity {
  const parts = splitSelectorList(inner);
  let best: Specificity = [0, 0, 0];
  for (const p of parts) {
    const spec = tally(p);
    if (compareSpec(spec, best) > 0) best = spec;
  }
  return best;
}

function compareSpec(a: Specificity, b: Specificity): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}
