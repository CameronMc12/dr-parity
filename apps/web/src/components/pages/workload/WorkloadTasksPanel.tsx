'use client';

/**
 * The right-hand "Tasks" panel that ClickUp pins beside the workload grid. It
 * surfaces the work that is NOT charted on the lanes, bucketed into four tabs:
 *
 *   Unscheduled · No estimate · Overdue · Unassigned
 *
 * A "Sort by <key>" dropdown reorders the active bucket (and the caret flips its
 * direction), the count reads "<N> tasks", and each row opens the task modal on
 * click / the task context menu on right-click. The header search collapses the
 * row list to a filter input; the collapse chevron hides the whole panel.
 *
 * Everything is driven by real task data from the workspace store — no dead
 * controls. Pure-derivation buckets/sorts live in `periods.ts`.
 */

import { useMemo, useState } from 'react';
import type { Task } from '@/lib/view-data';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { WL } from './tokens';
import {
  PANEL_TABS,
  PANEL_SORTS,
  bucketPanelTasks,
  sortPanelTasks,
  type PanelTab,
  type PanelSort,
} from './periods';

interface WorkloadTasksPanelProps {
  tasks: Task[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

function SearchIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={1.8} />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 5l-6 7 6 7" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <line x1="19" y1="4" x2="19" y2="20" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

function SortCaret({ asc }: { asc: boolean }) {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ transform: asc ? 'none' : 'rotate(180deg)', transition: 'transform 120ms' }}
    >
      <path d="M12 5l6 8H6l6-8z" fill="currentColor" />
    </svg>
  );
}

function StatusRing({ color }: { color: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.4" stroke={color} strokeWidth={1.6} />
      <circle cx="8" cy="8" r="2.6" fill={color} />
    </svg>
  );
}

function IconBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? WL.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? WL.textPrimary : WL.textSecondary,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

export function WorkloadTasksPanel({
  tasks,
  collapsed,
  onToggleCollapse,
  onOpenTask,
  onContextMenu,
}: WorkloadTasksPanelProps) {
  const [tab, setTab] = useState<PanelTab>('Unscheduled');
  const [sort, setSort] = useState<PanelSort>('Status');
  const [asc, setAsc] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const buckets = useMemo(() => bucketPanelTasks(tasks), [tasks]);

  const rows = useMemo(() => {
    const bucket = buckets[tab];
    const filtered = query.trim()
      ? bucket.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
      : bucket;
    return sortPanelTasks(filtered, sort, asc);
  }, [buckets, tab, query, sort, asc]);

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          flexShrink: 0,
          borderLeft: `1px solid ${WL.gridBorderStrong}`,
          background: WL.panelBg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 10,
        }}
      >
        <IconBtn label="Expand tasks panel" onClick={onToggleCollapse}>
          <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
            <CollapseIcon />
          </span>
        </IconBtn>
        <span
          style={{
            marginTop: 12,
            writingMode: 'vertical-rl',
            fontSize: 12,
            fontWeight: 600,
            color: WL.textSecondary,
            letterSpacing: 0.4,
          }}
        >
          Tasks
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="workload-tasks-panel"
      style={{
        width: WL.panelWidth,
        flexShrink: 0,
        borderLeft: `1px solid ${WL.gridBorderStrong}`,
        background: WL.panelBg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 40,
          padding: '0 8px 0 16px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: WL.textPrimary, flex: 1 }}>
          Tasks
        </span>
        <IconBtn
          label="Search tasks"
          active={searchOpen}
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery('');
          }}
        >
          <SearchIcon />
        </IconBtn>
        <IconBtn label="Collapse tasks panel" onClick={onToggleCollapse}>
          <CollapseIcon />
        </IconBtn>
      </div>

      {searchOpen && (
        <div style={{ padding: '0 12px 8px' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks…"
            style={{
              width: '100%',
              height: 30,
              padding: '0 10px',
              background: WL.inputBg,
              border: `1px solid ${WL.gridBorderStrong}`,
              borderRadius: 6,
              color: WL.textPrimary,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 2,
          padding: '0 12px',
          borderBottom: `1px solid ${WL.gridBorder}`,
          flexShrink: 0,
        }}
      >
        {PANEL_TABS.map((t) => {
          const active = t === tab;
          const count = buckets[t].length;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              data-testid={`workload-panel-tab-${t.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => setTab(t)}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 34,
                padding: '0 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? WL.textPrimary : WL.textMuted,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {t}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? WL.textSecondary : WL.textMuted,
                  }}
                >
                  {count}
                </span>
              )}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: WL.accent,
                    borderRadius: 2,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Sort + count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 36,
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: WL.textMuted }}>
          Sort by
          <Menu
            width={160}
            trigger={({ ref, onClick }) => (
              <button
                ref={ref}
                onClick={onClick}
                data-testid="workload-panel-sort"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: WL.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                  padding: 0,
                }}
              >
                {sort}
              </button>
            )}
          >
            {PANEL_SORTS.map((s) => (
              <MenuItem
                key={s}
                label={s}
                active={s === sort}
                onSelect={() => setSort(s)}
              />
            ))}
          </Menu>
          <button
            type="button"
            aria-label={asc ? 'Sort descending' : 'Sort ascending'}
            onClick={() => setAsc((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: WL.textSecondary,
              padding: 0,
            }}
          >
            <SortCaret asc={asc} />
          </button>
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: WL.textMuted }}>
          {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Task rows */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 12px' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '24px 8px', fontSize: 13, color: WL.textMuted, textAlign: 'center' }}>
            No {tab.toLowerCase()} tasks.
          </div>
        ) : (
          rows.map((task) => (
            <PanelRow
              key={task.id}
              task={task}
              onOpenTask={onOpenTask}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PanelRow({
  task,
  onOpenTask,
  onContextMenu,
}: {
  task: Task;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="workload-panel-row"
      onClick={() => onOpenTask(task.id)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 34,
        padding: '0 8px',
        background: hover ? WL.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
        color: WL.textPrimary,
        fontSize: 13,
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
    >
      <StatusRing color={task.statusColor || WL.textMuted} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.name}
      </span>
    </button>
  );
}
