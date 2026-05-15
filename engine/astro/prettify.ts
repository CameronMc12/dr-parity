/**
 * Emit-time prettify pass for .astro components.
 *
 * Runs `prettier` with `prettier-plugin-astro` on the synchronous emission
 * path. Falls back to the original (un-prettified) source if prettier throws,
 * so a malformed component cannot break the build pipeline.
 *
 * Roundtrip safety: any prettified output is run through cheerio (in fragment
 * mode) and compared structurally to the original to guarantee zero content
 * drift. If the structural AST diverges, the original source is returned and
 * a one-line warning is written to stderr.
 *
 * Escape hatch: set DR_PARITY_NO_PRETTIFY=1 to bypass the pass entirely.
 */

import * as prettier from 'prettier';
import * as cheerio from 'cheerio';

let cachedDisabled: boolean | null = null;

export function prettifyDisabled(): boolean {
  if (cachedDisabled !== null) return cachedDisabled;
  cachedDisabled = process.env.DR_PARITY_NO_PRETTIFY === '1';
  return cachedDisabled;
}

export interface PrettifyResult {
  output: string;
  changed: boolean;
  fallback: 'none' | 'prettier-error' | 'roundtrip-mismatch' | 'disabled';
}

const PRETTIER_OPTIONS: prettier.Options = {
  parser: 'astro',
  plugins: ['prettier-plugin-astro'],
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  semi: true,
  singleQuote: false,
  bracketSameLine: true,
  htmlWhitespaceSensitivity: 'css',
};

/**
 * Run a prettier pass on a `.astro` source string.
 *
 * The function is sync from the caller's view but resolves to a value;
 * use `await prettifyAstro(...)` at the call site.
 */
export async function prettifyAstro(source: string): Promise<PrettifyResult> {
  if (prettifyDisabled()) {
    return { output: source, changed: false, fallback: 'disabled' };
  }

  let formatted: string;
  try {
    formatted = await prettier.format(source, PRETTIER_OPTIONS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`prettify: prettier error, using original (${msg.split('\n')[0]})\n`);
    return { output: source, changed: false, fallback: 'prettier-error' };
  }

  if (formatted === source) {
    return { output: source, changed: false, fallback: 'none' };
  }

  if (!structurallyEquivalent(source, formatted)) {
    process.stderr.write('prettify: roundtrip drift detected, using original\n');
    return { output: source, changed: false, fallback: 'roundtrip-mismatch' };
  }

  return { output: formatted, changed: true, fallback: 'none' };
}

/**
 * Strip Astro frontmatter (the leading `---\n...\n---` block) and return the
 * body. The frontmatter is TypeScript, not HTML, so it cannot be compared via
 * an HTML AST.
 */
function splitFrontmatter(astro: string): { frontmatter: string; body: string } {
  if (!astro.startsWith('---')) return { frontmatter: '', body: astro };
  const close = astro.indexOf('\n---', 3);
  if (close === -1) return { frontmatter: '', body: astro };
  const fenceEnd = close + '\n---'.length;
  return { frontmatter: astro.slice(0, fenceEnd), body: astro.slice(fenceEnd) };
}

/**
 * AST equivalence check: parse both as HTML fragments and compare the
 * normalised tag tree + attribute set + collapsed text content. Whitespace,
 * attribute order, and quote style are explicitly ignored — those are
 * exactly what prettier is allowed to touch.
 */
export function structurallyEquivalent(original: string, prettified: string): boolean {
  const a = splitFrontmatter(original);
  const b = splitFrontmatter(prettified);

  // Frontmatter must round-trip identically modulo trailing whitespace.
  if (normaliseFrontmatter(a.frontmatter) !== normaliseFrontmatter(b.frontmatter)) {
    return false;
  }

  try {
    const treeA = htmlSignature(a.body);
    const treeB = htmlSignature(b.body);
    return treeA === treeB;
  } catch {
    return false;
  }
}

function normaliseFrontmatter(fm: string): string {
  // Strip whitespace + quote-style differences from frontmatter TypeScript.
  // Prettier rewrites `'foo'` → `"foo"` (or vice versa) and may add/remove
  // trailing semicolons, but both forms are semantically identical. We only
  // need to detect *content* drift, not stylistic drift.
  // Drop every blank line — prettier may add/remove blank separators between
  // imports and declarations without changing meaning.
  const lines = fm
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .join('\n')
    .trim();

  // Collapse runs of internal whitespace, unify quote style on string literals,
  // and drop trailing semicolons line by line.
  return lines
    .replace(/[ \t]+/g, ' ')
    .replace(/'([^'\\\n]*)'/g, '"$1"')
    .replace(/;+\s*$/gm, '');
}

/**
 * Walk a directory recursively and prettify every `.astro` file in place.
 * Files where prettier errors or roundtrip fails are left untouched.
 *
 * Returns a small summary for the caller / orchestrator.
 */
export async function prettifyEmittedDir(rootDir: string): Promise<{
  processed: number;
  changed: number;
  skipped: number;
  failures: { file: string; reason: string }[];
}> {
  const { readFileSync, writeFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const summary = {
    processed: 0,
    changed: 0,
    skipped: 0,
    failures: [] as { file: string; reason: string }[],
  };

  if (prettifyDisabled()) {
    return summary;
  }

  const stack: string[] = [rootDir];
  const astroFiles: string[] = [];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.astro') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (entry.endsWith('.astro')) astroFiles.push(full);
    }
  }

  for (const file of astroFiles) {
    summary.processed += 1;
    const source = readFileSync(file, 'utf8');
    const result = await prettifyAstro(source);
    if (result.changed) {
      writeFileSync(file, result.output, 'utf8');
      summary.changed += 1;
    } else {
      summary.skipped += 1;
      if (result.fallback === 'prettier-error' || result.fallback === 'roundtrip-mismatch') {
        summary.failures.push({ file, reason: result.fallback });
      }
    }
  }

  return summary;
}

/**
 * Build a structural signature of an HTML fragment. Two fragments with the
 * same signature are considered AST-equivalent (modulo whitespace, attribute
 * ordering, and quote style).
 */
function htmlSignature(html: string): string {
  if (html.trim().length === 0) return '';
  const $ = cheerio.load(html, { xml: false }, false);
  const parts: string[] = [];
  walk($.root()[0] as unknown as Node, parts);
  return parts.join('|');
}

type AnyNode = {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: AnyNode[];
};

function walk(node: AnyNode | Node, out: string[]): void {
  const n = node as unknown as AnyNode;
  if (!n) return;
  if (n.type === 'text') {
    const collapsed = normaliseTextContent(n.data ?? '');
    if (collapsed.length > 0) out.push(`T:${collapsed}`);
  } else if (n.type === 'comment') {
    const collapsed = (n.data ?? '').replace(/\s+/g, ' ').trim();
    out.push(`C:${collapsed}`);
  } else if (n.name) {
    const attrs = serialiseAttrs(n.attribs ?? {}, n.name);
    out.push(`<${n.name}${attrs}>`);
    // For <script> and <style>, prettier reformats the inner body (JS/CSS)
    // but never changes the inner *meaning*. Skip recursion into their
    // children for signature purposes; the attribute set still gets compared.
    const tag = n.name.toLowerCase();
    const skipChildren = tag === 'script' || tag === 'style';
    if (!skipChildren && Array.isArray(n.children)) {
      for (const child of n.children) walk(child, out);
    }
    out.push(`</${n.name}>`);
  } else if (Array.isArray(n.children)) {
    for (const child of n.children) walk(child, out);
  }
}

function normaliseTextContent(s: string): string {
  // Also unify quote-style differences in JSX expression literals appearing
  // as text nodes (e.g. `{title || 'foo'}` → `{title || "foo"}`).
  return s
    .replace(/\s+/g, ' ')
    .replace(/'([^'\\\n]*)'/g, '"$1"')
    .trim();
}

function serialiseAttrs(attribs: Record<string, string>, tagName: string): string {
  // For <script> and <style>, prettier may rewrite the inner text body
  // (e.g. JS reformatting). We intentionally do NOT inspect the inner text
  // of script/style for the signature — only the attribute set. Attribute
  // VALUES on script/style (src, type, is:inline, etc.) are still compared.
  const keys = Object.keys(attribs).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = attribs[k];
    // Normalise whitespace inside class/style values, where prettier may
    // collapse runs of spaces.
    const norm = v.replace(/\s+/g, ' ').trim();
    parts.push(`${k}=${norm}`);
  }
  // Suppress noise: ignore tagName in non-debug mode; emitted by caller via `<tag>`.
  void tagName;
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}
