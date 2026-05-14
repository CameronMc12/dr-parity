/**
 * Colour extraction.
 *
 * Walks every CSS declaration value and pulls out every colour token:
 * hex, rgb/rgba, hsl/hsla, oklch/oklab, and CSS named colours.
 *
 * Normalisation:
 *   - hex / rgb / rgba / hsl / hsla / named → lowercase hex (#rrggbb or #rrggbbaa).
 *   - oklch / oklab / color() → preserved as their original normalised string
 *     because the colour space is wider than sRGB.
 */

import type { ColorUsageEntry, CssRule } from './types';
import { NAMED_COLORS } from './named-colors';

interface ColorMatch {
  raw: string;
  normalised: string;
}

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const FUNC_RE = /\b(rgba?|hsla?|oklch|oklab|color|hwb|lab|lch)\s*\(/gi;
const COLOR_PROP_RE = /(?:^|[^a-zA-Z-])(color|background-color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color|outline-color|caret-color|fill|stroke|stop-color|text-decoration-color|column-rule-color|accent-color|--[\w-]+)\b/;

interface CollectorEntry {
  count: number;
  contexts: Set<string>;
  exampleSelector: string;
}

export function analyseColors(rules: CssRule[]): ColorUsageEntry[] {
  const map = new Map<string, CollectorEntry>();

  for (const rule of rules) {
    for (const decl of rule.declarations) {
      const matches = extractColors(decl.value);
      if (matches.length === 0) continue;
      for (const m of matches) {
        const existing = map.get(m.normalised);
        if (existing) {
          existing.count++;
          existing.contexts.add(decl.prop);
        } else {
          map.set(m.normalised, {
            count: 1,
            contexts: new Set([decl.prop]),
            exampleSelector: rule.selector,
          });
        }
      }
    }
  }

  const out: ColorUsageEntry[] = [];
  for (const [value, entry] of map) {
    out.push({
      value,
      count: entry.count,
      contexts: Array.from(entry.contexts).sort(),
      exampleSelector: entry.exampleSelector,
    });
  }
  out.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return out;
}

export function extractColors(value: string): ColorMatch[] {
  const matches: ColorMatch[] = [];
  const seenAt = new Set<number>();

  HEX_RE.lastIndex = 0;
  let hex: RegExpExecArray | null;
  while ((hex = HEX_RE.exec(value)) !== null) {
    seenAt.add(hex.index);
    matches.push({ raw: hex[0], normalised: normaliseHex(hex[0]) });
  }

  FUNC_RE.lastIndex = 0;
  let fn: RegExpExecArray | null;
  while ((fn = FUNC_RE.exec(value)) !== null) {
    const nameLower = fn[1].toLowerCase();
    const openIdx = fn.index + fn[0].length - 1;
    const closeIdx = findMatchingParen(value, openIdx);
    if (closeIdx === -1) continue;
    const args = value.slice(openIdx + 1, closeIdx);
    const raw = `${nameLower}(${args.trim()})`;
    const normalised = normaliseFunction(nameLower, args);
    if (normalised) matches.push({ raw, normalised });
    FUNC_RE.lastIndex = closeIdx + 1;
  }

  for (const named of findNamedColors(value)) {
    matches.push({ raw: named, normalised: NAMED_COLORS[named.toLowerCase()] });
  }

  return matches;
}

function findMatchingParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findNamedColors(value: string): string[] {
  const out: string[] = [];
  const tokenRe = /\b([a-zA-Z]{3,20})\b/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(value)) !== null) {
    const lower = m[1].toLowerCase();
    if (NAMED_COLORS[lower] !== undefined) {
      // Skip if directly preceded by `--` (custom property name) or part of a func name.
      const before = value[m.index - 1];
      const after = value[m.index + m[1].length];
      if (before === '-' || after === '(' || before === '_') continue;
      out.push(m[1]);
    }
  }
  return out;
}

function normaliseHex(hex: string): string {
  const v = hex.toLowerCase().slice(1);
  if (v.length === 3) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  }
  if (v.length === 4) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return `#${v}`;
}

function normaliseFunction(name: string, args: string): string | null {
  const trimmed = collapseWhitespace(args.trim());
  if (name === 'rgb' || name === 'rgba') {
    const hex = rgbArgsToHex(trimmed);
    if (hex) return hex;
  }
  if (name === 'hsl' || name === 'hsla') {
    const hex = hslArgsToHex(trimmed);
    if (hex) return hex;
  }
  return `${name}(${trimmed})`;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s*\/\s*/g, ' / ');
}

function rgbArgsToHex(args: string): string | null {
  const parts = parseColorArgs(args);
  if (!parts) return null;
  const [r, g, b, a] = parts;
  return rgbaToHex(r, g, b, a);
}

function hslArgsToHex(args: string): string | null {
  const parts = parseColorArgs(args);
  if (!parts) return null;
  const [hRaw, sRaw, lRaw, a] = parts;
  if (Number.isNaN(hRaw) || Number.isNaN(sRaw) || Number.isNaN(lRaw)) return null;
  const { r, g, b } = hslToRgb(((hRaw % 360) + 360) % 360, sRaw / 100, lRaw / 100);
  return rgbaToHex(r, g, b, a);
}

function parseColorArgs(args: string): [number, number, number, number] | null {
  const normalised = args.replace('/', ' ').replace(/,/g, ' ');
  const tokens = normalised.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;
  const v1 = parseScalar(tokens[0]);
  const v2 = parseScalar(tokens[1]);
  const v3 = parseScalar(tokens[2]);
  const v4 = tokens[3] !== undefined ? parseAlpha(tokens[3]) : 1;
  return [v1, v2, v3, v4];
}

function parseScalar(token: string): number {
  if (token.endsWith('%')) return (parseFloat(token) / 100) * 255;
  return parseFloat(token);
}

function parseAlpha(token: string): number {
  if (token.endsWith('%')) return parseFloat(token) / 100;
  return parseFloat(token);
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const ri = clamp255(Math.round(r));
  const gi = clamp255(Math.round(g));
  const bi = clamp255(Math.round(b));
  const base = `#${hex2(ri)}${hex2(gi)}${hex2(bi)}`;
  if (Number.isNaN(a) || a >= 1) return base;
  const ai = clamp255(Math.round(a * 255));
  return `${base}${hex2(ai)}`;
}

function clamp255(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh >= 0 && hh < 1) { r1 = c; g1 = x; }
  else if (hh < 2) { r1 = x; g1 = c; }
  else if (hh < 3) { g1 = c; b1 = x; }
  else if (hh < 4) { g1 = x; b1 = c; }
  else if (hh < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = l - c / 2;
  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}
