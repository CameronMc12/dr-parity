'use client';

import { BORDER, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import type { Goal, GoalFolder } from '@/data/goals-seed';
import { useGoalsStore } from './goals-ui-store';
import { GoalRow } from './GoalRow';
import { ChevronIcon } from './goals-icons';
import { PlusIcon } from '../page-primitives';

/** A Goal Folder: collapsible header + its goals (or an empty state). */
export function FolderGroup({ folder, goals }: { folder: GoalFolder; goals: Goal[] }) {
  const collapsed = useGoalsStore((s) => s.collapsed[folder.id] ?? false);
  const toggleCollapse = useGoalsStore((s) => s.toggleCollapse);
  const addGoal = useGoalsStore((s) => s.addGoal);

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <button
          onClick={() => toggleCollapse(folder.id)}
          aria-label={collapsed ? 'Expand folder' : 'Collapse folder'}
          aria-expanded={!collapsed}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: TEXT_MUTED,
            padding: 2,
          }}
        >
          <ChevronIcon open={!collapsed} size={14} />
        </button>

        <span
          style={{ width: 8, height: 8, borderRadius: 9999, background: folder.color, flexShrink: 0 }}
        />

        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{folder.name}</span>
        <span style={{ fontSize: 12, color: TEXT_MUTED }}>{goals.length}</span>

        <span style={{ flex: 1 }} />

        <button
          onClick={() => addGoal(folder.id)}
          aria-label={`Add goal to ${folder.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_MUTED,
            fontSize: 12,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <PlusIcon size={13} />
          New Goal
        </button>
      </div>

      {!collapsed &&
        (goals.length > 0 ? (
          goals.map((goal) => <GoalRow key={goal.id} goal={goal} />)
        ) : (
          <div
            style={{
              padding: '28px 16px',
              textAlign: 'center',
              fontSize: 13,
              color: TEXT_MUTED,
            }}
          >
            No goals in this folder yet.
            <button
              onClick={() => addGoal(folder.id)}
              style={{
                marginLeft: 6,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'rgb(36, 174, 100)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Create one
            </button>
          </div>
        ))}
    </div>
  );
}
