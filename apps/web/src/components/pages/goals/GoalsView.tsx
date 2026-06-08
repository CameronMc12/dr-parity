'use client';

import { useMemo } from 'react';
import { PageSurface, TEXT_MUTED, TEXT_PRIMARY } from '../page-primitives';
import { GoalsToolbar } from './GoalsToolbar';
import { FolderGroup } from './FolderGroup';
import { useGoalsStore } from './goals-ui-store';
import { GoalsGlyph } from './goals-icons';

/**
 * Goals surface. Header toolbar over a scrolling list of Goal Folders; each
 * folder collapses and lists its goals, each goal expands to its targets (key
 * results). All progress rolls up live from interactive target edits.
 */
export function GoalsView() {
  const folders = useGoalsStore((s) => s.folders);
  const goals = useGoalsStore((s) => s.goals);
  const selectedFolderId = useGoalsStore((s) => s.selectedFolderId);

  const visibleFolders = useMemo(
    () => (selectedFolderId ? folders.filter((f) => f.id === selectedFolderId) : folders),
    [folders, selectedFolderId],
  );

  const goalsByFolder = useMemo(() => {
    const map: Record<string, typeof goals> = {};
    for (const goal of goals) {
      (map[goal.folderId] ??= []).push(goal);
    }
    return map;
  }, [goals]);

  return (
    <PageSurface>
      <GoalsToolbar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 0 32px' }}>
        {visibleFolders.length === 0 ? (
          <EmptyGoals />
        ) : (
          visibleFolders.map((folder) => (
            <FolderGroup key={folder.id} folder={folder} goals={goalsByFolder[folder.id] ?? []} />
          ))
        )}
      </div>
    </PageSurface>
  );
}

function EmptyGoals() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '80px 24px',
        textAlign: 'center',
        color: TEXT_MUTED,
      }}
    >
      <span style={{ color: 'rgb(36, 174, 100)' }}>
        <GoalsGlyph size={40} />
      </span>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>No goal folders yet</div>
      <div style={{ fontSize: 13 }}>Add a goal folder from the sidebar to get started.</div>
    </div>
  );
}
