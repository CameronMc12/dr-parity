'use client';

/**
 * BarCard — a bar chart whose dataset is chosen by `card.config.metric`:
 *
 *   'completedThisWeek' → vertical bars, one per day of the last 7 days
 *                         (anchored to ANCHOR_NOW). "No Results" when empty.
 *   'inProgress' (open assignee) → vertical bars of open tasks per assignee.
 *   default ('total' / status) → horizontal bars of workload per status.
 *
 * All counts come from the memoised dashboard metrics (plus a local day-bucket
 * pass for the weekly view). Rendering is delegated to the reusable <Bars> SVG
 * primitive, which owns the axis, gridlines, and hover tooltips.
 */

import { useMemo } from 'react';
import { ANCHOR_NOW, startOfDay } from '@/lib/view-dates';
import type { CardFilters } from '@/store/dashboard';
import type { Task } from '@/store/workspace/types';
import { useDashboardMetrics } from '../dashboard-data';
import { DASH, paletteColor } from '../tokens';
import { Bars, type ChartDatum } from './chart-svg';
import type { CardRenderProps } from './card-props';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** True when an assignee id survives the card's pinned assignee filter. */
function keepAssignee(memberId: string | null, filters?: CardFilters): boolean {
  if (!filters || filters.assignee.length === 0) return true;
  return memberId != null && filters.assignee.includes(memberId);
}

/** Filter raw tasks by the card's pinned status + assignee selections. */
function filterTasks(tasks: Task[], filters?: CardFilters): Task[] {
  if (!filters || (filters.status.length === 0 && filters.assignee.length === 0)) {
    return tasks;
  }
  return tasks.filter((t) => {
    if (filters.status.length > 0 && !filters.status.includes(t.status)) return false;
    if (filters.assignee.length > 0) {
      return t.assignees.some((a) => filters.assignee.includes(a.id));
    }
    return true;
  });
}

/**
 * Local-midnight timestamp `n` calendar days before `base`. Uses setDate so the
 * arithmetic survives DST transitions (a raw `n * DAY_MS` subtraction would skew
 * on the day a clock change adds/drops an hour).
 */
function dayStartBack(base: number, n: number): number {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return startOfDay(d.getTime());
}

/** Bucket completed tasks into the trailing 7 days (oldest → ANCHOR_NOW). */
function completedByDay(tasks: Task[]): ChartDatum[] {
  const today = startOfDay(ANCHOR_NOW);
  const buckets = Array.from({ length: 7 }, (_, i) => ({
    dayStart: dayStartBack(today, 6 - i),
    count: 0,
  }));
  for (const t of tasks) {
    const closedAt = t.dateUpdated ?? t.dateCreated;
    if (closedAt == null) continue;
    const day = startOfDay(closedAt);
    const bucket = buckets.find((b) => b.dayStart === day);
    if (bucket) bucket.count += 1;
  }
  return buckets.map((b) => ({
    label: DAY_LABELS[new Date(b.dayStart).getDay()] ?? '',
    color: DASH.green,
    value: b.count,
  }));
}

interface Resolved {
  data: ChartDatum[];
  orientation: 'horizontal' | 'vertical';
  /** Show the "No Results" empty state instead of an axis when every value is 0. */
  emptyWhenZero: boolean;
}

function resolve(
  card: CardRenderProps['card'],
  m: ReturnType<typeof useDashboardMetrics>,
): Resolved {
  const metric = card.config?.metric;
  const filters = card.filters;

  if (metric === 'completedThisWeek') {
    return {
      data: completedByDay(filterTasks(m.completedThisWeek, filters)),
      orientation: 'vertical',
      emptyWhenZero: true,
    };
  }

  if (metric === 'inProgress' || card.config?.grouping === 'assignee') {
    const slices = card.config?.openOnly ? m.openByAssignee : m.byAssignee;
    return {
      data: slices
        .filter((s) => keepAssignee(s.member?.id ?? null, filters))
        .map((s, i) => ({
          label: s.member?.name ?? 'Unassigned',
          color: s.member?.color ?? paletteColor(i),
          value: s.count,
        })),
      orientation: 'vertical',
      emptyWhenZero: false,
    };
  }

  // Default: workload by status, horizontal bars.
  return {
    data: m.statusSlices
      .filter((s) => !filters || filters.status.length === 0 || filters.status.includes(s.status))
      .map((s) => ({ label: s.status, color: s.color, value: s.count })),
    orientation: 'horizontal',
    emptyWhenZero: false,
  };
}

export function BarCard({ card, listId, viewId: _viewId }: CardRenderProps) {
  const metrics = useDashboardMetrics(listId);
  const { data, orientation, emptyWhenZero } = useMemo(() => resolve(card, metrics), [card, metrics]);
  const totalValue = useMemo(() => data.reduce((n, d) => n + d.value, 0), [data]);

  const isEmpty = data.length === 0 || (emptyWhenZero && totalValue === 0);
  if (isEmpty) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          color: DASH.textMuted,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>No Results</span>
        <span style={{ fontSize: 11 }}>Nothing matched in this range.</span>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', padding: '12px 18px' }}>
      <Bars data={data} orientation={orientation} />
    </div>
  );
}
