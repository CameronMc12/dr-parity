'use client';

/**
 * Team-view Customize panel. Drops under the toolbar when the Customize button
 * is on, mirroring ClickUp's Customize drawer: a row of toggles that control
 * which sections of the board render. Every toggle is wired to real state in
 * TeamView — flipping one immediately reshapes the board.
 */

import { useState } from 'react';
import { TEAM } from './tokens';

/** Section-visibility flags owned by TeamView and read by the renderer. */
export interface TeamDisplay {
  /** Render the trailing Workload capacity card. */
  showWorkload: boolean;
  /** Drop assignee cards that have no tasks after filtering. */
  hideEmpty: boolean;
}

export const DEFAULT_TEAM_DISPLAY: TeamDisplay = {
  showWorkload: true,
  hideEmpty: false,
};

interface CustomizePanelProps {
  display: TeamDisplay;
  onToggle: (key: keyof TeamDisplay) => void;
  onClose: () => void;
}

export function CustomizePanel({ display, onToggle, onClose }: CustomizePanelProps) {
  return (
    <div
      role="region"
      aria-label="Customize team view"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: `1px solid ${TEAM.border}`,
        background: TEAM.cardBg,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: TEAM.textSecondary }}>
        Customize
      </span>

      <ToggleChip
        label="Workload card"
        on={display.showWorkload}
        onClick={() => onToggle('showWorkload')}
      />
      <ToggleChip
        label="Hide empty assignees"
        on={display.hideEmpty}
        onClick={() => onToggle('hideEmpty')}
      />

      <button
        type="button"
        onClick={onClose}
        style={{
          marginLeft: 'auto',
          height: 26,
          padding: '0 10px',
          border: `1px solid ${TEAM.border}`,
          borderRadius: TEAM.radiusSm,
          background: 'transparent',
          color: TEAM.textSecondary,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
        }}
      >
        Done
      </button>
    </div>
  );
}

function ToggleChip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 10px',
        border: `1px solid ${on ? TEAM.accent : TEAM.border}`,
        borderRadius: TEAM.radiusSm,
        background: hover || on ? TEAM.hoverBg : 'transparent',
        color: on ? TEAM.textPrimary : TEAM.textSecondary,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 14,
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
            left: on ? 12 : 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 140ms ease',
          }}
        />
      </span>
      {label}
    </button>
  );
}
