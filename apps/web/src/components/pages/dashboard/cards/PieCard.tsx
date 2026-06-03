'use client';

/**
 * PieCard — a donut breakdown of "Total Tasks by <dimension>". The dimension is
 * driven by `card.config.grouping` (assignee | status | priority), defaulting to
 * assignee. Slices come straight off the memoised dashboard metrics; priority is
 * derived locally (no helper exists for it). The donut itself is the reusable
 * <Pie> SVG primitive; the centre total and the legend (with percentages) live
 * here so the card owns its own layout and scroll.
 */

import { useMemo } from 'react';
import type { CardFilters } from '@/store/dashboard';
import type { Task } from '@/store/workspace/types';
import { useDashboardMetrics } from '../dashboard-data';
import { DASH, paletteColor } from '../tokens';
import { Pie, type ChartDatum } from './chart-svg';
import type { CardRenderProps } from './card-props';

/** True when a status label survives the card's pinned status filter. */
function keepStatus(status: string, filters?: CardFilters): boolean {
  if (!filters || filters.status.length === 0) return true;
  return filters.status.includes(status);
}

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
    if (!keepStatus(t.status, filters)) return false;
    if (filters.assignee.length > 0) {
      return t.assignees.some((a) => filters.assignee.includes(a.id));
    }
    return true;
  });
}

/** Bucket tasks by priority label, preserving each priority's own colour. */
function priorityData(tasks: Task[]): ChartDatum[] {
  const map = new Map<string, ChartDatum>();
  for (const t of tasks) {
    const label = t.priority ?? 'No priority';
    const existing = map.get(label);
    if (existing) map.set(label, { ...existing, value: existing.value + 1 });
    else
      map.set(label, {
        label,
        color: t.priorityColor ?? DASH.textMuted,
        value: 1,
      });
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function dataFor(
  card: CardRenderProps['card'],
  m: ReturnType<typeof useDashboardMetrics>,
): ChartDatum[] {
  const grouping = card.config?.grouping ?? 'assignee';

  if (grouping === 'status') {
    return m.statusSlices
      .filter((s) => keepStatus(s.status, card.filters))
      .map((s) => ({ label: s.status, color: s.color, value: s.count }));
  }
  if (grouping === 'priority') {
    return priorityData(filterTasks(m.tasks, card.filters));
  }
  const src = card.config?.openOnly ? m.openByAssignee : m.byAssignee;
  return src
    .filter((s) => keepAssignee(s.member?.id ?? null, card.filters))
    .map((s, i) => ({
      label: s.member?.name ?? 'Unassigned',
      color: s.member?.color ?? paletteColor(i),
      value: s.count,
    }));
}

export function PieCard({ card, listId, viewId: _viewId }: CardRenderProps) {
  const metrics = useDashboardMetrics(listId);
  const data = useMemo(() => dataFor(card, metrics), [card, metrics]);
  const total = useMemo(() => data.reduce((n, d) => n + d.value, 0), [data]);

  if (total === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: DASH.textMuted,
        }}
      >
        No tasks to chart yet.
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '8px 18px',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Pie data={data} size={124} innerRatio={0.62} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: DASH.textPrimary }}>{total}</span>
          <span style={{ fontSize: 10, color: DASH.textMuted }}>tasks</span>
        </div>
      </div>

      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          overflowY: 'auto',
          maxHeight: '100%',
          flex: 1,
        }}
      >
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li
              key={`${d.label}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: d.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  color: DASH.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.label}
              </span>
              <span style={{ color: DASH.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {d.value}
              </span>
              <span
                style={{
                  color: DASH.textMuted,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 30,
                  textAlign: 'right',
                }}
              >
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
