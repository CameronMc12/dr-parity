/**
 * Class catalog.
 *
 * Builds a per-class summary by intersecting:
 *   1. DOM usage in `index.html` (via cheerio)
 *   2. CSS selectors that target the class (via parsed CssRule list)
 *
 * For each unique class we record:
 *   - count    : DOM occurrences in index.html
 *   - selectors: up to 3 CSS selectors that reference the class
 *   - domContexts: up to 3 `parentTag.parentClass` strings showing where it sits
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { ClassCatalogEntry, CssRule } from './types';

interface DomHit {
  count: number;
  contexts: string[];
}

export function analyseClasses(cloneDir: string, rules: CssRule[]): ClassCatalogEntry[] {
  const domMap = collectDomUsage(cloneDir);
  if (domMap.size === 0) return [];

  const cssMap = collectCssSelectors(rules);

  const out: ClassCatalogEntry[] = [];
  for (const [className, dom] of domMap) {
    const selectors = cssMap.get(className) ?? [];
    out.push({
      className,
      count: dom.count,
      selectors: selectors.slice(0, 3),
      domContexts: dom.contexts.slice(0, 3),
    });
  }
  out.sort((a, b) => b.count - a.count || a.className.localeCompare(b.className));
  return out;
}

function collectDomUsage(cloneDir: string): Map<string, DomHit> {
  const indexPath = join(cloneDir, 'index.html');
  let html: string;
  try {
    html = readFileSync(indexPath, 'utf8');
  } catch {
    return new Map();
  }

  const $ = cheerio.load(html);
  const map = new Map<string, DomHit>();

  $('[class]').each((_, el) => {
    const classAttr = (el as cheerio.Element & { attribs?: Record<string, string> }).attribs?.class;
    if (!classAttr) return;
    const classes = classAttr.split(/\s+/).filter(Boolean);
    const parent = (el as cheerio.Element).parent;
    const parentContext = describeParent($, parent);
    for (const cls of classes) {
      const existing = map.get(cls);
      if (existing) {
        existing.count++;
        if (existing.contexts.length < 3 && !existing.contexts.includes(parentContext)) {
          existing.contexts.push(parentContext);
        }
      } else {
        map.set(cls, { count: 1, contexts: [parentContext] });
      }
    }
  });

  return map;
}

function describeParent($: cheerio.CheerioAPI, parent: unknown): string {
  if (!parent || typeof parent !== 'object') return '(root)';
  const tag = (parent as { tagName?: string; name?: string }).tagName
    ?? (parent as { tagName?: string; name?: string }).name
    ?? '';
  if (!tag) return '(root)';
  const tagLower = tag.toLowerCase();
  const attribs = (parent as { attribs?: Record<string, string> }).attribs ?? {};
  const cls = attribs.class?.split(/\s+/).filter(Boolean) ?? [];
  if (cls.length === 0) return tagLower;
  return `${tagLower}.${cls.slice(0, 2).join('.')}`;
}

function collectCssSelectors(rules: CssRule[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const rule of rules) {
    const classes = extractClassNames(rule.selector);
    for (const cls of classes) {
      const list = map.get(cls);
      if (list) {
        if (list.length < 10 && !list.includes(rule.selector)) list.push(rule.selector);
      } else {
        map.set(cls, [rule.selector]);
      }
    }
  }
  return map;
}

export function extractClassNames(selector: string): string[] {
  const out = new Set<string>();
  const re = /\.([\w-]+)/g;
  const sanitized = selector.replace(/\[[^\]]*\]/g, ''); // drop attribute selectors first
  let m: RegExpExecArray | null;
  while ((m = re.exec(sanitized)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}
