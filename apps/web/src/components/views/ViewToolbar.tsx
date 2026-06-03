'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useViewConfig, useTasksByList } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import type { ViewConfig } from '@/store/workspace/view-config.types';
import {
  CaretDown,
  ClosedIcon,
  ColumnsIcon,
  FilterIcon,
  GearIcon,
  GroupIcon,
  PersonAddIcon,
  SearchIcon,
  SubtaskIcon,
} from '@/components/pages/list-view-icons';
import { GroupByMenu } from '@/components/pages/listview/GroupByMenu';
import { SubtasksMenu } from '@/components/pages/listview/SubtasksMenu';
import { ColumnsMenu } from '@/components/pages/listview/ColumnsMenu';
import { FilterMenu } from '@/components/pages/listview/FilterMenu';
import { CustomizeMenu } from '@/components/pages/listview/CustomizeMenu';
import { AddTaskMenu } from '@/components/pages/listview/AddTaskMenu';
import { SortMenu } from '@/components/pages/listview/SortMenu';
import { ClosedMenu } from '@/components/pages/listview/ClosedMenu';
import { SortFieldLabel } from '@/components/pages/listview/sort-labels';

// ── Dark-theme tokens (mirrors ListView.tsx) ──────────────────────────────────
const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const BORDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';

const INDIGO_BG = 'var(--cu-indigo, rgb(50,36,129))';
const INDIGO_TEXT = 'var(--cu-indigo-text, rgb(167,160,249))';
const ADD_TASK_BG = 'rgb(34, 34, 34)';

const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;

const GROUP_LABEL: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  none: 'None',
};

export type ViewToolbarControl =
  | 'group'
  | 'subtasks'
  | 'columns'
  | 'sort'
  | 'filter'
  | 'closed'
  | 'assignee'
  | 'search'
  | 'customize'
  | 'addTask';

const ALL_CONTROLS: ViewToolbarControl[] = [
  'group',
  'subtasks',
  'columns',
  'sort',
  'filter',
  'closed',
  'assignee',
  'search',
  'customize',
  'addTask',
];

/** Left cluster sits before the flex spacer; everything else is right-aligned. */
const LEFT_CONTROLS: ViewToolbarControl[] = ['group', 'subtasks', 'columns', 'sort'];

// ── shared toolbar-button style (verbatim from ListView.tsx) ──────────────────
function toolbarBtnStyle(hover: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    padding: '0 8px',
    background: hover ? HOVER_BG : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    transition: 'background 120ms',
  };
}

/** Toolbar button that opens a menu (render-prop trigger). Verbatim from ListView.tsx. */
function MenuToolbarButton({
  icon,
  label,
  testid,
  refProp,
  onClick,
  open,
}: {
  icon: React.ReactNode;
  label: string;
  testid: string;
  refProp: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  open: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={refProp}
      data-testid={testid}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...toolbarBtnStyle(hover || open), color: open ? TEXT_PRIMARY : TEXT_SECONDARY }}
    >
      {icon}
      {label}
      <CaretDown />
    </button>
  );
}

// ── Group pill (indigo) ───────────────────────────────────────────────────────
function GroupControl({ listId, config }: { listId: string; config: ViewConfig }) {
  const groupLabel = GROUP_LABEL[config.groupBy];
  return (
    <GroupByMenu
      listId={listId}
      groupBy={config.groupBy}
      sortDir={config.sortDir}
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          data-testid="view-toolbar-groupby"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            background: INDIGO_BG,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: INDIGO_TEXT,
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}
        >
          <GroupIcon />
          <span style={{ opacity: 0.85 }}>Group:</span> {groupLabel}
          <CaretDown />
        </button>
      )}
    />
  );
}

// ── Sort: opens the Sort By popover (field list + direction) ──────────────────
function SortControl({ listId, config }: { listId: string; config: ViewConfig }) {
  return (
    <SortMenu
      listId={listId}
      sortField={config.sortField}
      sortDir={config.sortDir}
      trigger={({ ref, onClick, open }) => (
        <SortTriggerButton
          refProp={ref}
          onClick={onClick}
          open={open}
          dir={config.sortDir}
          label={SortFieldLabel(config.sortField)}
        />
      )}
    />
  );
}

function SortTriggerButton({
  refProp,
  onClick,
  open,
  dir,
  label,
}: {
  refProp: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  open: boolean;
  dir: 'asc' | 'desc';
  label: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={refProp}
      data-testid="view-toolbar-sort"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...toolbarBtnStyle(hover || open), color: open ? TEXT_PRIMARY : TEXT_SECONDARY }}
    >
      <SortArrows dir={dir} />
      {label}
      <CaretDown />
    </button>
  );
}

function SortArrows({ dir }: { dir: 'asc' | 'desc' }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4v16M7 4l-3 3M7 4l3 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={dir === 'asc' ? 1 : 0.5}
        transform={dir === 'desc' ? 'rotate(180 7 12)' : undefined}
      />
      <path
        d="M14 8h6M14 12h4M14 16h2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Closed: opens the Tasks / Subtasks closed-visibility menu ─────────────────
function ClosedControl({ listId, active }: { listId: string; active: boolean }) {
  return (
    <ClosedMenu
      listId={listId}
      showClosed={active}
      trigger={({ ref, onClick, open }) => (
        <ClosedTriggerButton refProp={ref} onClick={onClick} open={open} active={active} />
      )}
    />
  );
}

function ClosedTriggerButton({
  refProp,
  onClick,
  open,
  active,
}: {
  refProp: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  open: boolean;
  active: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={refProp}
      data-testid="view-toolbar-closed"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...toolbarBtnStyle(hover || open), color: active || open ? TEXT_PRIMARY : TEXT_SECONDARY }}
    >
      <ClosedIcon />
      Closed
      <CaretDown />
    </button>
  );
}

// ── Assignee: filter menu (assignee) + member avatar chip ─────────────────────
function AssigneeControl({ listId, listTasks, config }: { listId: string; listTasks: Task[]; config: ViewConfig }) {
  // Show the *current user's* avatar (selected by id), not the first member.
  const member = useWorkspaceStore((s) =>
    s.members.find((m) => m.id === s.currentMemberId) ?? s.members[0],
  );
  return (
    <>
      <FilterMenu
        listId={listId}
        listTasks={listTasks}
        config={config}
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-testid="view-toolbar-assignee"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={onClick}
            style={toolbarBtnStyle(open)}
          >
            <PersonAddIcon size={14} color="currentColor" />
            Assignee
          </button>
        )}
      />

      <span
        title={member?.name}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: member?.color || '#595d66',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 4px',
        }}
      >
        {member?.initials || 'C'}
      </span>
    </>
  );
}

// ── Search: expanding input that filters via onSearchChange ───────────────────
function SearchControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(value.length > 0);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (open) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 8px',
          background: HOVER_BG,
          borderRadius: 6,
          width: 200,
          transition: 'width 120ms',
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          data-testid="view-toolbar-search-input"
          value={value}
          placeholder="Search tasks"
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (value.length === 0) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange('');
              setOpen(false);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: TEXT_PRIMARY,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>
    );
  }

  return (
    <button
      aria-label="Search tasks"
      data-testid="view-toolbar-search"
      onClick={() => setOpen(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        transition: 'background 120ms',
      }}
    >
      <SearchIcon />
    </button>
  );
}

// ── Add Task split CTA ────────────────────────────────────────────────────────
function AddTaskControl({ onAddTask }: { onAddTask: () => void }) {
  return (
    <div style={{ display: 'flex', marginLeft: 6 }}>
      <button
        onClick={onAddTask}
        data-testid="view-toolbar-add-task"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          paddingLeft: 12,
          paddingRight: 10,
          background: ADD_TASK_BG,
          border: `1px solid ${BORDER}`,
          borderRight: 'none',
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
          cursor: 'pointer',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
        }}
      >
        Add Task
      </button>
      <AddTaskMenu
        onCreateTask={onAddTask}
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-testid="view-toolbar-add-task-caret"
            aria-label="Add item"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={onClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 8px',
              background: ADD_TASK_BG,
              border: `1px solid ${BORDER}`,
              borderTopRightRadius: 6,
              borderBottomRightRadius: 6,
              borderLeft: '1px solid rgba(255,255,255,0.14)',
              cursor: 'pointer',
              color: TEXT_PRIMARY,
            }}
          >
            <CaretDown size={12} />
          </button>
        )}
      />
    </div>
  );
}

export interface ViewToolbarProps {
  /** List this view belongs to. Drives every store action + menu. */
  listId: string;
  /** Current view-route segment id (kept for parity with view shells; not required for store wiring). */
  viewId?: string;
  /** Which controls to show, in render order. Defaults to all. */
  controls?: ViewToolbarControl[];
  /** Controlled search query. Required only when `'search'` is in `controls`. */
  searchValue?: string;
  /** Search change handler. Required only when `'search'` is in `controls`. */
  onSearchChange?: (next: string) => void;
}

/**
 * Shared view toolbar reused by every ClickUp-clone view (List/Board/Calendar/Gantt/…).
 * Every control opens the SAME working menu the List view uses or performs a real store action.
 * Views pick their controls via `controls`; unsupported controls are simply omitted.
 */
export function ViewToolbar({
  listId,
  controls = ALL_CONTROLS,
  searchValue = '',
  onSearchChange,
}: ViewToolbarProps) {
  const config = useViewConfig(listId);
  const listTasks = useTasksByList(listId);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const onAddTask = () => {
    if (!listId) return;
    const first = listTasks[0];
    createTask({
      name: 'New Task',
      listId,
      ...(first && config.groupBy === 'status'
        ? { status: first.status, statusColor: first.statusColor, statusType: first.statusType }
        : {}),
    });
  };

  const show = (c: ViewToolbarControl) => controls.includes(c);
  // Spacer pushes the right cluster over, but only when a right-cluster control exists.
  const hasRightControls = controls.some((c) => !LEFT_CONTROLS.includes(c));

  return (
    <div
      data-testid="view-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 40,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      {show('group') && <GroupControl listId={listId} config={config} />}

      {show('subtasks') && (
        <SubtasksMenu
          listId={listId}
          mode={config.subtasks}
          trigger={({ ref, onClick, open }) => (
            <MenuToolbarButton icon={<SubtaskIcon />} label="Subtasks" testid="view-toolbar-subtasks" refProp={ref} onClick={onClick} open={open} />
          )}
        />
      )}

      {show('columns') && (
        <ColumnsMenu
          listId={listId}
          config={config}
          trigger={({ ref, onClick, open }) => (
            <MenuToolbarButton icon={<ColumnsIcon />} label="Columns" testid="view-toolbar-columns" refProp={ref} onClick={onClick} open={open} />
          )}
        />
      )}

      {show('sort') && <SortControl listId={listId} config={config} />}

      {hasRightControls && <span style={{ flex: 1 }} />}

      {show('filter') && (
        <FilterMenu
          listId={listId}
          listTasks={listTasks}
          config={config}
          trigger={({ ref, onClick, open }) => (
            <MenuToolbarButton icon={<FilterIcon />} label="Filter" testid="view-toolbar-filter" refProp={ref} onClick={onClick} open={open} />
          )}
        />
      )}

      {show('closed') && <ClosedControl listId={listId} active={config.showClosed} />}

      {show('assignee') && <AssigneeControl listId={listId} listTasks={listTasks} config={config} />}

      {show('search') && <SearchControl value={searchValue} onChange={onSearchChange ?? (() => undefined)} />}

      {show('customize') && (
        <CustomizeMenu
          listId={listId}
          config={config}
          trigger={({ ref, onClick, open }) => (
            <button
              ref={ref}
              aria-label="Customize"
              data-testid="view-toolbar-customize"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={onClick}
              style={{ ...toolbarBtnStyle(open), padding: '0 10px' }}
            >
              <GearIcon />
              Customize
            </button>
          )}
        />
      )}

      {show('addTask') && <AddTaskControl onAddTask={onAddTask} />}
    </div>
  );
}
