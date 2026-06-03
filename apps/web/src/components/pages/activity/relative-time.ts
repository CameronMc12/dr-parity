/**
 * Relative-time + day-bucket helpers for the Activity feed.
 *
 * All "now" comparisons use ANCHOR_NOW (the pinned 2026-06-02 anchor) rather
 * than Date.now() so the feed renders identically on server and client and never
 * drifts between renders. Mirrors the date-determinism contract in view-dates.ts.
 */

import { ANCHOR_NOW, DAY_MS, startOfDay } from '@/lib/view-data';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const WEEK_MS = 7 * DAY_MS;

/** "just now" / "5m ago" / "3h ago" / "2d ago" / "3w ago" / "Apr 14". */
export function relativeTime(ms: number): string {
  const delta = ANCHOR_NOW - ms;
  if (delta < MINUTE_MS) return 'just now';
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  if (delta < WEEK_MS) return `${Math.floor(delta / DAY_MS)}d ago`;
  if (delta < 5 * WEEK_MS) return `${Math.floor(delta / WEEK_MS)}w ago`;
  return absoluteDate(ms);
}

/** "Apr 14" or "Apr 14, 2025" when the year differs from the anchor's year. */
export function absoluteDate(ms: number): string {
  const d = new Date(ms);
  const anchorYear = new Date(ANCHOR_NOW).getFullYear();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === anchorYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}

/** Day-group header label for a local-midnight day timestamp. */
export function dayHeaderLabel(dayMs: number): string {
  const today = startOfDay(ANCHOR_NOW);
  if (dayMs === today) return 'Today';
  if (dayMs === today - DAY_MS) return 'Yesterday';
  return new Date(dayMs).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
