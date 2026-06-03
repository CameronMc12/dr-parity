'use client';

/**
 * Small floating segmented control that lets the user flip the Mind Map between
 * the Tasks structure and the Freeform canvas without going back to the chooser,
 * plus a quiet "Choose structure" reset that re-opens the picker. Pinned to the
 * top-right of the canvas.
 */

import { useState } from 'react';
import type { MindStructure } from './use-structure';

const BAR_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const TEXT = 'var(--cu-text-secondary, rgb(160,160,160))';
const TEXT_ACTIVE = 'var(--cu-text-primary, rgb(245,245,245))';
const ACTIVE_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.10))';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.06))';

interface Props {
  active: MindStructure;
  onChange: (next: MindStructure) => void;
  onReset: () => void;
}

export function StructureSwitch({ active, onChange, onReset }: Props) {
  return (
    <div
      data-testid="mindmap-structure-switch"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 12,
        right: 16,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        role="tablist"
        aria-label="Mind map structure"
        style={{
          display: 'flex',
          padding: 3,
          gap: 2,
          background: BAR_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
      >
        <Seg
          label="Tasks"
          testid="mindmap-switch-tasks"
          active={active === 'tasks'}
          onClick={() => onChange('tasks')}
        />
        <Seg
          label="Freeform"
          testid="mindmap-switch-freeform"
          active={active === 'freeform'}
          onClick={() => onChange('freeform')}
        />
      </div>
      <ResetButton onClick={onReset} />
    </div>
  );
}

function Seg({
  label,
  testid,
  active,
  onClick,
}: {
  label: string;
  testid: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      data-testid={testid}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '5px 12px',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        fontFamily: 'inherit',
        color: active ? TEXT_ACTIVE : TEXT,
        background: active ? ACTIVE_BG : hover ? HOVER_BG : 'transparent',
        transition: 'background 120ms, color 120ms',
      }}
    >
      {label}
    </button>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="mindmap-structure-reset"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 30,
        padding: '0 12px',
        background: hover ? HOVER_BG : BAR_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        color: hover ? TEXT_ACTIVE : TEXT,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        transition: 'background 120ms, color 120ms',
      }}
    >
      Choose structure
    </button>
  );
}
