'use client';

/**
 * Team-view toolbar. Left: a "Separate" toggle switching per-assignee cards vs a
 * combined card. Right: Task Name sort, Filter, Assignee popovers, the current
 * user's avatar, a Customize button, and Add Task. Every control is wired —
 * sort/assignee write into local toolbar state; Add Task opens the create modal.
 */

import { useState } from 'react';
import { Menu, MenuDivider, MenuHeading, MenuItem } from '@/components/ui/Menu';
import { useUiStore } from '@/store/ui-store';
import { useCurrentMemberId, useMembers } from '@/store/workspace/hooks';
import { MemberAvatar } from './MemberAvatar';
import { IconOnlyButton, ToolbarButton } from './TeamToolbarButtons';
import { TEAM } from './tokens';

export type SortKey =
  | 'name'
  | 'name-desc'
  | 'due-date'
  | 'due-date-desc'
  | 'priority';

/** The three independent predicate toggles in the Filter popover. */
export interface TeamFilters {
  activeOnly: boolean;
  hasDueDate: boolean;
  highPriorityOnly: boolean;
}

export const EMPTY_TEAM_FILTERS: TeamFilters = {
  activeOnly: false,
  hasDueDate: false,
  highPriorityOnly: false,
};

interface TeamToolbarProps {
  listId: string;
  separate: boolean;
  onToggleSeparate: () => void;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  filters: TeamFilters;
  onToggleFilter: (key: keyof TeamFilters) => void;
  assigneeFilter: string | null;
  onAssigneeFilter: (memberId: string | null) => void;
  customizing: boolean;
  onToggleCustomize: () => void;
}

export function TeamToolbar({
  listId,
  separate,
  onToggleSeparate,
  sort,
  onSort,
  filters,
  onToggleFilter,
  assigneeFilter,
  onAssigneeFilter,
  customizing,
  onToggleCustomize,
}: TeamToolbarProps) {
  const members = useMembers();
  const currentId = useCurrentMemberId();
  const me = members.find((m) => m.id === currentId) ?? null;
  const openCreateTask = useUiStore((s) => s.openCreateTask);

  const activeAssignee =
    assigneeFilter === null
      ? null
      : members.find((m) => m.id === assigneeFilter) ?? null;

  const filterCount =
    Number(filters.activeOnly) +
    Number(filters.hasDueDate) +
    Number(filters.highPriorityOnly);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px',
        borderBottom: `1px solid ${TEAM.border}`,
        background: TEAM.toolbarBg,
        flexShrink: 0,
      }}
    >
      <SeparateToggle on={separate} onToggle={onToggleSeparate} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SortMenu sort={sort} onSort={onSort} />

        <Menu
          width={220}
          align="right"
          trigger={({ ref, onClick, open }) => (
            <ToolbarButton
              ref={ref}
              label={filterCount > 0 ? `Filter (${filterCount})` : 'Filter'}
              icon="⛛"
              active={open || filterCount > 0}
              onClick={onClick}
            />
          )}
        >
          <MenuHeading>Filter</MenuHeading>
          <MenuItem
            label="Active tasks only"
            description="Hide closed work"
            active={filters.activeOnly}
            keepOpen
            onSelect={() => onToggleFilter('activeOnly')}
          />
          <MenuItem
            label="Has due date"
            active={filters.hasDueDate}
            keepOpen
            onSelect={() => onToggleFilter('hasDueDate')}
          />
          <MenuItem
            label="High priority"
            active={filters.highPriorityOnly}
            keepOpen
            onSelect={() => onToggleFilter('highPriorityOnly')}
          />
        </Menu>

        <Menu
          width={220}
          align="right"
          trigger={({ ref, onClick, open }) => (
            <ToolbarButton
              ref={ref}
              label={activeAssignee ? activeAssignee.name : 'Assignee'}
              active={open || activeAssignee !== null}
              onClick={onClick}
            />
          )}
        >
          <MenuHeading>Filter by assignee</MenuHeading>
          <MenuItem
            label="All assignees"
            active={assigneeFilter === null}
            onSelect={() => onAssigneeFilter(null)}
          />
          <MenuDivider />
          {members.map((m) => (
            <MenuItem
              key={m.id}
              label={m.name}
              active={assigneeFilter === m.id}
              onSelect={() => onAssigneeFilter(m.id)}
            />
          ))}
        </Menu>

        {me && (
          <span title={me.name} style={{ display: 'inline-flex' }}>
            <MemberAvatar initials={me.initials} color={me.color} size={26} />
          </span>
        )}

        <SearchButton />

        <ToolbarButton label="Customize" icon="⚙" active={customizing} onClick={onToggleCustomize} />

        <AddTaskSplit listId={listId} onAddTask={() => openCreateTask(listId)} />
      </div>
    </div>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────

function SearchButton() {
  const [query, setQuery] = useState('');
  return (
    <Menu
      width={240}
      align="right"
      trigger={({ ref, onClick, open: o }) => (
        <IconOnlyButton ref={ref} title="Search this view" icon="⌕" active={o} onClick={onClick} />
      )}
    >
      <div style={{ padding: 8 }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks…"
          style={{
            width: '100%',
            height: 30,
            padding: '0 10px',
            border: `1px solid ${TEAM.border}`,
            borderRadius: TEAM.radiusSm,
            background: TEAM.bg,
            color: TEAM.textPrimary,
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </Menu>
  );
}

// ── Add Task (split button + type dropdown) ──────────────────────────────────

function AddTaskSplit({ listId, onAddTask }: { listId: string; onAddTask: () => void }) {
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
      <button
        type="button"
        onClick={onAddTask}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 30,
          padding: '0 12px',
          border: 'none',
          borderRadius: `${TEAM.radiusSm} 0 0 ${TEAM.radiusSm}`,
          background: TEAM.accent,
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        Add Task
      </button>
      <Menu
        width={200}
        align="right"
        trigger={({ ref, onClick }) => (
          <button
            ref={ref}
            type="button"
            aria-label="Choose task type"
            onClick={onClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 30,
              border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.25)',
              borderRadius: `0 ${TEAM.radiusSm} ${TEAM.radiusSm} 0`,
              background: TEAM.accent,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            ▾
          </button>
        )}
      >
        <MenuHeading>Create new</MenuHeading>
        <MenuItem label="Task" onSelect={() => openCreateTask(listId)} />
        <MenuItem label="Milestone" onSelect={() => openCreateTask(listId)} />
        <MenuItem label="Form response" onSelect={() => openCreateTask(listId)} />
      </Menu>
    </div>
  );
}

// ── Separate toggle ─────────────────────────────────────────────────────────

function SeparateToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        padding: '0 12px',
        border: `1px solid ${on ? TEAM.accent : TEAM.border}`,
        borderRadius: TEAM.radiusSm,
        background: hover || on ? TEAM.hoverBg : 'transparent',
        color: on ? TEAM.textPrimary : TEAM.textSecondary,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
    >
      Separate
      <span
        style={{
          width: 28,
          height: 16,
          borderRadius: 9999,
          background: on ? TEAM.accent : TEAM.borderStrong,
          position: 'relative',
          flexShrink: 0,
          transition: 'background 140ms ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 140ms ease',
          }}
        />
      </span>
    </button>
  );
}

// ── Sort menu ───────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Task Name',
  'name-desc': 'Task Name',
  'due-date': 'Due Date',
  'due-date-desc': 'Due Date',
  priority: 'Priority',
};

const ASCENDING = new Set<SortKey>(['name', 'due-date']);

function SortMenu({ sort, onSort }: { sort: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <Menu
      width={220}
      align="right"
      trigger={({ ref, onClick, open }) => (
        <ToolbarButton
          ref={ref}
          label={SORT_LABELS[sort]}
          icon={ASCENDING.has(sort) ? '↑' : '↓'}
          active={open}
          onClick={onClick}
        />
      )}
    >
      <MenuHeading>Sort tasks</MenuHeading>
      <MenuItem label="Task name (A → Z)" active={sort === 'name'} onSelect={() => onSort('name')} />
      <MenuItem
        label="Task name (Z → A)"
        active={sort === 'name-desc'}
        onSelect={() => onSort('name-desc')}
      />
      <MenuDivider />
      <MenuItem
        label="Due date (soonest)"
        active={sort === 'due-date'}
        onSelect={() => onSort('due-date')}
      />
      <MenuItem
        label="Due date (latest)"
        active={sort === 'due-date-desc'}
        onSelect={() => onSort('due-date-desc')}
      />
      <MenuDivider />
      <MenuItem
        label="Priority (high → low)"
        active={sort === 'priority'}
        onSelect={() => onSort('priority')}
      />
    </Menu>
  );
}
