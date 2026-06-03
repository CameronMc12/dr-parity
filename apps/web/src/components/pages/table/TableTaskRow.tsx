'use client';

/**
 * One Table-view row (a spreadsheet line). Renders the lead cell (multi-select
 * checkbox + status dot + subtask expander), an inline-editable Name cell, then
 * one bordered cell per visible column. Hover reveals a kebab; the whole row is
 * right-clickable (task context menu) and click-to-open. Subtask rows render
 * recursively, indented, when the expander is open.
 */

import { useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useSubtasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import { CheckboxIcon, Chevron, EllipsisIcon } from '@/components/pages/list-view-icons';
import { RowKebabMenu } from '@/components/pages/listview/RowKebabMenu';
import { TableCell } from './cells';
import { fieldForColumn } from './table-columns';
import { TBL, ROW_HEIGHT, NUM_WIDTH, ADD_COL_WIDTH, HOVER_TRANSITION } from './tokens';

const TERMINAL = new Set(['done', 'closed']);
const INDENT_STEP = 22;
/** Stable empty ref passed to cells that don't consume the list array. */
const EMPTY_TASKS: Task[] = [];

function NameCell({
  task,
  depth,
  expandable,
  expanded,
  onToggleExpand,
}: {
  task: Task;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const toggleTaskComplete = useWorkspaceStore((s) => s.toggleTaskComplete);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);
  const done = TERMINAL.has(task.statusType);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== task.name) updateTask(task.id, { name });
    else setDraft(task.name);
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        height: '100%',
        paddingLeft: 8 + depth * INDENT_STEP,
        paddingRight: 8,
        minWidth: 0,
      }}
    >
      <button
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        data-testid="tbl-row-complete"
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskComplete(task.id);
        }}
        title={task.status}
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          borderRadius: '50%',
          border: `2px solid ${task.statusColor || '#87909e'}`,
          background: done ? task.statusColor || '#6bc950' : 'transparent',
          cursor: 'pointer',
          padding: 0,
        }}
      />

      {expandable ? (
        <button
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
          data-testid="tbl-subtask-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: TBL.textMuted,
            padding: 0,
          }}
        >
          <Chevron open={expanded} />
        </button>
      ) : (
        <span style={{ width: 16, flexShrink: 0 }} />
      )}

      {editing ? (
        <input
          autoFocus
          data-testid="tbl-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(task.name);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: 24,
            border: `1px solid ${TBL.indigoText}`,
            outline: 'none',
            borderRadius: 4,
            background: TBL.appBg,
            color: TBL.textPrimary,
            fontSize: 13,
            padding: '0 6px',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(task.name);
            setEditing(true);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: done ? TBL.textMuted : TBL.textPrimary,
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.name}
        </span>
      )}
    </div>
  );
}

export function TableTaskRow({
  task,
  listTasks,
  visibleColumns,
  fields,
  gridTemplate,
  depth,
  rowNumber,
  zebra,
  onContextMenu,
}: {
  task: Task;
  listTasks: Task[];
  visibleColumns: TableColumnId[];
  fields: CustomFieldDef[];
  gridTemplate: string;
  depth: number;
  rowNumber: number;
  zebra: boolean;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const selectedIds = useUiStore((s) => s.selectedTaskIds);
  const toggleTaskSelected = useUiStore((s) => s.toggleTaskSelected);
  const subtasks = useSubtasks(task.id);
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const selected = selectedIds.includes(task.id);
  const done = TERMINAL.has(task.statusType);
  const hasSubtasks = subtasks.length > 0;

  // Only the Status cell editor needs the full list (to derive status options).
  // Hand every other cell an empty array so a large list array is not threaded
  // through cells that ignore it.
  const statusVisible = visibleColumns.includes('status');
  const cellListTasks = statusVisible ? listTasks : EMPTY_TASKS;

  const rowBg = selected ? TBL.indigoBg : hover ? TBL.hover : zebra ? 'rgba(255,255,255,0.018)' : 'transparent';

  const cellBorder = `1px solid ${TBL.gridline}`;
  const cellStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    height: '100%',
    borderRight: cellBorder,
    overflow: 'hidden',
  };

  return (
    <>
      <div
        data-testid="tbl-row"
        data-task-id={task.id}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => openTask(task.id)}
        onContextMenu={(e) => onContextMenu(e, task)}
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          height: ROW_HEIGHT,
          background: rowBg,
          borderBottom: `1px solid ${TBL.gridline}`,
          cursor: 'pointer',
          transition: HOVER_TRANSITION,
        }}
      >
        {/* Lead "#" cell: row number by default, swaps to a select checkbox on
            hover / when selected (ClickUp merges row-number + multi-select into
            one 40px column). Subtask rows show neither index nor number. */}
        <div
          style={{
            width: NUM_WIDTH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: cellBorder,
            fontSize: 12,
            color: TBL.textMuted,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {hover || selected ? (
            <button
              aria-label={selected ? 'Deselect row' : 'Select row'}
              data-testid="tbl-row-select"
              onClick={(e) => {
                e.stopPropagation();
                toggleTaskSelected(task.id);
              }}
              style={{
                width: 18,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: TBL.textMuted,
              }}
            >
              <CheckboxIcon size={16} checked={selected} />
            </button>
          ) : depth === 0 ? (
            rowNumber
          ) : (
            ''
          )}
        </div>

        <div data-tbl-col="name" style={cellStyle}>
          <NameCell
            task={task}
            depth={depth}
            expandable={hasSubtasks}
            expanded={expanded}
            onToggleExpand={() => setExpanded((v) => !v)}
          />
        </div>

        {visibleColumns.map((col) => (
          <div key={col} data-tbl-col={col} style={cellStyle}>
            <TableCell
              col={col}
              task={task}
              listTasks={cellListTasks}
              done={done}
              field={fieldForColumn(col, fields)}
              rowHover={hover}
            />
          </div>
        ))}

        {/* Trailing add-column rail cell: holds the hover kebab */}
        <div style={{ width: ADD_COL_WIDTH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RowKebabMenu
            task={task}
            onRename={() => openTask(task.id)}
            onOpenTask={() => openTask(task.id)}
            trigger={({ ref, onClick, open }) => (
              <button
                ref={ref}
                aria-label="Row actions"
                data-testid="tbl-row-kebab"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(e);
                }}
                style={{
                  width: 22,
                  height: 22,
                  display: hover || open ? 'inline-flex' : 'none',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: open ? TBL.strong : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: TBL.textMuted,
                  padding: 0,
                }}
              >
                <EllipsisIcon />
              </button>
            )}
          />
        </div>
      </div>

      {expanded &&
        subtasks.map((sub, i) => (
          <TableTaskRow
            key={sub.id}
            task={sub}
            listTasks={listTasks}
            visibleColumns={visibleColumns}
            fields={fields}
            gridTemplate={gridTemplate}
            depth={depth + 1}
            rowNumber={i + 1}
            zebra={i % 2 === 1}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}
