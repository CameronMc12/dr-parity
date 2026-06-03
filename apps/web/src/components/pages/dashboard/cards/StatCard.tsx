'use client';

/**
 * StatCard — a single big-number metric (Unassigned / In Progress / Completed /
 * Completed this week / Total). The headline count is live off the list's real
 * tasks. Clicking the number opens a popover listing exactly the tasks that
 * metric counts; each row opens that task's detail modal.
 */

import { useMemo, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { ANCHOR_NOW } from '@/lib/view-dates';
import type { CardFilters, CardMetric } from '@/store/dashboard';
import type { Task } from '@/store/workspace/types';
import { isComplete, useDashboardMetrics } from '../dashboard-data';
import { DASH } from '../tokens';
import { Menu, MenuHeading } from '@/components/ui/Menu';
import type { CardRenderProps } from './card-props';

/** Anchor date shown so users know the "this week" window is frozen, not live. */
const ANCHOR_LABEL = new Date(ANCHOR_NOW).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Narrow tasks by the card's pinned status + assignee filters (board filter). */
function applyFilters(tasks: Task[], filters: CardFilters | undefined): Task[] {
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

/** The exact task subset a metric counts, so the popover matches the number. */
function tasksFor(metric: CardMetric | undefined, tasks: Task[], thisWeek: Task[]): Task[] {
  switch (metric) {
    case 'unassigned':
      return tasks.filter((t) => t.assignees.length === 0);
    case 'inProgress':
      return tasks.filter((t) => t.statusType === 'custom');
    case 'completed':
      return tasks.filter(isComplete);
    case 'completedThisWeek':
      return thisWeek;
    case 'total':
    default:
      return tasks;
  }
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: color || DASH.textMuted,
      }}
    />
  );
}

function TaskRow({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={() => onOpen(task.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        minHeight: 30,
        padding: '0 14px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? DASH.cardHoverBg : 'transparent',
        color: DASH.textPrimary,
        fontSize: 13,
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <StatusDot color={task.statusColor} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.name}
      </span>
    </button>
  );
}

export function StatCard({ card, listId }: CardRenderProps) {
  const metrics = useDashboardMetrics(listId);
  const openTask = useUiStore((s) => s.openTask);

  const metric = card.config?.metric;
  const filters = card.filters;
  const tasks = useMemo(() => {
    const base = applyFilters(metrics.tasks, filters);
    const week = applyFilters(metrics.completedThisWeek, filters);
    return tasksFor(metric, base, week);
  }, [metric, filters, metrics.tasks, metrics.completedThisWeek]);
  const value = tasks.length;
  const isFrozenWindow = metric === 'completedThisWeek';

  return (
    <Menu
      align="left"
      width={280}
      trigger={({ ref, onClick }) => (
        <button
          ref={ref}
          onClick={onClick}
          aria-label={`${value} ${card.title}, open task list`}
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 6,
            padding: '4px 18px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <span
            style={{
              fontSize: 40,
              lineHeight: 1,
              fontWeight: 700,
              color: DASH.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 12, color: DASH.textMuted }}>{card.title}</span>
          {isFrozenWindow && (
            <span style={{ fontSize: 11, color: DASH.textMuted, opacity: 0.8 }}>
              as of {ANCHOR_LABEL}
            </span>
          )}
        </button>
      )}
    >
      <MenuHeading>
        {value} {value === 1 ? 'task' : 'tasks'}
      </MenuHeading>
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '2px 0' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '8px 14px', fontSize: 13, color: DASH.textMuted }}>
            Nothing here yet.
          </div>
        ) : (
          tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={openTask} />)
        )}
      </div>
    </Menu>
  );
}
