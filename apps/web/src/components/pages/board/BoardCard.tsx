'use client';

/**
 * A single Kanban card. Mirrors ClickUp's `board-task` anatomy: a name row, then
 * a persistent `field-layout` meta row of assignee / due-date / priority fields
 * (always visible — empty fields show their add-icon, exactly like ClickUp).
 * Every meta affordance is a live inline editor reused from List view. Tags and
 * subtask / comment counts render between the title and the field row.
 *
 * On hover the card elevates and reveals two extra affordances: a leading
 * complete-circle (toggleTaskComplete) and a trailing "..." kebab (the shared
 * task context menu). Clicking the card body opens the task modal; the card is
 * the HTML5 drag source. Double-clicking the title renames it inline.
 */

import { useState } from 'react';
import { ANCHOR_NOW } from '@/lib/view-data';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { useSubtasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import {
  CalendarAddIcon,
  CheckboxIcon,
  CommentIcon,
  FlagIcon,
  FlagOutline,
  PersonAddIcon,
  SubtaskIcon,
} from '../list-view-icons';
import { AssigneeCellEditor } from '../listview/AssigneeCellEditor';
import { DueDateCellEditor } from '../listview/DueDateCellEditor';
import { PriorityCellEditor } from '../listview/PriorityCellEditor';
import { TagChips } from '../listview/TagChips';
import { priorityLabel } from '../listview/statuses';
import {
  AssigneeStack,
  CardKebab,
  CompleteCircle,
  MetaTrigger,
  NameField,
} from './BoardCardParts';
import { BOARD, CARD_SIZE, type CardSize } from './tokens';

function isDone(task: Task): boolean {
  return task.statusType === 'closed' || task.statusType === 'done';
}

function dueLabel(due: number | null): string {
  if (!due) return '';
  const d = new Date(due);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function isOverdue(due: number | null, done: boolean): boolean {
  if (!due || done) return false;
  return due < ANCHOR_NOW;
}

export function BoardCard({
  task,
  cardSize,
  dragging,
  onDragStart,
  onDragEnd,
  onContextMenu,
}: {
  task: Task;
  cardSize: CardSize;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}) {
  const openTask = useUiStore((s) => s.openTask);
  const selected = useUiStore((s) => s.selectedTaskIds.includes(task.id));
  const toggleSelected = useUiStore((s) => s.toggleTaskSelected);
  const toggleTaskComplete = useWorkspaceStore((s) => s.toggleTaskComplete);
  const subtasks = useSubtasks(task.id);
  const [hover, setHover] = useState(false);
  const size = CARD_SIZE[cardSize];
  const done = isDone(task);
  const overdue = isOverdue(task.dueDate, done);
  const tags = task.tags ?? [];
  const commentCount = task.comments?.length ?? 0;

  return (
    <div
      data-testid="board-card"
      data-test={`board-task__card__${task.name}`}
      data-task-id={task.id}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => onContextMenu(e, task)}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: size.gap,
        padding: `${size.padY}px ${size.padX}px`,
        background: BOARD.cardBg,
        border: `1px solid ${selected ? BOARD.accent : hover ? BOARD.borderStrong : BOARD.border}`,
        borderRadius: BOARD.cardRadius,
        cursor: 'pointer',
        boxShadow: selected
          ? `0 0 0 1px ${BOARD.accent}, ${BOARD.shadowCard}`
          : hover
            ? BOARD.shadowCardHover
            : BOARD.shadowCard,
        opacity: dragging ? 0.4 : 1,
        transform: hover && !dragging ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 120ms, border-color 120ms, transform 120ms, opacity 120ms',
        userSelect: 'none',
      }}
    >
      {/* Title row: a select checkbox (hover or selected), the name, and on hover
          a leading complete-circle + trailing kebab. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div
          style={{
            width: hover || selected ? 18 : 0,
            opacity: hover || selected ? 1 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            marginTop: 1,
            transition: 'width 120ms, opacity 120ms',
          }}
        >
          <button
            type="button"
            data-testid="board-card-select"
            aria-label={selected ? 'Deselect task' : 'Select task'}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelected(task.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: selected ? BOARD.accent : BOARD.textMuted,
            }}
          >
            <CheckboxIcon size={16} checked={selected} />
          </button>
        </div>

        <div
          style={{
            width: hover ? 18 : 0,
            opacity: hover ? 1 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            marginTop: 1,
            transition: 'width 120ms, opacity 120ms',
          }}
        >
          <CompleteCircle done={done} onToggle={() => toggleTaskComplete(task.id)} />
        </div>

        <NameField task={task} cardSize={cardSize} done={done} onOpen={() => openTask(task.id)} />

        <div
          style={{
            width: hover ? 22 : 0,
            opacity: hover ? 1 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'width 120ms, opacity 120ms',
          }}
        >
          <CardKebab onOpenMenu={(e) => onContextMenu(e, task)} />
        </div>
      </div>

      {tags.length > 0 && <TagChips tags={tags} />}

      {(subtasks.length > 0 || commentCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {subtasks.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: BOARD.textMuted }}>
              <SubtaskIcon size={13} />
              {subtasks.length}
            </span>
          )}
          {commentCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: BOARD.textMuted }}>
              <CommentIcon size={13} color="rgb(120,120,120)" />
              {commentCount}
            </span>
          )}
        </div>
      )}

      {/* Persistent field-layout row — assignee / due date / priority, always shown. */}
      <div
        data-testid="board-card-fields"
        data-test="board-task__field-layout"
        style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 22 }}
      >
        {/* Assignee — avatars when set, person+ otherwise (always visible). */}
        <AssigneeCellEditor
          task={task}
          trigger={({ ref, onClick }) => (
            <MetaTrigger ref={ref} onClick={onClick} testid="board-card-assignee" label="Assignee">
              {task.assignees.length > 0 ? <AssigneeStack task={task} /> : <PersonAddIcon size={16} />}
            </MetaTrigger>
          )}
        />

        {/* Due date — pill when set, calendar+ otherwise (always visible). */}
        <DueDateCellEditor
          task={task}
          trigger={({ ref, onClick }) =>
            task.dueDate ? (
              <MetaTrigger
                ref={ref}
                onClick={onClick}
                color={overdue ? BOARD.overdue : BOARD.textMuted}
                testid="board-card-due"
                label="Set due date"
              >
                <CalendarAddIcon size={13} color={overdue ? BOARD.overdue : 'rgb(120,120,120)'} />
                {dueLabel(task.dueDate)}
              </MetaTrigger>
            ) : (
              <MetaTrigger ref={ref} onClick={onClick} testid="board-card-due" label="Set due date">
                <CalendarAddIcon size={13} />
              </MetaTrigger>
            )
          }
        />

        {/* Priority — flag when set, flag-outline otherwise (always visible). */}
        <PriorityCellEditor
          task={task}
          trigger={({ ref, onClick }) =>
            task.priority ? (
              <MetaTrigger
                ref={ref}
                onClick={onClick}
                color={task.priorityColor || '#d8d8d8'}
                testid="board-card-priority"
                label="Priority"
              >
                <FlagIcon size={13} color={task.priorityColor || '#d8d8d8'} />
                {priorityLabel(task.priority)}
              </MetaTrigger>
            ) : (
              <MetaTrigger ref={ref} onClick={onClick} testid="board-card-priority" label="Priority">
                <FlagOutline size={13} />
              </MetaTrigger>
            )
          }
        />
      </div>
    </div>
  );
}
