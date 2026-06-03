'use client';

/**
 * CalculationCard — a single derived figure over the list. The `metric` in
 * card.config selects what is computed (completion rate by default; or a count
 * of total / completed / in-progress / unassigned tasks). Pinned status/assignee
 * filters in card.filters narrow the source set first. The big number sits above
 * a descriptive label, matching ClickUp's calculation tile.
 */

import { useMemo } from 'react';
import { useDashboardMetrics } from '../dashboard-data';
import { DASH } from '../tokens';
import type { Task } from '@/store/workspace/types';
import type { CardFilters, CardMetric } from '@/store/dashboard';
import type { CardRenderProps } from './card-props';

const COMPLETE = new Set(['closed', 'done']);

function applyFilters(rows: Task[], filters: CardFilters | undefined): Task[] {
  if (!filters) return rows;
  const { status, assignee } = filters;
  if (status.length === 0 && assignee.length === 0) return rows;
  const statusSet = new Set(status);
  const assigneeSet = new Set(assignee);
  return rows.filter((t) => {
    if (statusSet.size > 0 && !statusSet.has(t.status)) return false;
    if (assigneeSet.size > 0 && !t.assignees.some((a) => assigneeSet.has(a.id))) {
      return false;
    }
    return true;
  });
}

interface Calc {
  value: string;
  label: string;
}

function compute(metric: CardMetric | undefined, tasks: Task[]): Calc {
  const total = tasks.length;
  const done = tasks.reduce((n, t) => (COMPLETE.has(t.statusType) ? n + 1 : n), 0);
  const active = tasks.reduce((n, t) => (t.statusType === 'custom' ? n + 1 : n), 0);
  const unassigned = tasks.reduce((n, t) => (t.assignees.length === 0 ? n + 1 : n), 0);

  switch (metric) {
    case 'total':
      return { value: total.toLocaleString(), label: 'Total tasks' };
    case 'completed':
      return { value: done.toLocaleString(), label: 'Completed tasks' };
    case 'inProgress':
      return { value: active.toLocaleString(), label: 'In progress' };
    case 'unassigned':
      return { value: unassigned.toLocaleString(), label: 'Unassigned tasks' };
    default: {
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      return { value: `${pct}%`, label: `Completion rate (${done}/${total})` };
    }
  }
}

export function CalculationCard({ card, listId }: CardRenderProps) {
  const m = useDashboardMetrics(listId);
  const tasks = useMemo(
    () => applyFilters(m.tasks, card.filters),
    [m.tasks, card.filters],
  );
  const calc = useMemo(
    () => compute(card.config?.metric, tasks),
    [card.config?.metric, tasks],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4px 18px',
      }}
    >
      <span
        style={{
          fontSize: 36,
          lineHeight: 1,
          fontWeight: 700,
          color: DASH.accent,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {calc.value}
      </span>
      <span style={{ marginTop: 6, fontSize: 12, color: DASH.textMuted }}>
        {calc.label}
      </span>
    </div>
  );
}
