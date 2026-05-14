/**
 * Typography analysis: font-family, font-size, font-weight, line-height, letter-spacing.
 *
 * Numeric clusters (font-size, line-height when numeric, letter-spacing) group
 * values within a 5 percent tolerance to collapse near-duplicates into a single
 * scale step. Non-numeric values (named font-weight, font-family strings) are
 * grouped by exact match.
 *
 * Each cluster reports the representative value, total usage count, and up to
 * 5 example selectors so consumers can trace a token back to real CSS rules.
 */

import type { CssRule, TypographyClusterEntry } from './types';
import { parseDimension, formatDimension } from './dimensions';

type TypographyProp = TypographyClusterEntry['property'];

interface SeenValue {
  /** Original value as it appeared in the declaration. */
  raw: string;
  /** Parsed numeric value in canonical unit, or null when value is not numeric. */
  numeric: { value: number; unit: string } | null;
  selector: string;
}

interface Bucket {
  property: TypographyProp;
  values: SeenValue[];
}

const PROPS: TypographyProp[] = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
];

export function analyseTypography(rules: CssRule[]): TypographyClusterEntry[] {
  const buckets = new Map<TypographyProp, Bucket>();
  for (const prop of PROPS) buckets.set(prop, { property: prop, values: [] });

  for (const rule of rules) {
    for (const decl of rule.declarations) {
      const prop = decl.prop.toLowerCase() as TypographyProp;
      if (!PROPS.includes(prop)) continue;
      pushValues(buckets.get(prop)!, decl.value, rule.selector);
    }
  }

  const out: TypographyClusterEntry[] = [];
  for (const bucket of buckets.values()) {
    const clusters = clusterBucket(bucket);
    out.push(...clusters);
  }
  out.sort((a, b) => {
    if (a.property !== b.property) return PROPS.indexOf(a.property) - PROPS.indexOf(b.property);
    return b.count - a.count;
  });
  return out;
}

function pushValues(bucket: Bucket, value: string, selector: string): void {
  if (bucket.property === 'font-family') {
    bucket.values.push({ raw: value.trim(), numeric: null, selector });
    return;
  }

  if (bucket.property === 'font-weight') {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      bucket.values.push({ raw: String(numeric), numeric: { value: numeric, unit: '' }, selector });
    } else {
      bucket.values.push({ raw: trimmed, numeric: null, selector });
    }
    return;
  }

  const dim = parseDimension(value);
  if (dim) {
    bucket.values.push({
      raw: value.trim(),
      numeric: { value: dim.value, unit: dim.unit },
      selector,
    });
  } else {
    bucket.values.push({ raw: value.trim(), numeric: null, selector });
  }
}

function clusterBucket(bucket: Bucket): TypographyClusterEntry[] {
  if (bucket.property === 'font-family' || bucket.values.every((v) => v.numeric === null)) {
    return clusterExact(bucket);
  }
  return clusterNumeric(bucket);
}

function clusterExact(bucket: Bucket): TypographyClusterEntry[] {
  const map = new Map<string, { count: number; selectors: string[] }>();
  for (const v of bucket.values) {
    const key = v.raw;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (existing.selectors.length < 5 && !existing.selectors.includes(v.selector)) {
        existing.selectors.push(v.selector);
      }
    } else {
      map.set(key, { count: 1, selectors: [v.selector] });
    }
  }
  return [...map.entries()].map(([value, info]) => ({
    property: bucket.property,
    value,
    count: info.count,
    selectors: info.selectors,
  }));
}

function clusterNumeric(bucket: Bucket): TypographyClusterEntry[] {
  const byUnit = new Map<string, SeenValue[]>();
  const nonNumeric: SeenValue[] = [];
  for (const v of bucket.values) {
    if (!v.numeric) {
      nonNumeric.push(v);
      continue;
    }
    const key = v.numeric.unit;
    const arr = byUnit.get(key);
    if (arr) arr.push(v);
    else byUnit.set(key, [v]);
  }

  const out: TypographyClusterEntry[] = [];
  for (const [unit, values] of byUnit) {
    values.sort((a, b) => (a.numeric!.value - b.numeric!.value));
    const clusters = clusterByTolerance(values, 0.05);
    for (const cluster of clusters) {
      out.push({
        property: bucket.property,
        value: formatDimension(cluster.centre, unit),
        count: cluster.count,
        selectors: cluster.selectors,
      });
    }
  }

  if (nonNumeric.length > 0) {
    const exact = clusterExact({ property: bucket.property, values: nonNumeric });
    out.push(...exact);
  }

  return out;
}

interface NumericCluster {
  centre: number;
  count: number;
  selectors: string[];
}

export function clusterByTolerance(
  sorted: SeenValue[],
  tolerance: number,
): NumericCluster[] {
  const clusters: NumericCluster[] = [];
  for (const v of sorted) {
    const value = v.numeric!.value;
    const tail = clusters[clusters.length - 1];
    if (tail && withinTolerance(tail.centre, value, tolerance)) {
      tail.centre = (tail.centre * tail.count + value) / (tail.count + 1);
      tail.count++;
      if (tail.selectors.length < 5 && !tail.selectors.includes(v.selector)) {
        tail.selectors.push(v.selector);
      }
    } else {
      clusters.push({ centre: value, count: 1, selectors: [v.selector] });
    }
  }
  return clusters;
}

function withinTolerance(centre: number, candidate: number, tol: number): boolean {
  if (centre === 0) return Math.abs(candidate) < tol;
  return Math.abs(candidate - centre) / Math.abs(centre) <= tol;
}
