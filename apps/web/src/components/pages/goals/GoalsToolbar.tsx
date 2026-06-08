import { BORDER, TEXT_PRIMARY, PillButton, PlusIcon } from '../page-primitives';
import { SortIcon, FolderIcon, ArchivedIcon } from './goals-icons';

/**
 * Goals header toolbar. Oracle (right-aligned over the page title row):
 * Sort by: Updated · Folders: Hide · Archived: Hide · [+ NEW GOAL].
 */
export function GoalsToolbar() {
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
      <h1 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: 0 }}>Goals</h1>
      <span style={{ flex: 1 }} />
      <PillButton icon={<SortIcon />}>Sort by: Updated</PillButton>
      <PillButton icon={<FolderIcon />}>Folders: Hide</PillButton>
      <PillButton icon={<ArchivedIcon />}>Archived: Hide</PillButton>
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingLeft: 12,
          paddingRight: 14,
          background: 'rgb(48, 48, 48)',
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
