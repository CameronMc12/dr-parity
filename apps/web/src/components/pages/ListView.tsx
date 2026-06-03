'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore, workspaceSelectors as sel } from '@/store/workspace';
import { useMyTasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import { columnIdForCustomField } from '@/store/workspace/view-config.types';
import type { ColumnId, TableColumnId, ViewConfig } from '@/store/workspace/view-config.types';
import {
  scopeKey,
  useScopeConfig,
  useScopeCustomFields,
  useScopeDefaultListId,
  useScopeListIds,
  useScopeStatuses,
  useScopeTasks,
  type ViewScope,
} from '@/lib/view-scope';
import { CustomFieldHeader, FieldsPanel } from '@/components/fields';
import {
  CaretDown,
  CheckboxIcon,
  Chevron,
  ClosedIcon,
  ColumnsIcon,
  EllipsisIcon,
  FilterIcon,
  GearIcon,
  GroupIcon,
  PersonAddIcon,
  PlusCircle,
  SearchIcon,
  SubtaskIcon,
} from './list-view-icons';
import { ViewShell } from '@/components/views/ViewShell';
import { buildGroups, type ListGroup } from './listview/grouping';
import { buildGridTemplate, COLUMN_DEFS, isBuiltinColumn } from './listview/columns';
import { type ColumnSort, columnSortFromConfig, nextColumnSort, sortGroups } from './listview/sortGroups';
import { GroupByMenu } from './listview/GroupByMenu';
import { ColumnsMenu } from './listview/ColumnsMenu';
import { FilterMenu } from './listview/FilterMenu';
import { CustomizeMenu } from './listview/CustomizeMenu';
import { SubtasksMenu } from './listview/SubtasksMenu';
import { AddTaskMenu } from './listview/AddTaskMenu';
import { GroupMenu } from './listview/GroupMenu';
import { TaskRow } from './listview/TaskRow';
import { BulkActionBar } from './listview/BulkActionBar';
import { useListDnd } from './listview/useListDnd';
import { PRIORITY_OPTIONS } from './listview/statuses';

// ── Dark-theme tokens ────────────────────────────────────────────────────────
const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const TEXT_MUTED = 'var(--cu-text-muted)';
const BORDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';
const APP_BG = 'var(--cu-bg-app)';

const INDIGO_BG = 'var(--cu-indigo, rgb(50,36,129))';
const INDIGO_TEXT = 'var(--cu-indigo-text, rgb(167,160,249))';
const STATUS_PILL_BG = 'rgb(42, 42, 42)';
const ADD_TASK_BG = 'rgb(34, 34, 34)';

const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;

const GROUP_LABEL: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  none: 'None',
};

// ── toolbar ─────────────────────────────────────────────────────────────────

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
  };
}

/** Toolbar button that opens a menu (render-prop trigger). */
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

/** Expandable search affordance: icon collapses to a live-filter input. */
function ToolbarSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = expanded || value.length > 0;

  const collapse = () => {
    if (value.length === 0) setExpanded(false);
  };

  if (!open) {
    return (
      <button
        aria-label="Search tasks"
        data-testid="list-toolbar-search"
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
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
        color: TEXT_SECONDARY,
      }}
    >
      <SearchIcon />
      <input
        ref={inputRef}
        data-testid="list-toolbar-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={collapse}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onChange('');
            setExpanded(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search tasks"
        style={{
          width: 150,
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      {value.length > 0 && (
        <button
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: TEXT_MUTED,
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function Toolbar({
  configKey,
  listTasks,
  config,
  onAddTask,
  search,
  onSearchChange,
}: {
  /** Config-persistence key (scopeKey): listId for a list, namespaced for space/folder. */
  configKey: string;
  listTasks: Task[];
  config: ViewConfig;
  onAddTask: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const member = useWorkspaceStore((s) => s.members[0]);
  const groupLabel = GROUP_LABEL[config.groupBy];

  return (
    <div
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
      {/* Group: <field> indigo pill */}
      <GroupByMenu
        listId={configKey}
        groupBy={config.groupBy}
        sortDir={config.sortDir}
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-testid="list-toolbar-groupby"
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

      <SubtasksMenu
        listId={configKey}
        mode={config.subtasks}
        trigger={({ ref, onClick, open }) => (
          <MenuToolbarButton icon={<SubtaskIcon />} label="Subtasks" testid="list-toolbar-subtasks" refProp={ref} onClick={onClick} open={open} />
        )}
      />

      <ColumnsMenu
        listId={configKey}
        config={config}
        trigger={({ ref, onClick, open }) => (
          <MenuToolbarButton icon={<ColumnsIcon />} label="Columns" testid="list-toolbar-columns" refProp={ref} onClick={onClick} open={open} />
        )}
      />

      <span style={{ flex: 1 }} />

      <FilterMenu
        listId={configKey}
        listTasks={listTasks}
        config={config}
        trigger={({ ref, onClick, open }) => (
          <MenuToolbarButton icon={<FilterIcon />} label="Filter" testid="list-toolbar-filter" refProp={ref} onClick={onClick} open={open} />
        )}
      />

      <ClosedToggle listId={configKey} active={config.showClosed} />

      <FilterMenu
        listId={configKey}
        listTasks={listTasks}
        config={config}
        initialField="assignee"
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-testid="list-toolbar-assignee"
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

      <ToolbarSearch value={search} onChange={onSearchChange} />

      <CustomizeMenu
        listId={configKey}
        config={config}
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            aria-label="Customize"
            data-testid="list-toolbar-customize"
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

      {/* Split Add Task CTA: main click creates, caret opens menu */}
      <div style={{ display: 'flex', marginLeft: 6 }}>
        <button
          onClick={onAddTask}
          data-testid="list-toolbar-add-task"
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
              data-testid="list-toolbar-add-task-caret"
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
    </div>
  );
}

function ClosedToggle({ listId, active }: { listId: string; active: boolean }) {
  const setViewToggle = useWorkspaceStore((s) => s.setViewToggle);
  const [hover, setHover] = useState(false);
  return (
    <button
      data-testid="list-toolbar-closed"
      onClick={() => setViewToggle(listId, 'showClosed', !active)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...toolbarBtnStyle(hover), color: active ? TEXT_PRIMARY : TEXT_SECONDARY }}
    >
      <ClosedIcon />
      Closed
    </button>
  );
}

// ── group block ─────────────────────────────────────────────────────────────

function GroupBadge({ label, color, dashed }: { label: string; color: string; dashed: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingLeft: 8,
        paddingRight: 11,
        background: STATUS_PILL_BG,
        borderRadius: 4,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: dashed ? 'transparent' : color,
          border: dashed ? `1.5px dashed ${color}` : 'none',
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: TEXT_SECONDARY,
        }}
      >
        {label}
      </span>
    </span>
  );
}

/** A clickable, sortable column-header label with an asc/desc arrow on hover. */
function SortHeaderLabel({
  label,
  col,
  sort,
  onSort,
}: {
  label: string;
  col: ColumnId;
  sort: ColumnSort | null;
  onSort: (col: ColumnId) => void;
}) {
  const [hover, setHover] = useState(false);
  const active = sort?.col === col;
  const dir = active ? sort.dir : null;
  return (
    <button
      data-testid={`list-header-sort-${col}`}
      aria-label={`Sort by ${label}`}
      onClick={() => onSort(col)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 4px',
        margin: '0 -4px',
        background: active ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'inherit',
        color: active ? TEXT_SECONDARY : TEXT_MUTED,
        maxWidth: '100%',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        style={{ opacity: hover || active ? 1 : 0, transition: 'opacity 90ms', flexShrink: 0 }}
      >
        {dir === 'desc' ? (
          <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

function GroupColumnHeader({
  targetListId,
  visibleColumns,
  customFields,
  gridTemplate,
  onOpenColumnsMenu,
  allSelected,
  someSelected,
  onToggleAll,
  sort,
  onSort,
}: {
  /** Concrete list a custom-field header acts on (default list for space/folder). */
  targetListId: string;
  visibleColumns: TableColumnId[];
  customFields: Map<string, CustomFieldDef>;
  gridTemplate: string;
  onOpenColumnsMenu: React.ReactNode;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  sort: ColumnSort | null;
  onSort: (col: ColumnId) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
        gap: 10,
        height: 28,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <button
          aria-label={allSelected ? 'Deselect all in group' : 'Select all in group'}
          data-testid="list-group-select-all"
          onClick={onToggleAll}
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
            color: 'var(--cu-text-muted)',
            opacity: hover || someSelected ? 1 : 0,
            transition: 'opacity 90ms',
          }}
        >
          <CheckboxIcon size={16} checked={allSelected} />
        </button>
      </span>
      <SortHeaderLabel label={COLUMN_DEFS.name.label.replace('Task ', '')} col="name" sort={sort} onSort={onSort} />
      {visibleColumns.map((col) => {
        if (isBuiltinColumn(col)) {
          return <SortHeaderLabel key={col} label={COLUMN_DEFS[col].label} col={col} sort={sort} onSort={onSort} />;
        }
        const field = customFields.get(col.slice(3));
        return field ? (
          <CustomFieldHeader key={col} field={field} listId={targetListId} />
        ) : (
          <span key={col} />
        );
      })}
      {onOpenColumnsMenu}
    </div>
  );
}

function GroupQuickAdd({ onAdd, gridTemplate }: { onAdd: (name: string) => void; gridTemplate: string }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(name);
    setDraft('');
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        alignItems: 'center',
        gap: 10,
        height: 36,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <span style={{ color: TEXT_MUTED, fontSize: 16, textAlign: 'center', lineHeight: 1 }}>+</span>
      <input
        data-testid="list-quick-add"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Add Task"
        style={{
          border: 'none',
          outline: 'none',
          fontSize: 13,
          color: focused ? TEXT_PRIMARY : TEXT_MUTED,
          background: 'transparent',
          fontFamily: 'inherit',
          width: '100%',
        }}
      />
    </div>
  );
}

/**
 * Trailing "+" in the column-header row. Opens the shared FieldsPanel anchored
 * at the button; on create it flips the new `cf:` column visible in this list so
 * the column appears immediately.
 */
function AddColumnButton({ configKey, targetListId }: { configKey: string; targetListId: string }) {
  const toggleColumn = useWorkspaceStore((s) => s.toggleColumn);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState(false);

  const onCreated = useCallback(
    (field: CustomFieldDef) => {
      toggleColumn(configKey, columnIdForCustomField(field.id));
      setAnchor(null);
    },
    [toggleColumn, configKey],
  );

  return (
    <>
      <button
        aria-label="Add column"
        data-testid="list-add-column"
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ x: r.right - 300, y: r.bottom + 4 });
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: anchor || hover ? 'var(--cu-bg-strong)' : 'transparent',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          color: anchor || hover ? TEXT_SECONDARY : TEXT_MUTED,
          padding: 0,
          transition: 'background 120ms',
        }}
      >
        <PlusCircle size={16} />
      </button>
      {anchor && (
        <FieldsPanel
          listId={targetListId}
          anchor={anchor}
          onCreated={onCreated}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

function GroupBlock({
  group,
  configKey,
  targetListId,
  listTasks,
  config,
  visibleColumns,
  customFields,
  gridTemplate,
  collapsed,
  showLocation,
  listNames,
  onQuickAdd,
  onCollapseAll,
  dnd,
  onContextMenu,
  renameRequestId,
  onRenameConsumed,
  sort,
  onSort,
}: {
  group: ListGroup;
  /** Config-persistence key (scopeKey). */
  configKey: string;
  /** Concrete list for custom-field add/delete (default list for space/folder). */
  targetListId: string;
  listTasks: Task[];
  config: ViewConfig;
  visibleColumns: TableColumnId[];
  customFields: Map<string, CustomFieldDef>;
  gridTemplate: string;
  collapsed: boolean;
  /** Show a per-row list-name chip (true for space/folder scope). */
  showLocation: boolean;
  /** listId -> list name, used to render the location chip. */
  listNames: Map<string, string>;
  onQuickAdd: (name: string, group: ListGroup) => void;
  onCollapseAll: () => void;
  dnd: ReturnType<typeof useListDnd>;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  renameRequestId: string | null;
  onRenameConsumed: () => void;
  sort: ColumnSort | null;
  onSort: (col: ColumnId) => void;
}) {
  const setGroupCollapsed = useWorkspaceStore((s) => s.setGroupCollapsed);
  const selectedIds = useUiStore(useShallow((s) => s.selectedTaskIds));
  const setTasksSelected = useUiStore((s) => s.setTasksSelected);
  const [headerHover, setHeaderHover] = useState(false);
  const open = !collapsed;

  const groupTaskIds = group.tasks.map((t) => t.id);
  const selectedInGroup = groupTaskIds.filter((id) => selectedIds.includes(id)).length;
  const allSelected = groupTaskIds.length > 0 && selectedInGroup === groupTaskIds.length;
  const toggleAll = () => setTasksSelected(groupTaskIds, !allSelected);

  const addColumnRail = <AddColumnButton configKey={configKey} targetListId={targetListId} />;

  return (
    <section style={{ marginTop: 6 }} data-testid="list-status-group" data-status={group.label}>
      <div
        data-testid="list-group-header"
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          paddingLeft: ROW_PAD_LEFT - 2,
          paddingRight: ROW_PAD_RIGHT,
        }}
      >
        <button
          aria-label={open ? 'Collapse group' : 'Expand group'}
          data-testid="list-group-collapse"
          onClick={() => setGroupCollapsed(configKey, group.key, open)}
          style={{
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: TEXT_MUTED,
            padding: 0,
            flexShrink: 0,
          }}
        >
          <Chevron open={open} />
        </button>

        <GroupBadge label={group.label} color={group.color} dashed={group.dashed} />
        <span style={{ fontSize: 12, color: TEXT_MUTED }}>{group.tasks.length}</span>

        <GroupMenu
          onCollapseGroup={() => setGroupCollapsed(configKey, group.key, true)}
          onCollapseAll={onCollapseAll}
          trigger={({ ref, onClick, open: menuOpen }) => (
            <button
              ref={ref}
              aria-label="Group options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              data-testid="list-group-menu"
              onClick={onClick}
              style={{
                width: 22,
                height: 22,
                display: headerHover || menuOpen ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                background: menuOpen ? 'var(--cu-bg-strong)' : 'transparent',
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

        <span style={{ flex: 1 }} />

        <button
          aria-label="Add task to group"
          data-testid="list-group-add"
          onClick={() => onQuickAdd('New Task', group)}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: headerHover ? TEXT_PRIMARY : TEXT_SECONDARY,
            padding: 0,
            flexShrink: 0,
            marginRight: 4,
          }}
        >
          <PlusCircle size={18} />
        </button>
      </div>

      {open && (
        <div
          onDragOver={(e) => {
            if (dnd.isDragging) e.preventDefault();
          }}
          onDrop={(e) => {
            // Drop into the group's empty space (below the last row) → append.
            if (!dnd.isDragging) return;
            if (e.target === e.currentTarget) {
              e.preventDefault();
              dnd.onDropOnGroup(group);
            }
          }}
        >
          <GroupColumnHeader
            targetListId={targetListId}
            visibleColumns={visibleColumns}
            customFields={customFields}
            gridTemplate={gridTemplate}
            onOpenColumnsMenu={addColumnRail}
            allSelected={allSelected}
            someSelected={selectedInGroup > 0}
            onToggleAll={toggleAll}
            sort={sort}
            onSort={onSort}
          />
          {group.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              group={group}
              listTasks={listTasks}
              visibleColumns={visibleColumns}
              customFields={customFields}
              gridTemplate={gridTemplate}
              wrapText={config.wrapText}
              depth={0}
              dnd={dnd}
              onContextMenu={onContextMenu}
              renameRequestId={renameRequestId}
              onRenameConsumed={onRenameConsumed}
              locationName={showLocation ? listNames.get(task.listId) : undefined}
            />
          ))}
          <GroupQuickAdd onAdd={(name) => onQuickAdd(name, group)} gridTemplate={gridTemplate} />
        </div>
      )}
    </section>
  );
}

// ── view body ────────────────────────────────────────────────────────────────

interface ListViewBodyProps {
  /** What this body renders over: a single list, a folder, or a whole space. */
  scope: ViewScope;
  /** Tasks to render. For a list scope this is `useScopeTasks` over `[listId]`. */
  tasks: Task[];
}

function ListViewBody({ scope, tasks }: ListViewBodyProps) {
  const createTask = useWorkspaceStore((s) => s.createTask);
  const collapseAllGroups = useWorkspaceStore((s) => s.collapseAllGroups);
  const members = useWorkspaceStore(useShallow((s) => s.members));

  // Config persists under the scope key (raw listId for a list, namespaced for
  // space/folder), so a space gets its own group/sort/filter/columns without
  // colliding with any list. createTask / new-field actions target a concrete
  // list (the scope's default list).
  const configKey = scopeKey(scope);
  const targetListId = useScopeDefaultListId(scope);
  const config = useScopeConfig(scope);
  const statusDefs = useScopeStatuses(scope);
  const fields = useScopeCustomFields(scope);

  // For space/folder scope, show each task's list as a location chip (ClickUp
  // parity). Single-list scope keeps `showLocation` false → no chip, identical.
  const showLocation = scope.kind !== 'list';
  const scopeListIds = useScopeListIds(scope);
  const listNames = useWorkspaceStore(
    useShallow((s) => {
      const m = new Map<string, string>();
      if (showLocation) {
        for (const id of scopeListIds) {
          const name = sel.findList(s, id)?.list?.name;
          if (name) m.set(id, name);
        }
      }
      return m;
    }),
  );

  const [search, setSearch] = useState('');
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => t.name.toLowerCase().includes(q));
  }, [tasks, search]);

  const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);
  const onSortColumn = useCallback((col: ColumnId) => {
    setColumnSort((cur) => nextColumnSort(cur, col));
  }, []);

  const groups = useMemo(() => {
    const built = buildGroups(filteredTasks, config, members, statusDefs);
    // Header-click column sort wins while active; otherwise fall back to the
    // persisted toolbar Sort field so the Sort menu actually re-orders rows.
    const effectiveSort = columnSort ?? columnSortFromConfig(config);
    return sortGroups(built, effectiveSort);
  }, [filteredTasks, config, members, statusDefs, columnSort]);

  // Field defs keyed by id, so a `cf:<id>` column resolves to its definition.
  const customFields = useMemo(() => {
    const m = new Map<string, CustomFieldDef>();
    for (const f of fields) m.set(f.id, f);
    return m;
  }, [fields]);

  // Render built-in columns plus any `cf:` column whose field still exists.
  const visibleColumns = useMemo<TableColumnId[]>(
    () =>
      config.visibleColumns.filter(
        (c) => isBuiltinColumn(c) || customFields.has(c.slice(3)),
      ),
    [config.visibleColumns, customFields],
  );

  const gridTemplate = useMemo(() => buildGridTemplate(visibleColumns), [visibleColumns]);
  const collapsedSet = useMemo(() => new Set(config.collapsedGroups), [config.collapsedGroups]);

  // Patch applied when a task is dragged into a different group: stamp the
  // destination group's identity so the move changes the relevant field.
  const groupPatch = useMemo(
    () =>
      (group: ListGroup): Record<string, unknown> => {
        if (config.groupBy === 'status') {
          const sample = group.tasks[0];
          if (sample) {
            return { status: sample.status, statusColor: sample.statusColor, statusType: sample.statusType };
          }
          // Empty group → derive from the group's own status identity.
          return {
            status: group.label,
            statusColor: group.color,
            ...(group.statusType ? { statusType: group.statusType } : {}),
          };
        }
        if (config.groupBy === 'priority') {
          const key = group.key.split(':')[1] ?? 'none';
          if (key === 'none') return { priority: null, priorityColor: null };
          const opt = PRIORITY_OPTIONS.find((p) => p.key === key);
          return { priority: key, priorityColor: opt?.color ?? null };
        }
        if (config.groupBy === 'assignee') {
          const sample = group.tasks[0];
          return sample ? { assignees: sample.assignees } : { assignees: [] };
        }
        return {};
      },
    [config.groupBy],
  );

  const dnd = useListDnd(groups, { groupPatch });

  // Right-click "Rename" bridges to each row's local inline-rename: the menu
  // stamps the target id here, the matching TaskRow consumes it and clears it.
  const [renameRequestId, setRenameRequestId] = useState<string | null>(null);
  const onRename = useCallback((task: Task) => setRenameRequestId(task.id), []);
  const onRenameConsumed = useCallback(() => setRenameRequestId(null), []);
  const { onContextMenu, menu } = useTaskContextMenu(onRename);

  const quickAdd = (name: string, group: ListGroup) => {
    if (!targetListId) return;
    // Carry the group's identity into the new task where it maps to a field.
    if (config.groupBy === 'priority') {
      const key = group.key.split(':')[1] ?? 'none';
      createTask({ name, listId: targetListId, priority: key === 'none' ? null : key });
    } else if (config.groupBy === 'status') {
      // Works for empty groups too: the group carries its own status identity.
      const sample = group.tasks[0];
      createTask({
        name,
        listId: targetListId,
        status: sample?.status ?? group.label,
        statusColor: sample?.statusColor ?? group.color,
        ...(sample?.statusType ?? group.statusType
          ? { statusType: sample?.statusType ?? group.statusType }
          : {}),
      });
    } else {
      createTask({ name, listId: targetListId });
    }
  };

  const addTask = () => {
    if (!targetListId) return;
    const first = groups[0];
    const sample = first?.tasks[0];
    createTask({
      name: 'New Task',
      listId: targetListId,
      ...(first && config.groupBy === 'status'
        ? {
            status: sample?.status ?? first.label,
            statusColor: sample?.statusColor ?? first.color,
            ...(sample?.statusType ?? first.statusType
              ? { statusType: sample?.statusType ?? first.statusType }
              : {}),
          }
        : {}),
    });
  };

  const collapseAll = () => collapseAllGroups(configKey, groups.map((g) => g.key));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: APP_BG,
        color: TEXT_PRIMARY,
        overflow: 'hidden',
      }}
    >
      <Toolbar
        configKey={configKey}
        listTasks={filteredTasks}
        config={config}
        onAddTask={addTask}
        search={search}
        onSearchChange={setSearch}
      />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 48 }}>
        {groups.length === 0 ? (
          <div style={{ padding: '32px 24px', color: TEXT_MUTED, fontSize: 13 }}>
            {search.trim()
              ? `No tasks match "${search.trim()}".`
              : 'No tasks match the current filters.'}
          </div>
        ) : (
          groups.map((group) => (
            <GroupBlock
              key={group.key}
              group={group}
              configKey={configKey}
              targetListId={targetListId}
              listTasks={filteredTasks}
              config={config}
              visibleColumns={visibleColumns}
              customFields={customFields}
              gridTemplate={gridTemplate}
              collapsed={collapsedSet.has(group.key)}
              showLocation={showLocation}
              listNames={listNames}
              onQuickAdd={quickAdd}
              onCollapseAll={collapseAll}
              dnd={dnd}
              onContextMenu={onContextMenu}
              renameRequestId={renameRequestId}
              onRenameConsumed={onRenameConsumed}
              sort={columnSort}
              onSort={onSortColumn}
            />
          ))
        )}
      </div>

      <BulkActionBar />
      {menu}
    </div>
  );
}

/**
 * Scope-driven List view. For a `list` scope (`/v/l/<listId>`) this is identical
 * to before; for a `space`/`folder` scope it aggregates every task across the
 * scope's lists. The shell `viewId` resolves the breadcrumb/tab strip: the raw
 * listId for a list scope, otherwise the scope's default (first) list id.
 */
export function ListView({ scope }: { scope: ViewScope }) {
  const tasks = useScopeTasks(scope);
  const defaultListId = useScopeDefaultListId(scope);
  const viewId = scope.kind === 'list' ? scope.listId : defaultListId;
  return (
    <ViewShell code="l" viewId={viewId} scope={scope}>
      <ListViewBody scope={scope} tasks={tasks} />
    </ViewShell>
  );
}

/** My Tasks surface (`/my-work`). */
export function MyTasksListView() {
  const tasks = useMyTasks();
  const firstListId = useWorkspaceStore((s) => {
    for (const space of s.tree.spaces) {
      if (space.folderlessLists[0]) return space.folderlessLists[0].id;
      for (const folder of space.folders) if (folder.lists[0]) return folder.lists[0].id;
    }
    return '';
  });
  // My Tasks reads a cross-list task set but persists config/columns under the
  // first list (as before). A list scope over that id keeps single-list behaviour.
  const scope = useMemo<ViewScope>(() => ({ kind: 'list', listId: firstListId }), [firstListId]);

  if (!firstListId) {
    return (
      <ViewShell code="l" viewId="my-work">
        <div style={{ padding: '48px 24px', color: TEXT_MUTED, fontSize: 13 }}>
          No lists found in your workspace.
        </div>
      </ViewShell>
    );
  }

  return (
    <ViewShell code="l" viewId={firstListId}>
      <ListViewBody scope={scope} tasks={tasks} />
    </ViewShell>
  );
}
