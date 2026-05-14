/**
 * CSS dimension parsing and formatting helpers.
 *
 * `parseDimension` accepts the FIRST dimension token in a string and returns
 * its numeric value and unit. It rejects values that are obviously not a
 * single dimension (e.g. `calc(...)`, `var(...)`, shorthand triples).
 */

export type Dimension = { value: number; unit: string };

const DIM_RE = /^\s*(-?\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|pc|cm|mm|in|deg|rad|turn|s|ms|fr)?\s*$/i;

const SPACING_UNITS = new Set(['px', 'rem', 'em', '%', 'vw', 'vh', 'vmin', 'vmax', 'ch']);

export function parseDimension(value: string): Dimension | null {
  const match = DIM_RE.exec(value.trim());
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (match[2] ?? '').toLowerCase();
  return { value: num, unit };
}

export function parseSpacingDimensions(value: string): Dimension[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (/(?:^|\s)(calc|var|env|min|max|clamp)\s*\(/i.test(trimmed)) return [];

  const tokens = trimmed.split(/\s+/);
  const out: Dimension[] = [];
  for (const tok of tokens) {
    const dim = parseDimension(tok);
    if (!dim) return [];
    if (dim.unit === '' && dim.value !== 0) return [];
    if (dim.unit !== '' && !SPACING_UNITS.has(dim.unit)) return [];
    out.push(dim);
  }
  return out;
}

export function formatDimension(value: number, unit: string): string {
  const rounded = roundForUnit(value, unit);
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

function roundForUnit(value: number, unit: string): string {
  if (unit === 'rem' || unit === 'em') {
    return trimZeros(value.toFixed(3));
  }
  if (unit === '%') {
    return trimZeros(value.toFixed(2));
  }
  return trimZeros(value.toFixed(2));
}

function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}
