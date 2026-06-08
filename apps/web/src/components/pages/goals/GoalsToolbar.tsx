'use client';

import { BORDER, TEXT_PRIMARY, PillButton, PlusIcon } from '../page-primitives';
import { SortIcon, FolderIcon } from './goals-icons';
import { useGoalsStore } from './goals-ui-store';

/**
 * Goals header toolbar: title + active folder label, a sort/folder filter pair,
 * and the primary "+ New Goal" CTA which prepends a goal to the active folder.
 */
export function GoalsToolbar() {
  const folders = useGoalsStore((s) => s.folders);
  const selectedFolderId = useGoalsStore((s) => s.selectedFolderId);
  const addGoal = useGoalsStore((s) => s.addGoal);

  const activeFolder = folders.find((f) => f.id === selectedFolderId);
  const filterLabel = activeFolder ? activeFolder.name : 'All folders';

  const handleNew = () => {
    const targetFolder = selectedFolderId ?? folders[0]?.id;
    if (targetFolder) addGoal(targetFolder);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        paddingLeft: 24,
        paddingRight: 16,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>
        {activeFolder ? activeFolder.name : 'Goals'}
      </h1>
      <span style={{ flex: 1 }} />
      <PillButton icon={<SortIcon />}>Sort: Due date</PillButton>
      <PillButton icon={<FolderIcon />} caret>
        {filterLabel}
      </PillButton>
      <button
        onClick={handleNew}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 12,
          paddingRight: 14,
          background: 'rgb(36, 174, 100)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'white',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.2px',
          textTransform: 'uppercase',
        }}
      >
        <PlusIcon size={14} />
        New Goal
      </button>
    </div>
  );
}
