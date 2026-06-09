/**
 * Recursive body-shape inference. Maps a parsed JSON value into a shape
 * descriptor (typeof keys, arrays -> [elementShape]) truncated at a max depth.
 */

import type { ShapeValue } from './types.js';

const MAX_DEPTH = 4;

export function inferShape(value: unknown, depth = 0): ShapeValue {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return ['empty'];
    if (depth >= MAX_DEPTH) return ['…'];
    return [inferShape(value[0], depth + 1)];
  }
  const t = typeof value;
  if (t === 'object') {
    if (depth >= MAX_DEPTH) return '{…}';
    const obj = value as Record<string, unknown>;
    const shape: Record<string, ShapeValue> = {};
    for (const key of Object.keys(obj).slice(0, 50)) {
      shape[key] = inferShape(obj[key], depth + 1);
    }
    return shape;
  }
  return t; // 'string' | 'number' | 'boolean' | 'undefined' | etc.
}

/** Parse a raw body string and infer its shape, or null if not JSON. */
export function shapeFromBody(text: string | null): ShapeValue | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    return inferShape(JSON.parse(trimmed));
  } catch {
    return null;
  }
}
