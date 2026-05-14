/**
 * Token naming + categorisation.
 *
 * Numeric naming scheme. No semantic renaming. Each category is sorted by the
 * spec rule (usage desc for colours, value asc for numeric scales) and assigned
 * sequential `--<category>-NN` names with zero-padded indices.
 */

import type {
  BreakpointEntry,
  ColorUsageEntry,
  CssRule,
  SpacingClusterEntry,
  TypographyClusterEntry,
} from '../analyze/css/types';
import type {
  AnalysisBundle,
  CategorisedTokens,
  TokenEntry,
} from './types';

const RADIUS_TOLERANCE = 0.05;

interface RawRadius {
  value: string;
  numeric: number;
  unit: string;
  selector: string;
}

export function buildTokens(bundle: AnalysisBundle): CategorisedTokens {
  return {
    colors: buildColorTokens(bundle.colors),
    spacing: buildSpacingTokens(bundle.spacing),
    fontSizes: buildTypographyScale(
      bundle.typography,
      'font-size',
      'font-size',
    ),
    fontWeights: buildTypographyScale(
      bundle.typography,
      'font-weight',
      'font-weight',
    ),
    lineHeights: buildTypographyScale(
      bundle.typography,
      'line-height',
      'line-height',
    ),
    letterSpacings: buildTypographyScale(
      bundle.typography,
      'letter-spacing',
      'letter-spacing',
    ),
    fontFamilies: buildFontFamilyTokens(bundle.typography),
    breakpoints: buildBreakpointTokens(bundle.breakpoints),
    radius: buildRadiusTokens(bundle.rules),
    shadows: buildShadowTokens(bundle.rules),
  };
}

function buildColorTokens(entries: ColorUsageEntry[]): TokenEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
  return sorted.map((entry, i) => ({
    name: makeName('color', i + 1),
    value: entry.value,
    count: entry.count,
    exampleSelector: entry.exampleSelector,
  }));
}

function buildSpacingTokens(entries: SpacingClusterEntry[]): TokenEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const an = parseNumericValue(a.value);
    const bn = parseNumericValue(b.value);
    if (an !== null && bn !== null && an !== bn) return an - bn;
    return a.value.localeCompare(b.value);
  });
  return sorted.map((entry, i) => ({
    name: makeName('space', i + 1),
    value: entry.value,
    count: entry.count,
    exampleSelector: entry.selectors[0] ?? '',
  }));
}

type ScaleProp = 'font-size' | 'font-weight' | 'line-height' | 'letter-spacing';

function buildTypographyScale(
  clusters: TypographyClusterEntry[],
  prop: ScaleProp,
  namePrefix: ScaleProp,
): TokenEntry[] {
  const filtered = clusters.filter((c) => c.property === prop);
  const sorted = [...filtered].sort((a, b) => {
    const an = parseNumericValue(a.value);
    const bn = parseNumericValue(b.value);
    if (an !== null && bn !== null && an !== bn) return an - bn;
    return a.value.localeCompare(b.value);
  });
  return sorted.map((entry, i) => ({
    name: makeName(namePrefix, i + 1),
    value: entry.value,
    count: entry.count,
    exampleSelector: entry.selectors[0] ?? '',
  }));
}

function buildFontFamilyTokens(
  clusters: TypographyClusterEntry[],
): TokenEntry[] {
  const filtered = clusters.filter((c) => c.property === 'font-family');
  const sorted = [...filtered].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
  return sorted.map((entry, i) => ({
    name: makeName('font-family', i + 1),
    value: entry.value,
    count: entry.count,
    exampleSelector: entry.selectors[0] ?? '',
  }));
}

function buildBreakpointTokens(entries: BreakpointEntry[]): TokenEntry[] {
  const dedup = new Map<string, { count: number; feature: string }>();
  for (const e of entries) {
    const existing = dedup.get(e.value);
    if (existing) {
      existing.count += e.count;
    } else {
      dedup.set(e.value, { count: e.count, feature: e.feature });
    }
  }
  const sorted = Array.from(dedup.entries()).sort((a, b) => {
    const an = parseNumericValue(a[0]);
    const bn = parseNumericValue(b[0]);
    if (an !== null && bn !== null && an !== bn) return an - bn;
    return a[0].localeCompare(b[0]);
  });
  return sorted.map(([value, meta], i) => ({
    name: makeName('bp', i + 1),
    value,
    count: meta.count,
    exampleSelector: `@media (${meta.feature}: ${value})`,
  }));
}

function buildRadiusTokens(rules: CssRule[]): TokenEntry[] {
  const raw: RawRadius[] = [];
  for (const rule of rules) {
    for (const decl of rule.declarations) {
      if (!isRadiusProp(decl.prop)) continue;
      const parts = splitValueParts(decl.value);
      for (const part of parts) {
        const parsed = parseDimension(part);
        if (!parsed) continue;
        raw.push({
          value: part,
          numeric: parsed.numeric,
          unit: parsed.unit,
          selector: rule.selector,
        });
      }
    }
  }

  const clusters = clusterByTolerance(raw, RADIUS_TOLERANCE);
  return clusters.map((c, i) => ({
    name: makeName('radius', i + 1),
    value: c.representative,
    count: c.count,
    exampleSelector: c.exampleSelector,
  }));
}

function buildShadowTokens(rules: CssRule[]): TokenEntry[] {
  const map = new Map<
    string,
    { original: string; count: number; selector: string }
  >();

  for (const rule of rules) {
    for (const decl of rule.declarations) {
      const shadows = extractShadowValues(decl.prop, decl.value);
      for (const s of shadows) {
        const normalised = normaliseShadow(s);
        if (!normalised) continue;
        const existing = map.get(normalised);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(normalised, {
            original: s,
            count: 1,
            selector: rule.selector,
          });
        }
      }
    }
  }

  const sorted = Array.from(map.entries()).sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[0].localeCompare(b[0]);
  });

  return sorted.map(([, meta], i) => ({
    name: makeName('shadow', i + 1),
    value: meta.original,
    count: meta.count,
    exampleSelector: meta.selector,
  }));
}

interface RadiusCluster {
  representative: string;
  count: number;
  exampleSelector: string;
}

function clusterByTolerance(
  raw: RawRadius[],
  tolerance: number,
): RadiusCluster[] {
  const byUnit = new Map<string, RawRadius[]>();
  for (const r of raw) {
    const bucket = byUnit.get(r.unit) ?? [];
    bucket.push(r);
    byUnit.set(r.unit, bucket);
  }

  const clusters: RadiusCluster[] = [];

  for (const [unit, items] of byUnit) {
    items.sort((a, b) => a.numeric - b.numeric);
    let group: RawRadius[] = [];
    let groupAnchor: number | null = null;
    for (const item of items) {
      if (groupAnchor === null) {
        groupAnchor = item.numeric;
        group = [item];
        continue;
      }
      const span = Math.max(Math.abs(groupAnchor), 1e-6);
      if (Math.abs(item.numeric - groupAnchor) / span <= tolerance) {
        group.push(item);
      } else {
        clusters.push(finaliseCluster(group, unit));
        groupAnchor = item.numeric;
        group = [item];
      }
    }
    if (group.length > 0) {
      clusters.push(finaliseCluster(group, unit));
    }
  }

  clusters.sort((a, b) => {
    const an = parseNumericValue(a.representative);
    const bn = parseNumericValue(b.representative);
    if (an !== null && bn !== null && an !== bn) return an - bn;
    return a.representative.localeCompare(b.representative);
  });

  return clusters;
}

function finaliseCluster(items: RawRadius[], unit: string): RadiusCluster {
  const mean = items.reduce((s, r) => s + r.numeric, 0) / items.length;
  const rounded = Math.round(mean * 1000) / 1000;
  const cleanNum =
    Number.isInteger(rounded) || rounded.toString().length <= 6
      ? rounded.toString()
      : rounded.toFixed(3).replace(/\.?0+$/, '');
  return {
    representative: `${cleanNum}${unit}`,
    count: items.length,
    exampleSelector: items[0]!.selector,
  };
}

function isRadiusProp(prop: string): boolean {
  return (
    prop === 'border-radius' ||
    prop === 'border-top-left-radius' ||
    prop === 'border-top-right-radius' ||
    prop === 'border-bottom-left-radius' ||
    prop === 'border-bottom-right-radius' ||
    prop === 'border-start-start-radius' ||
    prop === 'border-start-end-radius' ||
    prop === 'border-end-start-radius' ||
    prop === 'border-end-end-radius'
  );
}

function splitValueParts(value: string): string[] {
  return value
    .split('/')
    .flatMap((part) => part.trim().split(/\s+/))
    .filter(Boolean);
}

interface ParsedDimension {
  numeric: number;
  unit: string;
}

function parseDimension(raw: string): ParsedDimension | null {
  const m = raw.match(/^(-?\d*\.?\d+)([a-z%]*)$/i);
  if (!m) return null;
  const numeric = Number(m[1]);
  if (!Number.isFinite(numeric)) return null;
  return { numeric, unit: (m[2] ?? '').toLowerCase() };
}

function parseNumericValue(raw: string): number | null {
  const parsed = parseDimension(raw);
  return parsed ? parsed.numeric : null;
}

function extractShadowValues(prop: string, value: string): string[] {
  if (prop === 'box-shadow' || prop === '-webkit-box-shadow') {
    return splitTopLevelComma(value);
  }
  if (prop === 'filter' || prop === '-webkit-filter' || prop === 'backdrop-filter') {
    return extractDropShadows(value);
  }
  return [];
}

function extractDropShadows(value: string): string[] {
  const results: string[] = [];
  const re = /drop-shadow\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < value.length; i++) {
      const ch = value[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth === 0) {
      results.push(`drop-shadow(${value.slice(start, i).trim()})`);
    }
  }
  return results;
}

function splitTopLevelComma(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed && trimmed.toLowerCase() !== 'none') parts.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const last = current.trim();
  if (last && last.toLowerCase() !== 'none') parts.push(last);
  return parts;
}

function normaliseShadow(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!collapsed) return null;
  if (collapsed === 'none' || collapsed === 'inherit' || collapsed === 'initial' || collapsed === 'unset') {
    return null;
  }
  return collapsed;
}

function makeName(prefix: string, index: number): string {
  const padded = index < 10 ? `0${index}` : String(index);
  return `${prefix}-${padded}`;
}
