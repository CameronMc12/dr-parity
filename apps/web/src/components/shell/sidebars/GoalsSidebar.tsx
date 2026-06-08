'use client';

import { useGoalsStore } from '@/components/pages/goals/goals-ui-store';
import { GoalsGlyph, FolderIcon } from '@/components/pages/goals/goals-icons';

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';
const COUNT = 'var(--cu-text-disabled)';
const DIVIDER = 'var(--cu-border-divider)';

/**
 * Goals sidebar: "All Goals", a "Goal Folders" group listing each folder with
 * its goal count, and "+ Add Goal Folder". Selecting a row filters the page via
 * the shared goals store; the active row is highlighted.
 */
export function GoalsSidebar() {
  const folders = useGoalsStore((s) => s.folders);
  const goals = useGoalsStore((s) => s.goals);
  const selectedFolderId = useGoalsStore((s) => s.selectedFolderId);
  const selectFolder = useGoalsStore((s) => s.selectFolder);
  const addFolder = useGoalsStore((s) => s.addFolder);

  const countFor = (folderId: string) => goals.filter((g) => g.folderId === folderId).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--cu-font)' }}>
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Goals</span>
      </div>

      <div style={{ padding: '0 4px', flexShrink: 0 }}>
        <Row
          icon={<GoalsGlyph size={16} />}
          label="All Goals"
          count={goals.length}
          active={selectedFolderId === null}
          onClick={() => selectFolder(null)}
        />
      </div>

      <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 8px' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 12px' }}>
        <h3 style={{ margin: 0, padding: '0 8px 4px', color: MUTED, fontSize: 12, fontWeight: 600, lineHeight: '20px' }}>
          Goal Folders
        </h3>

        {folders.map((folder) => (
          <Row
            key={folder.id}
            icon={
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: folder.color }}>
                <FolderIcon size={16} />
              </span>
            }
            label={folder.name}
            count={countFor(folder.id)}
            active={selectedFolderId === folder.id}
            onClick={() => selectFolder(folder.id)}
          />
        ))}

        <button
          type="button"
          onClick={addFolder}
          style={{
            width: '100%',
            minHeight: 30,
            marginTop: 2,
            padding: '5px 8px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: MUTED,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          Add Goal Folder
        </button>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 30,
        padding: '5px 8px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? TEXT : MUTED,
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: MUTED }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: COUNT, fontSize: 12, flexShrink: 0 }}>{count}</span>
    </button>
  );
}
