'use client';

/**
 * Owns the Timeline's scrollable day window and grows it lazily as the user
 * scrolls toward either edge — so the chart behaves like a continuous, infinite
 * horizontal calendar spanning many months or years, without ever materialising
 * the whole range up front.
 *
 * The window is seeded generously around the data extent (always including
 * ANCHOR_NOW), then extended in fixed day chunks on demand. Left-extension is
 * reported back to the caller so it can compensate scrollLeft and keep the
 * viewport visually stable (prepending days would otherwise jump the content).
 *
 * Pure-state hook: it never reads task data on every render. It only re-seeds
 * when the *zoom* changes (chunk + pad scale with granularity) or when the data
 * bounds move *outside* the current window, which is rare and cheap to detect.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DAY_MS, startOfDay } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { ZOOM_SCALES, type TimelineZoom } from './tokens';
import { dataBounds, type TimelineRange } from './axis';

/** How many days are added each time an edge is reached, per zoom. */
const EXTEND_CHUNK_DAYS: Record<TimelineZoom, number> = {
  day: 60, // ~2 months at the finest grain
  week: 120, // ~4 months
  month: 365, // a year at a glance
};

/**
 * Initial padding (days) placed on each side of the data extent when the window
 * is first seeded, so there is always room to scroll into empty time before any
 * lazy extension kicks in.
 */
const SEED_PAD_DAYS: Record<TimelineZoom, number> = {
  day: 60,
  week: 120,
  month: 365,
};

function seedRange(tasks: Task[], zoom: TimelineZoom): TimelineRange {
  const { min, max } = dataBounds(tasks);
  const pad = SEED_PAD_DAYS[zoom] * DAY_MS;
  return { start: startOfDay(min) - pad, end: startOfDay(max) + pad };
}

export interface TimelineRangeApi {
  range: TimelineRange;
  /**
   * Grow the window to the left by one chunk. Returns the pixel width that was
   * prepended (already converted via the active dayWidth) so the caller can add
   * it to scrollLeft and keep the viewport anchored.
   */
  extendLeft: () => number;
  /** Grow the window to the right by one chunk. */
  extendRight: () => void;
}

export function useTimelineRange(tasks: Task[], zoom: TimelineZoom): TimelineRangeApi {
  const [range, setRange] = useState<TimelineRange>(() => seedRange(tasks, zoom));

  // Keep the freshest task list + zoom available to the (stable) callbacks and
  // the bounds-watch effect without re-creating handlers on every data tick.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const zoomRef = useRef(zoom);

  // Re-seed when zoom changes: chunk + pad scale with granularity, and the prior
  // window's pixel extent would otherwise feel wrong at the new day width.
  useEffect(() => {
    if (zoomRef.current === zoom) return;
    zoomRef.current = zoom;
    setRange(seedRange(tasksRef.current, zoom));
  }, [zoom]);

  // If task edits push the data extent past the current window, widen to cover
  // it (never shrink). Cheap min/max scan; only commits state when bounds escape.
  useEffect(() => {
    const { min, max } = dataBounds(tasks);
    const pad = SEED_PAD_DAYS[zoomRef.current] * DAY_MS;
    setRange((prev) => {
      const start = Math.min(prev.start, startOfDay(min) - pad);
      const end = Math.max(prev.end, startOfDay(max) + pad);
      if (start === prev.start && end === prev.end) return prev;
      return { start, end };
    });
  }, [tasks]);

  const extendLeft = useCallback((): number => {
    const chunkDays = EXTEND_CHUNK_DAYS[zoomRef.current];
    setRange((prev) => ({ ...prev, start: prev.start - chunkDays * DAY_MS }));
    return chunkDays * ZOOM_SCALES[zoomRef.current].dayWidth;
  }, []);

  const extendRight = useCallback((): void => {
    const chunkDays = EXTEND_CHUNK_DAYS[zoomRef.current];
    setRange((prev) => ({ ...prev, end: prev.end + chunkDays * DAY_MS }));
  }, []);

  return { range, extendLeft, extendRight };
}
