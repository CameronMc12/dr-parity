'use client';

import { type ReactNode, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useSidebarPrefsStore } from '@/store/sidebar-prefs-store';
import { MenuDivider } from '@/components/ui/Menu';
import { SidebarToggle } from './SidebarToggle';
import {
  ArchiveGlyph,
  EyeGlyph,
  ManageSpacesGlyph,
  PlusGlyph,
} from './SidebarHeaderIcons';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';

function ActionRow({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        minHeight: 32,
        background: hover ? HOVER : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TEXT,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ display: 'flex', color: MUTED, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        minHeight: 32,
        background: hover ? HOVER : 'transparent',
        color: TEXT,
        fontSize: 13,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'flex', color: MUTED, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <SidebarToggle checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

/** Content for the header ellipsis (⋯) popover, shared by Home + Spaces. */
export function SidebarOptionsMenu() {
  const createSpace = useWorkspaceStore((s) => s.createSpace);
  const showAllSpaces = useSidebarPrefsStore((s) => s.showAllSpaces);
  const showArchived = useSidebarPrefsStore((s) => s.showArchived);
  const setShowAllSpaces = useSidebarPrefsStore((s) => s.setShowAllSpaces);
  const setShowArchived = useSidebarPrefsStore((s) => s.setShowArchived);

  const addSpace = () => {
    const name = window.prompt('Space name')?.trim();
    if (name) createSpace(name);
  };

  return (
    <>
      <ActionRow icon={<PlusGlyph size={16} />} label="Create Space" onClick={addSpace} />
      <ActionRow icon={<ManageSpacesGlyph />} label="Manage Spaces" />
      <MenuDivider />
      <ToggleRow
        icon={<EyeGlyph />}
        label="Show all Spaces"
        checked={showAllSpaces}
        onChange={setShowAllSpaces}
      />
      <ToggleRow
        icon={<ArchiveGlyph />}
        label="Show archived"
        checked={showArchived}
        onChange={setShowArchived}
      />
    </>
  );
}
