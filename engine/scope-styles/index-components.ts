/**
 * Walk the components directory, parse each .astro file with cheerio, and
 * collect the set of CSS classes referenced on every element inside.
 *
 * One level of recursion is the documented contract, but we recurse arbitrarily
 * deep — that's a strict superset and avoids surprises when components live
 * inside grouping folders. `node_modules` and dotted directories are skipped.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import * as cheerioModule from 'cheerio';
import type { Element } from 'domhandler';
const cheerio: any = (cheerioModule as any).default ?? cheerioModule;
import type { ComponentInfo } from './types';

const ASTRO_EXT = '.astro';

export function indexComponents(componentsDir: string): ComponentInfo[] {
  const files = walkForAstro(componentsDir);
  const out: ComponentInfo[] = [];
  for (const filePath of files) {
    const source = safeReadText(filePath);
    if (source === null) continue;
    const classes = extractClassesFromAstro(source);
    out.push({
      filePath,
      name: basename(filePath, ASTRO_EXT),
      classes,
    });
  }
  out.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return out;
}

function walkForAstro(root: string): string[] {
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
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && extname(name).toLowerCase() === ASTRO_EXT) {
        out.push(full);
      }
    }
  }
  return out;
}

function safeReadText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Extract the markup region of an Astro file (everything outside the leading
 * frontmatter fence and the trailing `<style>` block) and parse it with cheerio
 * so we can read every `class` attribute on every element.
 */
export function extractClassesFromAstro(source: string): Set<string> {
  const markup = stripFrontmatter(source);
  const withoutStyles = stripStyleBlocks(markup);
  const $ = cheerio.load(withoutStyles, { xml: false });
  const out = new Set<string>();
  $('*').each((_: number, el: Element) => {
    const attribs = (el as { attribs?: Record<string, string> }).attribs;
    if (!attribs) return;
    const cls = attribs.class;
    if (typeof cls !== 'string') return;
    for (const token of cls.split(/\s+/)) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      if (looksLikeExpression(trimmed)) continue;
      out.add(trimmed);
    }
  });
  return out;
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith('---')) return source;
  const end = source.indexOf('\n---', 3);
  if (end === -1) return source;
  const after = source.indexOf('\n', end + 4);
  return after === -1 ? '' : source.slice(after + 1);
}

function stripStyleBlocks(markup: string): string {
  return markup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

const EXPRESSION_CHARS = new Set(['{', '}', '$', '`', '(', ')']);

function looksLikeExpression(token: string): boolean {
  for (const ch of token) {
    if (EXPRESSION_CHARS.has(ch)) return true;
  }
  return false;
}
