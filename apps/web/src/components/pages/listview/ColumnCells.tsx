'use client';

import type { Task } from '@/store/workspace/types';
import type { ColumnId } from '@/store/workspace/view-config.types';
import {
  CalendarAddIcon,
  CommentIcon,
  FlagIcon,
  FlagOutline,
  PersonAddIcon,
} from '../list-view-icons';
import { AssigneeCellEditor } from './AssigneeCellEditor';
import { DueDateCellEditor } from './DueDateCellEditor';
import { PriorityCellEditor } from './PriorityCellEditor';
import { StatusCellEditor } from './StatusCellEditor';
import { priorityLabel } from './statuses';
import { fmtEstimate } from '@/store/workspace/time';
import { statusOrder } from '@/data/status-order';

const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const HOVER_BG = 'var(--cu-bg-hover)';
const OVERDUE = 'rgb(226, 67, 41)';
const STATUS_PILL_BG = 'rgb(42, 42, 42)';

function dueLabel(due: number | null): string {
  if (!due) return '';
  const d = new Date(due);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function isOverdue(due: number | null, done: boolean): boolean {
  if (!due || done) return false;
  return due < Date.now();
}

function makeTriggerButton(testid: string, content: React.ReactNode) {
  return ({ ref, onClick, open }: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => (
    <button
      ref={ref}
      data-testid={testid}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 24,
        padding: '2px 4px',
        margin: '-2px -4px',
        background: open ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
        maxWidth: '100%',
      }}
    >
      {content}
    </button>
  );
}

function AssigneeCell({ task }: { task: Task }) {
  const assignees = task.assignees;
  const content =
    assignees.length === 0 ? (
      <PersonAddIcon />
    ) : (
      <span style={{ display: 'inline-flex' }}>
        {assignees.map((a, i) => (
          <span
            key={a.id}
            title={a.name}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: a.color || '#7b68ee',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: i === 0 ? 0 : -6,
              border: '2px solid var(--cu-bg-app)',
            }}
          >
            {a.initials}
          </span>
        ))}
      </span>
    );
  return <AssigneeCellEditor task={task} trigger={makeTriggerButton('cell-assignee', content)} />;
}

function DueDateCell({ task, done }: { task: Task; done: boolean }) {
  const overdue = isOverdue(task.dueDate, done);
  const content = !task.dueDate ? (
    <CalendarAddIcon />
  ) : (
    <span style={{ fontSize: 13, color: overdue ? OVERDUE : TEXT_SECONDARY }}>{dueLabel(task.dueDate)}</span>
  );
  return <DueDateCellEditor task={task} trigger={makeTriggerButton('cell-duedate', content)} />;
}

function PriorityCell({ task }: { task: Task }) {
  const content = !task.priority ? (
    <FlagOutline />
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <FlagIcon color={task.priorityColor || '#d8d8d8'} />
      <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{priorityLabel(task.priority)}</span>
    </span>
  );
  return <PriorityCellEditor task={task} trigger={makeTriggerButton('cell-priority', content)} />;
}

/**
 * Pill status glyph — mirrors the row lead-rail StatusCircle: a filled disc for
 * closed/done, a dashed ring for not-started ("to do"), and a solid ring for
 * active statuses. ClickUp shows the same glyph inside the status pill.
 */
function StatusGlyph({ task }: { task: Task }) {
  const color = task.statusColor || '#87909e';
  const done = task.statusType === 'closed' || task.statusType === 'done';
  const notStarted = !done && statusOrder(task.status) === 0;
  const SIZE = 11;
  const ringStyle = done
    ? { background: color, border: 'none' as const }
    : notStarted
      ? { background: 'transparent', border: `1.5px dashed ${color}` }
      : { background: 'transparent', border: `1.5px solid ${color}` };
  return (
    <span
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...ringStyle,
      }}
    />
  );
}

function StatusPillCell({ task, listTasks }: { task: Task; listTasks: Task[] }) {
  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingLeft: 8,
        paddingRight: 10,
        background: STATUS_PILL_BG,
        borderRadius: 4,
        maxWidth: '100%',
      }}
    >
      <StatusGlyph task={task} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: TEXT_SECONDARY,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.status}
      </span>
    </span>
  );
  return <StatusCellEditor task={task} listTasks={listTasks} trigger={makeTriggerButton('cell-status', content)} />;
}

function CommentsCell({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const count = task.comments?.length ?? 0;
  return (
    <button
      data-testid="cell-comments"
      aria-label={count > 0 ? `${count} comments` : 'Add comment'}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 22,
        padding: '0 4px',
        margin: '0 -4px',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: TEXT_MUTED,
        fontFamily: 'inherit',
      }}
    >
      <CommentIcon />
      {count > 0 && <span style={{ fontSize: 11, fontWeight: 500, color: TEXT_SECONDARY }}>{count}</span>}
    </button>
  );
}

function PlaceholderCell() {
  return <span style={{ fontSize: 13, color: TEXT_MUTED }}>—</span>;
}

/** Render a single column cell by id. */
export function ColumnCell({
  col,
  task,
  listTasks,
  done,
  onOpen,
}: {
  col: ColumnId;
  task: Task;
  listTasks: Task[];
  done: boolean;
  onOpen: () => void;
}) {
  switch (col) {
    case 'assignee':
      return <AssigneeCell task={task} />;
    case 'dueDate':
      return <DueDateCell task={task} done={done} />;
    case 'priority':
      return <PriorityCell task={task} />;
    case 'status':
      return <StatusPillCell task={task} listTasks={listTasks} />;
    case 'comments':
      return <CommentsCell task={task} onOpen={onOpen} />;
    case 'startDate':
      return task.startDate ? (
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{dueLabel(task.startDate)}</span>
      ) : (
        <CalendarAddIcon />
      );
    case 'timeEstimate':
      return task.timeEstimate ? (
        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{fmtEstimate(task.timeEstimate)}</span>
      ) : (
        <PlaceholderCell />
      );
    case 'taskId':
      return <span style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: 'monospace' }}>{task.id}</span>;
    case 'dateCreated':
      return <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{dueLabel(task.dateCreated)}</span>;
    default:
      return <PlaceholderCell />;
  }
}
