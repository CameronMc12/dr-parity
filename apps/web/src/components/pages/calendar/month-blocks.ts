/**
 * Pure helpers for the continuously-scrolling month stack.
 *
 * The infinite month view renders a vertical stack of consecutive month blocks.
 * Each block is built from a single month timestamp via `monthRange`; the window
 * of visible months is an ordered list of month keys (1st-of-month local-midnight
 * timestamps) that grows lazily as the user scrolls toward either edge.
 */

import { type MonthRange, monthRange } from '@/lib/view-data';
import { MONTH_NAMES } from './tokens';

export interface MonthBlock {
  /** Local-midnight timestamp of the 1st of the month (stable React key). */
  key: number;
  /** "June 2026" style label. */
  label: string;
  range: MonthRange;
}

/** Local-midnight 1st-of-month for the month containing `ms`. */
export function monthKey(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Step a month key by whole months (delta may be negative). */
export function shiftMonth(key: number, delta: number): number {
  const d = new Date(key);
  return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
}

export function monthLabel(key: number): string {
  const d = new Date(key);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildBlock(key: number): MonthBlock {
  return { key, label: monthLabel(key), range: monthRange(key) };
}

/**
 * Build an ordered window of month keys spanning [center - before, center + after].
 * Inclusive of the center month.
 */
export function buildMonthWindow(
  centerKey: number,
  before: number,
  after: number,
): number[] {
  const keys: number[] = [];
  for (let i = -before; i <= after; i += 1) keys.push(shiftMonth(centerKey, i));
  return keys;
}

/** Prepend `count` earlier months to a window (returns a new array). */
export function extendBackward(keys: number[], count: number): number[] {
  const first = keys[0];
  if (first === undefined) return keys;
  const added: number[] = [];
  for (let i = count; i >= 1; i -= 1) added.push(shiftMonth(first, -i));
  return [...added, ...keys];
}

/** Append `count` later months to a window (returns a new array). */
export function extendForward(keys: number[], count: number): number[] {
  const last = keys[keys.length - 1];
  if (last === undefined) return keys;
  const added: number[] = [];
  for (let i = 1; i <= count; i += 1) added.push(shiftMonth(last, i));
  return [...keys, ...added];
}
