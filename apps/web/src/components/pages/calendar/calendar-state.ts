'use client';

/**
 * Calendar navigation state. Tracks the anchor and the active view type
 * (day / 4 days / week / month — the real ClickUp "Time period" set).
 *
 * The MONTH view is a continuously-scrolling stack of month blocks, so its
 * prev/next/today controls do not mutate the anchor; instead they emit a
 * `scrollTarget` (a month timestamp + a bumping nonce) that the infinite month
 * grid listens to and scrolls to. The day / 4-days / week views still step the
 * anchor by their own period.
 */

import { useCallback, useMemo, useState } from 'react';
import { ANCHOR_NOW, type MonthRange, monthRange } from '@/lib/view-data';
import { MONTH_NAMES, MONTH_SHORT } from './tokens';

export type CalendarViewType = 'day' | '4days' | 'week' | 'month';

export interface ScrollTarget {
  /** Local-midnight timestamp of the 1st of the month to scroll into view. */
  monthMs: number;
  /** Bumping nonce so repeated requests for the same month still fire. */
  nonce: number;
}

export interface CalendarState {
  anchorMs: number;
  viewType: CalendarViewType;
  /** Local-midnight Sunday the week view is anchored to. */
  weekStartMs: number;
  /** Local-midnight day the day view is anchored to. */
  dayStartMs: number;
  /** Local-midnight first day of the 4-day strip. */
  fourDayStartMs: number;
  range: MonthRange;
  /** Month-grid scroll request (month view only). */
  scrollTarget: ScrollTarget;
  /** Period label shown beside the nav arrows. */
  periodLabel: string;
  setViewType: (type: CalendarViewType) => void;
  goPrev: () => void;
  goNext: () => void;
  goToday: () => void;
}

function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function addMonths(anchorMs: number, delta: number): number {
  const d = new Date(anchorMs);
  return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
}

function addDays(anchorMs: number, delta: number): number {
  const d = new Date(anchorMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta).getTime();
}

function startOfWeek(anchorMs: number): number {
  const d = new Date(anchorMs);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function rangeLabel(startMs: number, days: number): string {
  const start = new Date(startMs);
  const end = new Date(startMs);
  end.setDate(end.getDate() + days - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`;
  const endLabel = sameMonth
    ? `${end.getDate()}`
    : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
  return `${startLabel} - ${endLabel}, ${end.getFullYear()}`;
}

export function useCalendarState(): CalendarState {
  const [anchorMs, setAnchorMs] = useState(ANCHOR_NOW);
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget>(() => ({
    monthMs: startOfMonth(ANCHOR_NOW),
    nonce: 0,
  }));

  const range = useMemo(() => monthRange(anchorMs), [anchorMs]);
  const weekStartMs = useMemo(() => startOfWeek(anchorMs), [anchorMs]);
  const dayStartMs = useMemo(() => {
    const d = new Date(anchorMs);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [anchorMs]);
  const fourDayStartMs = dayStartMs;

  const periodLabel = useMemo(() => {
    const d = new Date(anchorMs);
    if (viewType === 'week') return rangeLabel(weekStartMs, 7);
    if (viewType === '4days') return rangeLabel(dayStartMs, 4);
    if (viewType === 'day') {
      return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, [anchorMs, viewType, weekStartMs, dayStartMs]);

  const bumpScroll = useCallback((monthMs: number) => {
    setScrollTarget((prev) => ({ monthMs, nonce: prev.nonce + 1 }));
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (viewType === 'month') {
        setScrollTarget((prev) => ({
          monthMs: addMonths(prev.monthMs, dir),
          nonce: prev.nonce + 1,
        }));
        return;
      }
      setAnchorMs((prev) => {
        if (viewType === 'week') return addDays(prev, dir * 7);
        if (viewType === '4days') return addDays(prev, dir * 4);
        return addDays(prev, dir);
      });
    },
    [viewType],
  );

  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);
  const goToday = useCallback(() => {
    setAnchorMs(ANCHOR_NOW);
    bumpScroll(startOfMonth(ANCHOR_NOW));
  }, [bumpScroll]);

  return {
    anchorMs,
    viewType,
    weekStartMs,
    dayStartMs,
    fourDayStartMs,
    range,
    scrollTarget,
    periodLabel,
    setViewType,
    goPrev,
    goNext,
    goToday,
  };
}
