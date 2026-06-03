'use client';

/**
 * Table-view cell renderers. Each non-name cell reuses the SAME inline editor
 * the List view uses (Status / Priority / Assignee / Due-date pickers) so a
 * click opens the matching dropdown and writes via `updateTask`. The only Table
 * difference is presentation: cells are bordered grid squares, not borderless
 * List cells.
 */

import type { ReactNode } from 'react';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import type { TableColumnId } from '@/store/workspace/view-config.types';
import { isBuiltinColumn } from '@/components/pages/listview/columns';
import { CustomFieldCell } from '@/components/fields';
import { AssigneeCellEditor } from '@/components/pages/listview/AssigneeCellEditor';
import { DueDateCellEditor } from '@/components/pages/listview/DueDateCellEditor';
import { PriorityCellEditor } from '@/components/pages/listview/PriorityCellEditor';
import { StatusCellEditor } from '@/components/pages/listview/StatusCellEditor';
import { TagPicker } from '@/components/pages/listview/TagPicker';
import { TagChips } from '@/components/pages/listview/TagChips';
import { priorityLabel } from '@/components/pages/listview/statuses';
import { statusOrder } from '@/data/status-order';
import { fmtEstimate } from '@/store/workspace/time';
import { useUiStore } from '@/store/ui-store';
import {
  CalendarAddIcon,
  CommentIcon,
  FlagIcon,
  FlagOutline,
  PersonAddIcon,
} from '@/components/pages/list-view-icons';
import { StartDateCellEditor } from './StartDateCellEditor';
import { TBL } from './tokens';

const OVERDUE = 'rgb(226, 67, 41)';

function dateLabel(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

function isOverdue(due: number | null, done: boolean): boolean {
  if (!due || done) return false;
  return due < Date.now();
}

/** Full-cell clickable trigger so the whole spreadsheet square opens the editor. */
function cellTrigger(testid: string, content: ReactNode, align: 'left' | 'center' = 'left') {
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        gap: 6,
        width: '100%',
        height: '100%',
        padding: '0 10px',
        background: open ? TBL.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {content}
    </button>
  );
}

function AssigneeContent({ task, rowHover }: { task: Task; rowHover: boolean }) {
  // ClickUp's Table leaves an unassigned cell blank at rest; the add-person
  // affordance only appears on row hover.
  if (task.assignees.length === 0) return rowHover ? <PersonAddIcon /> : null;
  return (
    <span style={{ display: 'inline-flex' }}>
      {task.assignees.map((a, i) => (
        <span
          key={a.id}
          title={a.name}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: a.color || '#7b68ee',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: i === 0 ? 0 : -6,
            border: `2px solid ${TBL.appBg}`,
          }}
        >
          {a.initials}
        </span>
      ))}
    </span>
  );
}

/**
 * Status glyph inside the pill — mirrors the List view's `StatusGlyph` and the
 * real ClickUp icon set: a filled disc for closed/done, a dashed ring for the
 * not-started "to do" status (`statusIconOpenDashed` in the export), and a solid
 * ring for active in-between statuses.
 */
function StatusGlyph({ task }: { task: Task }) {
  const color = task.statusColor || '#87909e';
  const done = task.statusType === 'closed' || task.statusType === 'done';
  const notStarted = !done && statusOrder(task.status) === 0;
  const ring = done
    ? { background: color, border: 'none' as const }
    : notStarted
      ? { background: 'transparent', border: `1.5px dashed ${color}` }
      : { background: 'transparent', border: `1.5px solid ${color}` };
  return (
    <span
      style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', ...ring }}
    />
  );
}

function StatusPill({ task }: { task: Task }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingLeft: 8,
        paddingRight: 10,
        background: TBL.pillBg,
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
          color: TBL.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.status}
      </span>
    </span>
  );
}

function PriorityContent({ task, rowHover }: { task: Task; rowHover: boolean }) {
  // Empty priority cell stays blank until the row is hovered (1:1 with ClickUp).
  if (!task.priority) return rowHover ? <FlagOutline /> : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <FlagIcon color={task.priorityColor || '#d8d8d8'} />
      <span style={{ fontSize: 13, color: TBL.textSecondary }}>{priorityLabel(task.priority)}</span>
    </span>
  );
}

/**
 * Comments cell. ClickUp opens the task panel on the comments thread when you
 * click the bubble; there is no inline comment composer in the grid. We mirror
 * that: clicking opens the task (the panel surfaces the comment thread).
 */
function CommentsCell({ task }: { task: Task }) {
  const openTask = useUiStore((s) => s.openTask);
  return (
    <button
      data-testid="tbl-cell-comments"
      aria-label="Open comments"
      onClick={(e) => {
        e.stopPropagation();
        openTask(task.id);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TBL.textMuted,
        fontFamily: 'inherit',
      }}
    >
      <CommentIcon />
      {task.comments && task.comments.length > 0 ? (
        <span style={{ fontSize: 12, color: TBL.textSecondary }}>{task.comments.length}</span>
      ) : null}
    </button>
  );
}

/** Tags cell. Click opens the shared TagPicker (add / remove real tags). */
function TagsCell({ task }: { task: Task }) {
  const tags = task.tags ?? [];
  return (
    <TagPicker
      task={task}
      trigger={cellTrigger('tbl-cell-tags', tags.length === 0 ? <span style={{ fontSize: 13, color: TBL.textMuted }}>—</span> : <TagChips tags={tags} />)}
    />
  );
}

/** Render one Table column cell (the spreadsheet square). */
export function TableCell({
  col,
  task,
  listTasks,
  done,
  field,
  rowHover,
}: {
  col: TableColumnId;
  task: Task;
  listTasks: Task[];
  done: boolean;
  /** Resolved custom-field def when `col` is a `cf:*` column, else null. */
  field: CustomFieldDef | null;
  /** True when the parent row is hovered. Empty built-in cells reveal their
   *  add-affordance icon only on hover, matching ClickUp's Table. */
  rowHover: boolean;
}) {
  if (!isBuiltinColumn(col)) {
    if (!field) return <span style={{ ...cellTextStyle, color: TBL.textMuted }}>—</span>;
    return <CustomFieldCell task={task} field={field} />;
  }
  switch (col) {
    case 'assignee':
      return <AssigneeCellEditor task={task} trigger={cellTrigger('tbl-cell-assignee', <AssigneeContent task={task} rowHover={rowHover} />)} />;
    case 'status':
      return <StatusCellEditor task={task} listTasks={listTasks} trigger={cellTrigger('tbl-cell-status', <StatusPill task={task} />)} />;
    case 'priority':
      return <PriorityCellEditor task={task} trigger={cellTrigger('tbl-cell-priority', <PriorityContent task={task} rowHover={rowHover} />)} />;
    case 'dueDate': {
      const overdue = isOverdue(task.dueDate, done);
      const content = !task.dueDate ? (
        rowHover ? <CalendarAddIcon /> : null
      ) : (
        <span style={{ fontSize: 13, color: overdue ? OVERDUE : TBL.textSecondary }}>{dateLabel(task.dueDate)}</span>
      );
      return <DueDateCellEditor task={task} trigger={cellTrigger('tbl-cell-duedate', content)} />;
    }
    case 'startDate': {
      const content = !task.startDate ? (
        rowHover ? <CalendarAddIcon /> : null
      ) : (
        <span style={{ fontSize: 13, color: TBL.textSecondary }}>{dateLabel(task.startDate)}</span>
      );
      // Dedicated start-date editor: the shared DueDateCellEditor always boots
      // on the Due tab, so a start cell must use this start-defaulting editor.
      return <StartDateCellEditor task={task} trigger={cellTrigger('tbl-cell-startdate', content)} />;
    }
    case 'comments':
      return <CommentsCell task={task} />;
    case 'tags':
      return <TagsCell task={task} />;
    case 'createdBy':
      // The seed/crawl corpus carries no per-task creator field (Task has
      // dateCreated but no createdBy/creator). Render an explicit non-editable
      // placeholder rather than implying a missing editor. List view does the
      // same. If a creator field is added to Task, wire a CreatedByCell here.
      return <span style={{ ...cellTextStyle, color: TBL.textMuted }} title="No creator data in this dataset">—</span>;
    case 'timeEstimate':
      return (
        <span style={cellTextStyle}>
          {task.timeEstimate ? fmtEstimate(task.timeEstimate) : '—'}
        </span>
      );
    case 'taskId':
      return <span style={{ ...cellTextStyle, fontFamily: 'monospace', color: TBL.textMuted }}>{task.id}</span>;
    case 'dateCreated':
      return <span style={cellTextStyle}>{task.dateCreated ? dateLabel(task.dateCreated) : '—'}</span>;
    default:
      return <span style={{ ...cellTextStyle, color: TBL.textMuted }}>—</span>;
  }
}

const cellTextStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  padding: '0 10px',
  fontSize: 13,
  color: TBL.textSecondary,
};
