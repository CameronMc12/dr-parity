/**
 * Optional token substitution.
 *
 * Given a token map (category → { value → name }), rewrite each declaration's
 * value so any literal occurrence of a token value becomes a `var(--name)`
 * reference. Colours are matched on both the normalised hex form AND the
 * equivalent rgb()/rgba() forms so an extraction declared as `#ff5546` can
 * still match a stylesheet that wrote `rgb(255, 85, 70)`.
 *
 * `!important` flags, vendor prefixes, fallback values, and inline comments
 * embedded in the value are preserved by virtue of operating on the value
 * string as-is and only swapping recognised literal tokens.
 */

import type { CssDeclaration } from '../analyze/css/types';
import type { FlattenedTokenEntry, SubstitutionStats } from './types';

type TokenMapShape = Record<string, Record<string, string>>;

const HEX_RE = /^#([0-9a-fA-F]{3,8})$/;
const RGB_FN_RE = /\brgba?\s*\(\s*([^)]+)\)/gi;
const HEX_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b/g;

export function flattenTokenMap(raw: unknown): FlattenedTokenEntry[] {
  if (!isObject(raw)) {
    throw new Error('token-map.json: expected a top-level object keyed by category');
  }
  const out: FlattenedTokenEntry[] = [];
  const seenNames = new Set<string>();
  const map = raw as TokenMapShape;
  for (const category of Object.keys(map)) {
    const bucket = map[category];
    if (!isObject(bucket)) continue;
    for (const [keyA, keyB] of Object.entries(bucket)) {
      if (typeof keyB !== 'string') continue;
      const { name, value } = pickNameAndValue(keyA, keyB);
      if (!name || !value) continue;
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      out.push({ name, value, category });
    }
  }
  return out;
}

/**
 * Token map files in this pipeline write { value: name }, but accepting the
 * inverse form costs nothing and makes the script forgiving against future
 * shape changes. The heuristic: whichever side parses as a CSS-like value
 * (hex, number+unit, function call) is the value; the other is the name.
 */
function pickNameAndValue(a: string, b: string): { name: string; value: string } {
  const aIsValue = looksLikeCssValue(a);
  const bIsValue = looksLikeCssValue(b);
  if (aIsValue && !bIsValue) return { name: b, value: a };
  if (!aIsValue && bIsValue) return { name: a, value: b };
  return { name: b.startsWith('--') ? b.slice(2) : b, value: a };
}

function looksLikeCssValue(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith('#')) return HEX_RE.test(t);
  if (/^[0-9.+-]/.test(t)) return true;
  if (/^[a-z-]+\(/i.test(t)) return true;
  return false;
}

export function buildSubstitutionTable(
  tokens: FlattenedTokenEntry[],
): Map<string, string> {
  const table = new Map<string, string>();
  for (const tok of tokens) {
    const ref = `var(--${tok.name})`;
    const variants = normalisedVariants(tok.value);
    for (const v of variants) {
      if (!table.has(v)) table.set(v, ref);
    }
  }
  return table;
}

export function substituteDeclarations(
  decls: CssDeclaration[],
  table: Map<string, string>,
  stats: SubstitutionStats,
): CssDeclaration[] {
  if (table.size === 0) return decls;
  return decls.map((d) => {
    const rewritten = substituteValue(d.value, table, stats);
    if (rewritten === d.value) return d;
    return { prop: d.prop, value: rewritten };
  });
}

/**
 * Replace any whole token-value occurrence inside a declaration value with the
 * var(--name) reference. We walk hex literals and rgb()/rgba() function calls
 * explicitly so colours match across notations.
 */
function substituteValue(
  value: string,
  table: Map<string, string>,
  stats: SubstitutionStats,
): string {
  let out = value;

  out = out.replace(HEX_LITERAL_RE, (m) => {
    const key = m.toLowerCase();
    const hit = table.get(key);
    if (hit !== undefined) {
      stats.totalReplacements++;
      return hit;
    }
    return m;
  });

  out = out.replace(RGB_FN_RE, (m) => {
    const hex = rgbExprToHex(m);
    if (hex === null) return m;
    const hit = table.get(hex);
    if (hit !== undefined) {
      stats.totalReplacements++;
      return hit;
    }
    return m;
  });

  for (const [needle, ref] of table) {
    if (needle.startsWith('#') || needle.startsWith('rgb')) continue;
    if (!out.includes(needle)) continue;
    const replaced = replaceWhole(out, needle, ref);
    if (replaced.changed) {
      stats.totalReplacements += replaced.count;
      out = replaced.value;
    }
  }

  return out;
}

function replaceWhole(
  haystack: string,
  needle: string,
  replacement: string,
): { value: string; changed: boolean; count: number } {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=$|[^A-Za-z0-9_-])`, 'g');
  let count = 0;
  const value = haystack.replace(re, (_, pre: string) => {
    count++;
    return `${pre}${replacement}`;
  });
  return { value, changed: count > 0, count };
}

function normalisedVariants(rawValue: string): string[] {
  const v = rawValue.trim();
  if (!v) return [];
  const variants = new Set<string>();
  variants.add(v);
  variants.add(v.toLowerCase());

  if (HEX_RE.test(v)) {
    const hex = expandHex(v).toLowerCase();
    variants.add(hex);
    const rgb = hexToRgb(hex);
    if (rgb) {
      variants.add(rgb);
    }
  }
  return Array.from(variants);
}

function expandHex(input: string): string {
  const m = input.match(HEX_RE);
  if (!m) return input;
  const body = m[1];
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  if (body.length === 4) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}${body[3]}${body[3]}`;
  }
  return `#${body.toLowerCase()}`;
}

function hexToRgb(hex: string): string | null {
  const m = hex.match(HEX_RE);
  if (!m) return null;
  const body = m[1];
  if (body.length !== 6 && body.length !== 8) return null;
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if (body.length === 8) {
    const a = parseInt(body.slice(6, 8), 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${trimAlpha(a)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function trimAlpha(a: number): string {
  const rounded = Math.round(a * 1000) / 1000;
  return String(rounded);
}

function rgbExprToHex(expr: string): string | null {
  const m = expr.match(/\brgba?\s*\(\s*([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const r = parseChannel(parts[0]);
  const g = parseChannel(parts[1]);
  const b = parseChannel(parts[2]);
  if (r === null || g === null || b === null) return null;
  const a = parts[3] !== undefined ? parseAlpha(parts[3]) : null;
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a === null || a === 255) return hex;
  return `${hex}${toHex(a)}`;
}

function parseChannel(s: string): number | null {
  const t = s.trim();
  if (t.endsWith('%')) {
    const n = parseFloat(t.slice(0, -1));
    if (Number.isNaN(n)) return null;
    return Math.round((n / 100) * 255);
  }
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(255, n)) : null;
}

function parseAlpha(s: string): number | null {
  const t = s.trim();
  if (t.endsWith('%')) {
    const n = parseFloat(t.slice(0, -1));
    return Number.isNaN(n) ? null : Math.round((n / 100) * 255);
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 255);
}

function toHex(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
