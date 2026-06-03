'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { SubtasksMode } from '@/store/workspace/view-config.types';
import { CheckMark, SectionLabel } from './menu-parts';
import { LV } from './tokens';

const MODES: { key: SubtasksMode; label: string; hint?: string; note?: string }[] = [
  { key: 'collapsed', label: 'Collapsed', hint: '(default)' },
  { key: 'expanded', label: 'Expanded' },
  { key: 'separate', label: 'Separate', note: 'Use this to filter subtasks' },
];

/**
 * Subtasks mode row. ClickUp marks the active mode with a right-aligned
 * checkmark (no left radio), so the row reads label-first with the hint
 * inline and any note beneath.
 */
function ModeRow({
  label,
  hint,
  note,
  checked,
  onClick,
}: {
  label: string;
  hint?: string;
  note?: string;
  checked: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitemradio"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 14px',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: LV.textPrimary }}>{label}</span>
          {hint && <span style={{ fontSize: 12, color: LV.textMuted }}>{hint}</span>}
        </span>
        {note && <span style={{ fontSize: 12, color: LV.textMuted }}>{note}</span>}
      </span>
      {checked && (
        <span style={{ marginTop: 2, display: 'inline-flex', flexShrink: 0 }}>
          <CheckMark />
        </span>
      )}
    </button>
  );
}

/** Subtasks display-mode menu: radio Collapsed / Expanded / Separate. */
export function SubtasksMenu({
  listId,
  mode,
  trigger,
}: {
  listId: string;
  mode: SubtasksMode;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const setSubtasksMode = useWorkspaceStore((s) => s.setSubtasksMode);

  return (
    <Menu width={240} align="left" trigger={trigger}>
      <SectionLabel>Show subtasks</SectionLabel>
      {MODES.map((m) => (
        <ModeRow
          key={m.key}
          label={m.label}
          hint={m.hint}
          note={m.note}
          checked={mode === m.key}
          onClick={() => setSubtasksMode(listId, m.key)}
        />
      ))}
    </Menu>
  );
}
