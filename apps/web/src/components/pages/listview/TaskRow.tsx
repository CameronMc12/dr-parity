'use client';

import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useSubtasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import { customFieldIdFromColumn } from '@/store/workspace/view-config.types';
import { CustomFieldCell } from '@/components/fields';
import { EllipsisIcon } from '../list-view-icons';
import { ColumnCell } from './ColumnCells';
import { isBuiltinColumn } from './columns';
import { DragHandle, SelectCheckbox, StatusCircle, SubtaskToggle } from './RowLeadRail';
import { RowKebabMenu } from './RowKebabMenu';
import { RowQuickActions } from './RowQuickActions';
import { TagChips } from './TagChips';
import type { ListDnd } from './useListDnd';
import type { ListGroup } from './grouping';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const BORDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';
const ACCENT = 'var(--cu-accent)';

const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;
const SUBTASK_INDENT = 26;

function isDone(task: Task): boolean {
  return task.statusType === 'closed' || task.statusType === 'done';
}

function TaskNameRename({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const v = ref.current?.value.trim();
    if (v) onCommit(v);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      data-testid="list-task-rename"
      defaultValue={initial}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={commit}
      style={{
        width: '100%',
        height: 24,
        padding: '0 6px',
        fontSize: 13,
        color: TEXT_PRIMARY,
        border: '1px solid var(--cu-border-strong)',
        borderRadius: 4,
        outline: 'none',
        background: 'var(--cu-bg-input)',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  );
}

export interface TaskRowProps {
  task: Task;
  group: ListGroup;
  listTasks: Task[];
  visibleColumns: TableColumnId[];
  /** Custom-field defs for this list, keyed by id — resolves `cf:*` columns. */
  customFields: Map<string, CustomFieldDef>;
  gridTemplate: string;
  wrapText: boolean;
  depth: number;
  dnd: ListDnd;
  /** Spread onto the row to open the shared right-click task menu. */
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  /** Task id the context menu asked to inline-rename (null = none pending). */
  renameRequestId: string | null;
  /** Clears the pending rename request after this row consumes it. */
  onRenameConsumed: () => void;
  /**
   * List name shown as a location chip next to the task name. Set only for
   * space/folder scope (top-level rows); undefined for single-list scope so the
   * row renders identically to before.
   */
  locationName?: string;
}

export function TaskRow({
  task,
  group,
  listTasks,
  visibleColumns,
  customFields,
  gridTemplate,
  wrapText,
  depth,
  dnd,
  onContextMenu,
  renameRequestId,
  onRenameConsumed,
  locationName,
}: TaskRowProps) {
  const openTaskModal = useUiStore((s) => s.openTask);
  const selected = useUiStore((s) => s.selectedTaskIds.includes(task.id));
  const toggleSelected = useUiStore((s) => s.toggleTaskSelected);

  const toggleTaskComplete = useWorkspaceStore((s) => s.toggleTaskComplete);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const subtasks = useSubtasks(task.id);

  const [hover, setHover] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [autoFocusChildId, setAutoFocusChildId] = useState<string | null>(null);

  // Right-click "Rename" routes here: when this row is the requested target,
  // enter inline-rename mode and clear the pending request.
  useEffect(() => {
    if (renameRequestId !== task.id) return;
    setRenaming(true);
    onRenameConsumed();
  }, [renameRequestId, task.id, onRenameConsumed]);

  const done = isDone(task);
  const openTask = () => openTaskModal(task.id);
  const openTaskInNewTab = () => {
    if (typeof window === 'undefined') return;
    const wsId = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
    window.open(`/${wsId}/t/${task.id}`, '_blank', 'noopener,noreferrer');
  };
  const isDragging = dnd.draggingId === task.id;
  const dropEdge = dnd.dropTarget?.taskId === task.id ? dnd.dropTarget.edge : null;

  const addSubtask = () => {
    const child = createTask({
      name: 'New subtask',
      listId: task.listId,
      parent: task.id,
      status: task.status,
      statusColor: task.statusColor,
      statusType: task.statusType,
    });
    setExpanded(true);
    setAutoFocusChildId(child.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!dnd.isDragging || depth > 0) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const edge = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    dnd.onRowDragOver(task.id, edge);
  };

  return (
    <>
      <div
        data-testid="list-task-row"
        data-task-id={task.id}
        onContextMenu={(e) => onContextMenu(e, task)}
        draggable={depth === 0}
        onDragStart={(e) => {
          if (depth > 0) return;
          e.dataTransfer.effectAllowed = 'move';
          // Firefox requires data to be set for drag to start.
          e.dataTransfer.setData('text/plain', task.id);
          dnd.onDragStart(task.id);
        }}
        onDragEnd={dnd.onDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          if (depth > 0) return;
          e.preventDefault();
          dnd.onDropOnRow(group);
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          alignItems: 'center',
          gap: 10,
          minHeight: 40,
          paddingLeft: ROW_PAD_LEFT + depth * SUBTASK_INDENT,
          paddingRight: ROW_PAD_RIGHT,
          borderBottom: `1px solid ${BORDER}`,
          background: selected
            ? 'color-mix(in srgb, var(--cu-accent) 12%, transparent)'
            : hover
              ? HOVER_BG
              : 'transparent',
          opacity: isDragging ? 0.4 : 1,
          boxShadow:
            dropEdge === 'before'
              ? `inset 0 2px 0 ${ACCENT}`
              : dropEdge === 'after'
                ? `inset 0 -2px 0 ${ACCENT}`
                : 'none',
        }}
      >
        {/* Lead rail: drag handle · checkbox · chevron · status circle */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <DragHandle visible={hover && depth === 0} />
          <SelectCheckbox checked={selected} visible={hover} onToggle={() => toggleSelected(task.id)} />
          <SubtaskToggle
            expanded={expanded}
            hasSubtasks={subtasks.length > 0}
            visible={hover}
            onToggle={() => setExpanded((v) => !v)}
          />
          <StatusCircle task={task} onToggle={() => toggleTaskComplete(task.id)} />
        </span>

        {/* Name + tag chips + quick actions */}
        {renaming ? (
          <TaskNameRename
            initial={task.name}
            onCommit={(name) => {
              updateTask(task.id, { name });
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              data-testid="list-task-name"
              onClick={openTask}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: TEXT_PRIMARY,
                overflow: wrapText ? 'visible' : 'hidden',
                textOverflow: wrapText ? 'clip' : 'ellipsis',
                whiteSpace: wrapText ? 'normal' : 'nowrap',
                textDecoration: done ? 'line-through' : 'none',
                cursor: 'pointer',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {task.name}
            </span>
            <TagChips tags={task.tags ?? []} />
            {locationName && <LocationChip name={locationName} />}
            {hover && <RowQuickActions task={task} onAddSubtask={addSubtask} onRename={() => setRenaming(true)} />}
          </span>
        )}

        {visibleColumns.map((col) => {
          const fieldId = customFieldIdFromColumn(col);
          const field = fieldId ? customFields.get(fieldId) : undefined;
          return (
            <span key={col} style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
              {isBuiltinColumn(col) ? (
                <ColumnCell col={col} task={task} listTasks={listTasks} done={done} onOpen={openTask} />
              ) : field ? (
                <CustomFieldCell task={task} field={field} />
              ) : null}
            </span>
          );
        })}

        <RowKebabMenu
          task={task}
          onRename={() => setRenaming(true)}
          onOpenTask={openTaskInNewTab}
          trigger={({ ref, onClick, open }) => (
            <button
              ref={ref}
              data-testid="list-task-kebab"
              aria-label="Task options"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                onClick(e);
              }}
              style={{
                width: 24,
                height: 24,
                display: hover || open ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                background: open ? 'var(--cu-bg-strong)' : 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: TEXT_MUTED,
                padding: 0,
              }}
            >
              <EllipsisIcon />
            </button>
          )}
        />
      </div>

      {/* Subtask rows (indented) */}
      {expanded &&
        subtasks.map((sub) => (
          <TaskRow
            key={sub.id}
            task={sub}
            group={group}
            listTasks={listTasks}
            visibleColumns={visibleColumns}
            customFields={customFields}
            gridTemplate={gridTemplate}
            wrapText={wrapText}
            depth={depth + 1}
            dnd={dnd}
            onContextMenu={onContextMenu}
            renameRequestId={renameRequestId}
            onRenameConsumed={onRenameConsumed}
          />
        ))}

      {expanded && subtasks.length === 0 && (
        <AddSubtaskRow
          gridTemplate={gridTemplate}
          depth={depth + 1}
          onAdd={addSubtask}
        />
      )}

      {/* When a freshly-created subtask asks for focus, drop an inline editor. */}
      {autoFocusChildId && (
        <FocusFlush taskId={autoFocusChildId} onDone={() => setAutoFocusChildId(null)} />
      )}
    </>
  );
}

/**
 * List-name chip shown next to the task name when the view aggregates more than
 * one list (space/folder scope). Mirrors ClickUp's "Show task locations".
 */
function LocationChip({ name }: { name: string }) {
  return (
    <span
      data-testid="list-task-location"
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        maxWidth: 160,
        padding: '0 7px',
        borderRadius: 4,
        background: 'var(--cu-bg-strong, rgb(42,42,42))',
        border: `1px solid ${BORDER}`,
        color: TEXT_MUTED,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexShrink: 0,
      }}
    >
      {name}
    </span>
  );
}

/** Empty-state "+ Add subtask" row shown when a parent is expanded with no children. */
function AddSubtaskRow({
  gridTemplate,
  depth,
  onAdd,
}: {
  gridTemplate: string;
  depth: number;
  onAdd: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-testid="list-add-subtask-row"
      onClick={onAdd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
        gap: 10,
        height: 34,
        paddingLeft: ROW_PAD_LEFT + depth * SUBTASK_INDENT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
        background: hover ? HOVER_BG : 'transparent',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: TEXT_MUTED, fontSize: 16, textAlign: 'center', lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>Add subtask</span>
    </div>
  );
}

/** No-op placeholder: clearing the auto-focus flag after the child has mounted. */
function FocusFlush({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  useEffect(() => {
    const node = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"] [data-testid="list-task-name"]`);
    node?.scrollIntoView({ block: 'nearest' });
    onDone();
  }, [taskId, onDone]);
  return null;
}
