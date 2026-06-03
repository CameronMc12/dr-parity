'use client';

/**
 * Right-hand "Tasks" panel for the Timeline (ClickUp parity). Splits unplaced
 * work into two tabs:
 *   - Unscheduled : tasks with no real schedule (both startDate and dueDate null)
 *   - Overdue     : scheduled tasks whose due date is before ANCHOR_NOW
 *
 * Header carries a title + count, a search filter, and the two tabs. Below the
 * tabs an "Unassigned" group label plus a "Sort by …" dropdown control ordering.
 *
 * Rows are draggable chips: dragging a chip onto the chart drops it via the
 * chart's native drop handler (dnd.scheduleAtX → updateTask), turning the item
 * into a scheduled bar. Chips also open the task on click and expose the shared
 * right-click menu, so the panel is a fully wired surface, not a dead list.
 */

import { useMemo, useState } from 'react';
import { ANCHOR_NOW, deriveSpan } from '@/lib/view-data';
import type { Task } from '@/lib/view-data';
import { useUiStore } from '@/store/ui-store';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { SearchIcon } from '@/components/pages/list-view-icons';
import { BACKLOG_DND_MIME } from './backlog-dnd';
import {
  DEFAULT_TASK_SORT,
  TASK_PANEL_TAB_ORDER,
  TASK_PANEL_TAB_LABEL,
  TASK_SORT_LABEL,
  TASK_SORT_ORDER,
  TL,
  type TaskPanelTab,
  type TaskSortField,
} from './tokens';

/** A task is unscheduled when neither endpoint is a real date. */
function isUnscheduled(task: Task): boolean {
  return task.startDate == null && task.dueDate == null;
}

/** Scheduled task whose due date has already passed ANCHOR_NOW. */
function isOverdue(task: Task): boolean {
  if (isUnscheduled(task)) return false;
  if (task.dueDate == null) return false;
  return task.dueDate < ANCHOR_NOW;
}

/** A task with nobody assigned. */
function isUnassigned(task: Task): boolean {
  return task.assignees.length === 0;
}

const TAB_PREDICATE: Record<TaskPanelTab, (t: Task) => boolean> = {
  unscheduled: isUnscheduled,
  overdue: isOverdue,
  unassigned: isUnassigned,
};

const EMPTY_MESSAGE: Record<TaskPanelTab, string> = {
  unscheduled: 'Nothing unscheduled. Every task has a date.',
  overdue: 'No overdue tasks. Everything is on track.',
  unassigned: 'No unassigned tasks. Everyone has work.',
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function sortTasks(tasks: Task[], field: TaskSortField): Task[] {
  const copy = [...tasks];
  copy.sort((a, b) => {
    if (field === 'name') return a.name.localeCompare(b.name);
    if (field === 'dueDate') {
      const da = deriveSpan(a).end;
      const db = deriveSpan(b).end;
      return da - db;
    }
    if (field === 'priority') {
      const ra = PRIORITY_RANK[(a.priority ?? '').toLowerCase()] ?? 99;
      const rb = PRIORITY_RANK[(b.priority ?? '').toLowerCase()] ?? 99;
      return ra - rb || a.name.localeCompare(b.name);
    }
    // status
    return (a.status ?? '').localeCompare(b.status ?? '') || a.name.localeCompare(b.name);
  });
  return copy;
}

export function BacklogPanel({
  tasks,
  onClose,
  onContextMenu,
}: {
  tasks: Task[];
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const [tab, setTab] = useState<TaskPanelTab>('unscheduled');
  const [sortField, setSortField] = useState<TaskSortField>(DEFAULT_TASK_SORT);
  const [q, setQ] = useState('');

  const counts = useMemo(
    () => ({
      unscheduled: tasks.filter(isUnscheduled).length,
      overdue: tasks.filter(isOverdue).length,
      unassigned: tasks.filter(isUnassigned).length,
    }),
    [tasks],
  );

  const rows = useMemo(() => {
    const pool = tasks.filter(TAB_PREDICATE[tab]);
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? pool.filter((t) => t.name.toLowerCase().includes(needle))
      : pool;
    return sortTasks(filtered, sortField);
  }, [tasks, tab, q, sortField]);

  return (
    <div
      data-testid="timeline-tasks-panel"
      style={{
        flexShrink: 0,
        width: TL.backlogWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: TL.railBg,
        borderLeft: `1px solid ${TL.gridBorderStrong}`,
      }}
    >
      <PanelHeader q={q} onQ={setQ} onClose={onClose} />
      <TabStrip tab={tab} counts={counts} onTab={setTab} />
      <GroupSortBar sortField={sortField} onSort={setSortField} count={rows.length} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {rows.length === 0 ? (
          <p style={{ padding: '16px 8px', color: TL.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>
            {EMPTY_MESSAGE[tab]}
          </p>
        ) : (
          rows.map((task) => (
            <BacklogRow key={task.id} task={task} onContextMenu={onContextMenu} />
          ))
        )}
      </div>
    </div>
  );
}

function PanelHeader({
  q,
  onQ,
  onClose,
}: {
  q: string;
  onQ: (v: string) => void;
  onClose: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(q.length > 0);
  return (
    <header
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px 0 16px',
        borderBottom: `1px solid ${TL.gridBorder}`,
      }}
    >
      {searchOpen ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <SearchIcon size={14} />
          <input
            autoFocus
            data-testid="timeline-tasks-search-input"
            value={q}
            placeholder="Search tasks"
            onChange={(e) => onQ(e.target.value)}
            onBlur={() => {
              if (q.length === 0) setSearchOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onQ('');
                setSearchOpen(false);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: TL.textPrimary,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TL.textPrimary }}>
            Tasks
          </span>
          <IconButton
            label="Search tasks"
            testid="timeline-tasks-search"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon size={14} />
          </IconButton>
        </>
      )}
      <IconButton label="Close tasks panel" testid="timeline-tasks-close" onClick={onClose}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
      </IconButton>
    </header>
  );
}

function TabStrip({
  tab,
  counts,
  onTab,
}: {
  tab: TaskPanelTab;
  counts: Record<TaskPanelTab, number>;
  onTab: (t: TaskPanelTab) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 4,
        padding: '0 12px',
        borderBottom: `1px solid ${TL.gridBorder}`,
      }}
    >
      {TASK_PANEL_TAB_ORDER.map((t) => {
        const active = t === tab;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`timeline-tasks-tab-${t}`}
            onClick={() => onTab(t)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 38,
              padding: '0 4px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? TL.todayLine : 'transparent'}`,
              cursor: 'pointer',
              color: active ? TL.textPrimary : TL.textSecondary,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              transition: 'color 120ms',
            }}
          >
            {TASK_PANEL_TAB_LABEL[t]}
            <span
              style={{
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: active ? TL.hover : 'transparent',
                color: TL.textMuted,
                fontSize: 11,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {counts[t]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function GroupSortBar({
  sortField,
  onSort,
  count,
}: {
  sortField: TaskSortField;
  onSort: (f: TaskSortField) => void;
  count: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 36,
        padding: '0 16px',
        borderBottom: `1px solid ${TL.gridBorder}`,
      }}
    >
      <Menu
        width={170}
        align="left"
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            type="button"
            data-testid="timeline-tasks-sort"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Sort tasks"
            onClick={onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
              padding: '0 6px 0 0',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              color: TL.textSecondary,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ opacity: 0.7 }}>Sort by</span>
            <span style={{ fontWeight: 600, color: open ? TL.textPrimary : TL.textSecondary }}>
              {TASK_SORT_LABEL[sortField]}
            </span>
            {/* Ascending direction caret (ClickUp shows an up/asc chevron). */}
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 15l6-6 6 6"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      >
        {TASK_SORT_ORDER.map((f) => (
          <MenuItem
            key={f}
            label={TASK_SORT_LABEL[f]}
            active={f === sortField}
            postscript={
              f === sortField ? (
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M5 12.5l4.5 4.5L19 7"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : undefined
            }
            onSelect={() => onSort(f)}
          />
        ))}
      </Menu>
      <span style={{ fontSize: 12, color: TL.textMuted, fontWeight: 500 }}>
        {count} {count === 1 ? 'task' : 'tasks'}
      </span>
    </div>
  );
}

function IconButton({
  label,
  testid,
  onClick,
  children,
}: {
  label: string;
  testid: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: hover ? TL.hover : 'transparent',
        color: TL.textSecondary,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

function BacklogRow({
  task,
  onContextMenu,
}: {
  task: Task;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      data-testid="timeline-tasks-row"
      role="button"
      tabIndex={0}
      aria-label={`${task.name} task`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(BACKLOG_DND_MIME, task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => openTask(task.id)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: TL.backlogRowHeight,
        padding: '0 16px',
        cursor: 'grab',
        background: hover ? TL.hover : 'transparent',
        opacity: dragging ? 0.5 : 1,
        transition: 'background 120ms',
        userSelect: 'none',
      }}
    >
      {/* Status circle: a ring tinted by the task's status colour, mirroring
          ClickUp's sidebar status glyph. */}
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          flexShrink: 0,
          border: `2px solid ${task.statusColor || TL.laneFallback}`,
          boxSizing: 'border-box',
        }}
      />
      <span
        style={{
          minWidth: 0,
          fontSize: 13,
          fontWeight: 500,
          color: TL.textPrimary,
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.name}
      </span>
    </div>
  );
}
