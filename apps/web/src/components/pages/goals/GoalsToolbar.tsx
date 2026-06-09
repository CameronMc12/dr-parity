'use client';

import type { ReactNode } from 'react';
import { TEXT_PRIMARY } from '../page-primitives';
import { SortIcon, FolderIcon, ArchivedIcon } from './goals-icons';
import { useGoalsStore } from './goals-ui-store';

const BTN_TEXT = 'var(--cu-text-secondary)';
const ACTIVE_BG = 'var(--cu-bg-active)';
const DARK_BG = 'var(--cu-text-primary)';

/**
 * Goals landing toolbar: "Goals" heading on the left; "Sort by: Updated", a
 * "Folders: Hide" toggle (highlighted when active), an "Archived: Hide" toggle,
 * and the primary "+ NEW GOAL" dark button on the right.
 */
export function GoalsToolbar() {
  const showFolders = useGoalsStore((s) => s.showFolders);
  const showArchived = useGoalsStore((s) => s.showArchived);
  const toggleFolders = useGoalsStore((s) => s.toggleFolders);
  const toggleArchived = useGoalsStore((s) => s.toggleArchived);
  const addGoal = useGoalsStore((s) => s.addGoal);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        paddingLeft: 24,
        paddingRight: 16,
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>Goals</h1>
      <span style={{ flex: 1 }} />

      <ToolbarBtn icon={<SortIcon />}>Sort by: Updated</ToolbarBtn>
      <ToolbarBtn icon={<FolderIcon />} active={!showFolders} onClick={toggleFolders}>
        Folders: {showFolders ? 'Show' : 'Hide'}
      </ToolbarBtn>
      <ToolbarBtn icon={<ArchivedIcon />} onClick={toggleArchived}>
        Archived: {showArchived ? 'Show' : 'Hide'}
      </ToolbarBtn>

      <button
        type="button"
        onClick={addGoal}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          marginLeft: 4,
          paddingLeft: 12,
          paddingRight: 14,
          background: DARK_BG,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--cu-bg-app)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.3px',
          textTransform: 'uppercase',
        }}
      >
        + New Goal
      </button>
    </div>
  );
}

function ToolbarBtn({
  icon,
  children,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        paddingLeft: 10,
        paddingRight: 10,
        background: active ? ACTIVE_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: BTN_TEXT,
        fontSize: 13,
        fontWeight: 400,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'flex', color: 'var(--cu-text-muted)', lineHeight: 0 }}>{icon}</span>
      {children}
    </button>
  );
}
