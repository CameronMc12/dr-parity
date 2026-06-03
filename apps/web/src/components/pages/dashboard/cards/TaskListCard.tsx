'use client';

/**
 * TaskListCard — a compact, scrollable task list. Honours the card's metric
 * ('completedThisWeek' filters to the recent-closed set; otherwise shows all
 * list tasks) plus any pinned status/assignee filters in `card.filters`. Each
 * row shows the status dot, name, assignee avatar, and due date; clicking opens
 * the task modal. A persistent footer adds a new task to the underlying list.
 */

import { useMemo, useRef, useState } from 'react';
import { useDashboardMetrics } from '../dashboard-data';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId } from '@/store/workspace/hooks';
import { useUiStore } from '@/store/ui-store';
import { ANCHOR_NOW, DAY_MS } from '@/lib/view-dates';
import { DASH } from '../tokens';
import type { Assignee, Task } from '@/store/workspace/types';
import type { CardFilters } from '@/store/dashboard';
import type { CardRenderProps } from './card-props';

function baseRows(
  card: CardRenderProps['card'],
  m: ReturnType<typeof useDashboardMetrics>,
): Task[] {
  if (card.config?.metric === 'completedThisWeek') return m.completedThisWeek;
  return m.tasks;
}

function applyFilters(rows: Task[], filters: CardFilters | undefined): Task[] {
  if (!filters) return rows;
  const { status, assignee } = filters;
  if (status.length === 0 && assignee.length === 0) return rows;
  const statusSet = new Set(status);
  const assigneeSet = new Set(assignee);
  return rows.filter((t) => {
    if (statusSet.size > 0 && !statusSet.has(t.status)) return false;
    if (
      assigneeSet.size > 0 &&
      !t.assignees.some((a) => assigneeSet.has(a.id))
    ) {
      return false;
    }
    return true;
  });
}

function dueLabel(due: number | null): { text: string; overdue: boolean } | null {
  if (due == null) return null;
  const days = Math.round((due - ANCHOR_NOW) / DAY_MS);
  if (days === 0) return { text: 'Today', overdue: false };
  if (days === 1) return { text: 'Tomorrow', overdue: false };
  if (days === -1) return { text: 'Yesterday', overdue: true };
  if (days < 0) return { text: `${-days}d ago`, overdue: true };
  if (days < 7) return { text: `${days}d`, overdue: false };
  return {
    text: new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue: false,
  };
}

function Avatar({ assignee }: { assignee: Assignee }) {
  return (
    <span
      title={assignee.name}
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        flexShrink: 0,
        background: assignee.color,
        color: '#fff',
        fontSize: 9,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textTransform: 'uppercase',
      }}
    >
      {assignee.initials}
    </span>
  );
}

export function TaskListCard({ card, listId }: CardRenderProps) {
  const metrics = useDashboardMetrics(listId);
  const openTask = useUiStore((s) => s.openTask);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const myId = useCurrentMemberId();

  const rows = useMemo(
    () => applyFilters(baseRows(card, metrics), card.filters),
    [card, metrics],
  );

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const name = draft.trim();
    if (!name) return;
    const me = metrics.members.find((m) => m.id === myId);
    const assignees: Assignee[] = me
      ? [{ id: me.id, name: me.name, initials: me.initials, color: me.color }]
      : [];
    createTask({ name, listId, assignees });
    setDraft('');
    inputRef.current?.focus();
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 18, fontSize: 12, color: DASH.textMuted }}>
            No tasks match this card.
          </div>
        ) : (
          rows.map((t) => {
            const due = dueLabel(t.dueDate);
            const lead = t.assignees[0];
            return (
              <button
                key={t.id}
                onClick={() => openTask(t.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 18px',
                  minHeight: 34,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  color: DASH.textSecondary,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = DASH.cardHoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: t.statusColor,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.name}
                </span>
                {due && (
                  <span
                    style={{
                      fontSize: 11,
                      flexShrink: 0,
                      color: due.overdue ? DASH.red : DASH.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {due.text}
                  </span>
                )}
                {lead && <Avatar assignee={lead} />}
              </button>
            );
          })
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          minHeight: 34,
          borderTop: `1px solid ${DASH.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={add}
          aria-label="Add task"
          style={{
            color: DASH.textMuted,
            display: 'inline-flex',
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder="Add Task"
          aria-label="Add task to list"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: DASH.textPrimary,
            background: 'transparent',
            fontFamily: 'inherit',
          }}
        />
      </div>
    </div>
  );
}
