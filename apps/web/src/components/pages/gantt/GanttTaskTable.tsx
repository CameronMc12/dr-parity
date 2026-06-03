'use client';

/**
 * Left task-table pane of the Gantt. One sticky column listing every row
 * (collapsible project/group headers, task names with a status dot, milestone
 * dots for due-only tasks, and a trailing "+ Add Task" row per group). The
 * timeline pane owns the canonical vertical scroll; this pane is a pure
 * follower — its inner content div is translated up via a shared ref written
 * directly by the timeline's scroll handler, so the two stay row-aligned
 * without a per-frame re-render.
 */

import { forwardRef, useState } from 'react';
import { Chevron } from '../list-view-icons';
import { StatusCircle } from '../listview/RowLeadRail';
import { useWorkspaceStore } from '@/store/workspace';
import { useUiStore } from '@/store/ui-store';
import type { Task } from '@/lib/view-data';
import { GANTT } from './tokens';
import type { GanttRow } from './rows';

type TaskContextMenuHandler = (e: React.MouseEvent, task: Task) => void;

const NAME_PAD_LEFT = 16;

function ListGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Collapsible project/group header: chevron + list icon + name + count. */
function GroupHeader({
  row,
  collapsed,
  onToggle,
}: {
  row: Extract<GanttRow, { kind: 'group' }>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid="gantt-group-header"
      data-group-key={row.key}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: GANTT.rowHeight,
        paddingLeft: NAME_PAD_LEFT,
        paddingRight: 12,
        borderBottom: `1px solid ${GANTT.gridBorder}`,
        background: hover ? GANTT.hover : GANTT.bg,
        cursor: 'pointer',
      }}
    >
      <button
        data-testid="gantt-group-collapse"
        aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        aria-expanded={!collapsed}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: GANTT.textSecondary,
          padding: 0,
        }}
      >
        <Chevron open={!collapsed} />
      </button>
      <span style={{ display: 'inline-flex', color: row.color, flexShrink: 0 }}>
        <ListGlyph />
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: GANTT.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.label}
      </span>
      <span style={{ fontSize: 12, color: GANTT.textMuted }}>{row.count}</span>
    </div>
  );
}

function TaskNameRow({
  row,
  onContextMenu,
}: {
  row: Extract<GanttRow, { kind: 'task' }>;
  onContextMenu: TaskContextMenuHandler;
}) {
  const toggleComplete = useWorkspaceStore((s) => s.toggleTaskComplete);
  const openTask = useUiStore((s) => s.openTask);
  const [hover, setHover] = useState(false);
  const { task } = row;
  return (
    <div
      data-testid="gantt-table-row"
      data-task-id={task.id}
      onClick={() => openTask(task.id)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: GANTT.rowHeight,
        paddingLeft: NAME_PAD_LEFT + 16,
        paddingRight: 12,
        borderBottom: `1px solid ${GANTT.gridBorder}`,
        cursor: 'pointer',
        background: hover ? GANTT.hover : GANTT.bg,
      }}
    >
      {row.milestone ? (
        <span
          data-testid="gantt-table-milestone"
          aria-hidden
          style={{
            width: 10,
            height: 10,
            flexShrink: 0,
            background: GANTT.milestone,
            transform: 'rotate(45deg)',
            borderRadius: 2,
          }}
        />
      ) : (
        <StatusCircle task={task} onToggle={() => toggleComplete(task.id)} />
      )}
      <span
        style={{
          fontSize: 13,
          color: GANTT.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {task.name}
      </span>
    </div>
  );
}

function AddTaskRow({ groupKey, onAdd }: { groupKey: string; onAdd: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid="gantt-add-task-row"
      data-group-key={groupKey}
      onClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: GANTT.rowHeight,
        paddingLeft: NAME_PAD_LEFT + 16,
        paddingRight: 12,
        borderBottom: `1px solid ${GANTT.gridBorder}`,
        cursor: 'pointer',
        background: hover ? GANTT.hover : GANTT.bg,
        color: GANTT.textMuted,
        fontSize: 13,
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, width: 16, textAlign: 'center' }}>+</span>
      Add Task
    </div>
  );
}

export const GanttTaskTable = forwardRef<
  HTMLDivElement,
  {
    rows: GanttRow[];
    width: number;
    collapsed: Set<string>;
    onToggleGroup: (key: string) => void;
    onAddTask: (groupKey: string) => void;
    onTaskContextMenu: TaskContextMenuHandler;
  }
>(function GanttTaskTable(
  { rows, width, collapsed, onToggleGroup, onAddTask, onTaskContextMenu },
  innerRef,
) {
  return (
    <div
      data-testid="gantt-task-table"
      style={{
        width,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${GANTT.gridBorderStrong}`,
        background: GANTT.bg,
        zIndex: 2,
      }}
    >
      {/* header spacer aligning with the timeline's two-row date header */}
      <div
        style={{
          height: GANTT.headerHeight,
          flexShrink: 0,
          borderBottom: `1px solid ${GANTT.gridBorderStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: NAME_PAD_LEFT,
          paddingRight: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: GANTT.textSecondary }}>Name</span>
        <button
          data-testid="gantt-name-add"
          aria-label="Add task"
          onClick={() => onAddTask(rows.find((r) => r.kind === 'group')?.key ?? '')}
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: GANTT.textSecondary,
            fontSize: 16,
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = GANTT.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          +
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div ref={innerRef} style={{ transform: 'translateY(0px)', willChange: 'transform' }}>
          {rows.map((row) => {
            if (row.kind === 'group') {
              return (
                <GroupHeader
                  key={row.key}
                  row={row}
                  collapsed={collapsed.has(row.key)}
                  onToggle={() => onToggleGroup(row.key)}
                />
              );
            }
            if (row.kind === 'add') {
              return (
                <AddTaskRow
                  key={row.key}
                  groupKey={row.groupKey}
                  onAdd={() => onAddTask(row.groupKey)}
                />
              );
            }
            return <TaskNameRow key={row.key} row={row} onContextMenu={onTaskContextMenu} />;
          })}
        </div>
      </div>
    </div>
  );
});
