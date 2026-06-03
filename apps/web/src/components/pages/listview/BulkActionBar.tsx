'use client';

import { useState, type ReactNode } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { DeleteIcon, FlagOutline, PersonAddIcon, TagIcon } from '../list-view-icons';

const BAR_BG = 'rgb(30, 30, 30)';
const BORDER = 'var(--cu-border-strong, rgba(255,255,255,0.14))';
const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-secondary)';
const OVERDUE = 'rgb(226, 67, 41)';

function BarButton({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = danger ? OVERDUE : hover ? TEXT : MUTED;
  return (
    <button
      data-testid={`bulk-action-${label.toLowerCase()}`}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 10px',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ display: 'inline-flex', color }}>{icon}</span>
      {label}
    </button>
  );
}

/** Floating bulk-action bar shown while ≥1 task is selected. */
export function BulkActionBar() {
  const selected = useUiStore((s) => s.selectedTaskIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const deleteTasks = useWorkspaceStore((s) => s.deleteTasks);

  if (selected.length === 0) return null;

  return (
    <div
      data-testid="bulk-action-bar"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 48,
        padding: '0 8px 0 16px',
        background: BAR_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        zIndex: 50,
        animation: 'cuBulkIn 140ms ease',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 22,
          height: 22,
          padding: '0 6px',
          background: 'var(--cu-accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        {selected.length}
      </span>
      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500, marginRight: 6 }}>
        selected
      </span>

      <span style={{ width: 1, height: 22, background: BORDER, margin: '0 4px' }} />

      <BarButton label="Assign" icon={<PersonAddIcon size={15} color="currentColor" />} />
      <BarButton label="Priority" icon={<FlagOutline size={15} color="currentColor" />} />
      <BarButton label="Tag" icon={<TagIcon size={15} color="currentColor" />} />
      <BarButton
        label="Delete"
        danger
        icon={<DeleteIcon />}
        onClick={() => {
          deleteTasks(selected);
          clearSelection();
        }}
      />

      <span style={{ width: 1, height: 22, background: BORDER, margin: '0 4px' }} />

      <BarButton label="Done" icon={<span style={{ fontSize: 15, lineHeight: 1 }}>×</span>} onClick={clearSelection} />

      <style>{`@keyframes cuBulkIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}
