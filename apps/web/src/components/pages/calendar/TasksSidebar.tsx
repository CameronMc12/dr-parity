'use client';

/**
 * Right-hand task sidebar for the Calendar view (ClickUp parity).
 *
 * Collapsed → a thin vertical rail showing "N Unscheduled" / "N Overdue"
 * (rotated) and an expand toggle. Expanded → a panel with a header ("Tasks" +
 * search + collapse arrow), Unscheduled/Overdue tabs, a "Sort by <field> ▲ — N
 * tasks" row, the draggable task list, and a bottom "Your calendars  0 / + Add
 * Calendar" footer (Add Calendar opens a small visual popover).
 *
 * Dragging a row onto a day cell schedules it (handled by DayCell's drop +
 * calendar actions). The panel itself is a drop target that clears a dragged
 * calendar chip's due date (unschedule).
 */

import { useMemo, useState } from 'react';
import type { Task } from '@/lib/view-data';
import { ChevronRightIcon, SearchIcon, PlusIcon } from '@/components/ui/Icons';
import { CAL } from './tokens';
import { SidebarTaskRow } from './SidebarTaskRow';
import type { CalendarActions } from './use-calendar-actions';
import {
  overdueTasks,
  sortSidebarTasks,
  SORT_FIELD_LABELS,
  unscheduledTasks,
  type SidebarSortField,
  type SidebarTab,
  type SortDir,
} from './sidebar-tasks';

interface TasksSidebarProps {
  tasks: Task[];
  actions: CalendarActions;
  onChipContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function TasksSidebar({ tasks, actions, onChipContextMenu }: TasksSidebarProps) {
  // Real ClickUp opens the Calendar with this rail COLLAPSED (the capture shows
  // the thin "N Unscheduled / N Overdue" rail, not the expanded panel).
  const [collapsed, setCollapsed] = useState(true);
  const [tab, setTab] = useState<SidebarTab>('unscheduled');
  const [q, setQ] = useState('');
  const [sortField, setSortField] = useState<SidebarSortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const unscheduled = useMemo(() => unscheduledTasks(tasks), [tasks]);
  const overdue = useMemo(() => overdueTasks(tasks), [tasks]);

  const activeList = tab === 'unscheduled' ? unscheduled : overdue;
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = query
      ? activeList.filter((t) => t.name.toLowerCase().includes(query))
      : activeList;
    return sortSidebarTasks(filtered, sortField, sortDir);
  }, [activeList, q, sortField, sortDir]);

  if (collapsed) {
    return (
      <CollapsedRail
        unscheduledCount={unscheduled.length}
        overdueCount={overdue.length}
        onExpand={() => setCollapsed(false)}
      />
    );
  }

  return (
    <div
      data-testid="calendar-tasks-sidebar"
      onDragOver={(e) => {
        if (!actions.draggingId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) actions.unscheduleTask(taskId);
      }}
      style={{
        width: CAL.sidebarWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderLeft: `1px solid ${CAL.gridBorder}`,
        background: CAL.panelBg,
      }}
    >
      <SidebarHeader q={q} onSearch={setQ} onCollapse={() => setCollapsed(true)} />
      <SidebarTabs
        tab={tab}
        onTab={setTab}
        unscheduledCount={unscheduled.length}
        overdueCount={overdue.length}
      />
      <SortRow
        field={sortField}
        dir={sortDir}
        count={visible.length}
        onField={(f) => setSortField(f)}
        onToggleDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' }}>
        {visible.length === 0 ? (
          <p style={{ padding: '16px 8px', fontSize: 12, color: CAL.textMuted, margin: 0 }}>
            {tab === 'unscheduled' ? 'No unscheduled tasks.' : 'No overdue tasks.'}
          </p>
        ) : (
          visible.map((task) => (
            <SidebarTaskRow
              key={task.id}
              task={task}
              overdue={tab === 'overdue'}
              onDragStart={actions.beginDrag}
              onDragEnd={actions.endDrag}
              onContextMenu={onChipContextMenu}
            />
          ))
        )}
      </div>

      <CalendarsFooter />
    </div>
  );
}

function SidebarHeader({
  q,
  onSearch,
  onCollapse,
}: {
  q: string;
  onSearch: (v: string) => void;
  onCollapse: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 12px 8px',
        borderBottom: `1px solid ${CAL.gridBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: CAL.textPrimary }}>Tasks</span>
        <RailButton aria-label="Collapse sidebar" onClick={onCollapse}>
          <ChevronRightIcon size={16} />
        </RailButton>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 8px',
          borderRadius: 6,
          background: CAL.inputBg,
          border: `1px solid ${CAL.gridBorder}`,
        }}
      >
        <SearchIcon size={14} />
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search tasks"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: CAL.textPrimary,
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}

function SidebarTabs({
  tab,
  onTab,
  unscheduledCount,
  overdueCount,
}: {
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  unscheduledCount: number;
  overdueCount: number;
}) {
  const tabs: { key: SidebarTab; label: string; count: number }[] = [
    { key: 'unscheduled', label: 'Unscheduled', count: unscheduledCount },
    { key: 'overdue', label: 'Overdue', count: overdueCount },
  ];
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${CAL.gridBorder}` }}>
      {tabs.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            data-testid={`calendar-sidebar-tab-${t.key}`}
            onClick={() => onTab(t.key)}
            style={{
              flex: 1,
              height: 36,
              border: 'none',
              borderBottom: active ? `2px solid ${CAL.accent}` : '2px solid transparent',
              background: 'transparent',
              color: active ? CAL.textPrimary : CAL.textSecondary,
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 6, color: CAL.textMuted, fontWeight: 500 }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SortRow({
  field,
  dir,
  count,
  onField,
  onToggleDir,
}: {
  field: SidebarSortField;
  dir: SortDir;
  count: number;
  onField: (f: SidebarSortField) => void;
  onToggleDir: () => void;
}) {
  const fields: SidebarSortField[] = ['priority', 'name', 'dueDate'];
  const cycle = () => {
    const idx = fields.indexOf(field);
    onField(fields[(idx + 1) % fields.length] ?? 'priority');
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 30,
        padding: '0 12px',
        fontSize: 12,
        color: CAL.textSecondary,
        borderBottom: `1px solid ${CAL.gridBorder}`,
      }}
    >
      <button
        type="button"
        onClick={cycle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          border: 'none',
          background: 'transparent',
          color: CAL.textSecondary,
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Sort by {SORT_FIELD_LABELS[field]}
      </button>
      <button
        type="button"
        aria-label={`Sort ${dir === 'asc' ? 'ascending' : 'descending'}`}
        onClick={onToggleDir}
        style={{
          border: 'none',
          background: 'transparent',
          color: CAL.textSecondary,
          cursor: 'pointer',
          fontSize: 11,
          lineHeight: 1,
          padding: 2,
        }}
      >
        {dir === 'asc' ? '▲' : '▼'}
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ color: CAL.textMuted }}>{count} tasks</span>
    </div>
  );
}

function CalendarsFooter() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        padding: '0 12px',
        borderTop: `1px solid ${CAL.gridBorder}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: CAL.textSecondary, fontWeight: 500 }}>Your calendars</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: CAL.textMuted }}>0</span>
        <button
          type="button"
          data-testid="calendar-add-calendar"
          onClick={() => setAddOpen((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 8px',
            border: `1px solid ${CAL.gridBorder}`,
            borderRadius: 6,
            background: addOpen ? CAL.hoverBg : 'transparent',
            color: CAL.textSecondary,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <PlusIcon size={12} /> Add Calendar
        </button>
      </div>

      {addOpen && (
        <div
          role="dialog"
          aria-label="Add calendar"
          style={{
            position: 'absolute',
            right: 12,
            bottom: 48,
            width: 220,
            padding: 8,
            background: CAL.panelBg,
            border: `1px solid ${CAL.gridBorder}`,
            borderRadius: 8,
            boxShadow: 'var(--cu-shadow-lg, 0 8px 28px rgba(0,0,0,0.5))',
            zIndex: 50,
          }}
        >
          {['Google Calendar', 'Outlook Calendar', 'Apple Calendar'].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setAddOpen(false)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: CAL.textPrimary,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsedRail({
  unscheduledCount,
  overdueCount,
  onExpand,
}: {
  unscheduledCount: number;
  overdueCount: number;
  onExpand: () => void;
}) {
  return (
    <div
      data-testid="calendar-tasks-rail"
      style={{
        width: CAL.sidebarRailWidth,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        minHeight: 0,
        padding: '10px 0',
        gap: 14,
        borderLeft: `1px solid ${CAL.gridBorder}`,
        background: CAL.bg,
      }}
    >
      <RailButton aria-label="Expand sidebar" onClick={onExpand}>
        <ListLinesIcon />
      </RailButton>
      <div style={{ width: 18, height: 1, background: CAL.gridBorder, flexShrink: 0 }} />
      <RailCount label="Unscheduled" count={unscheduledCount} onClick={onExpand} />
      <RailCount label="Overdue" count={overdueCount} accent onClick={onExpand} />
    </div>
  );
}

function ListLinesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RailCount({
  label,
  count,
  accent = false,
  onClick,
}: {
  label: string;
  count: number;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        border: 'none',
        background: 'transparent',
        color: accent ? CAL.overdue : CAL.textSecondary,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        style={{
          minWidth: 18,
          padding: '1px 5px',
          borderRadius: 9,
          background: CAL.hoverBg,
          color: accent ? CAL.overdue : CAL.textSecondary,
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {count}
      </span>
      {label}
    </button>
  );
}

function RailButton({
  children,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        border: 'none',
        borderRadius: 6,
        background: hover ? CAL.hoverBg : 'transparent',
        color: CAL.textSecondary,
        cursor: 'pointer',
        transition: 'background 120ms',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
