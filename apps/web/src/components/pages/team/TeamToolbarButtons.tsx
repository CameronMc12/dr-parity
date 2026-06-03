'use client';

/**
 * Shared toolbar button primitives for the Team view header. `ToolbarButton` is
 * the labelled pill (sort / filter / assignee / customize / add-task); the
 * `primary` variant is the accent CTA. `IconOnlyButton` is the square icon
 * affordance used for the search control.
 */

import { useState } from 'react';
import { TEAM } from './tokens';

interface ToolbarButtonProps {
  ref?: React.Ref<HTMLButtonElement>;
  label: string;
  icon?: string;
  active?: boolean;
  primary?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function ToolbarButton({ ref, label, icon, active, primary, onClick }: ToolbarButtonProps) {
  const [hover, setHover] = useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: TEAM.radiusSm,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    transition: 'background 120ms ease, border-color 120ms ease',
  };

  if (primary) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...base,
          border: 'none',
          color: '#fff',
          background: hover ? 'color-mix(in srgb, var(--cu-accent) 85%, black)' : TEAM.accent,
        }}
      >
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...base,
        border: `1px solid ${active ? TEAM.accent : TEAM.border}`,
        color: active ? TEAM.textPrimary : TEAM.textSecondary,
        background: hover || active ? TEAM.hoverBg : 'transparent',
      }}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}

interface IconOnlyButtonProps {
  ref?: React.Ref<HTMLButtonElement>;
  title: string;
  icon: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function IconOnlyButton({ ref, title, icon, active, onClick }: IconOnlyButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={ref}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: TEAM.radiusSm,
        border: `1px solid ${active ? TEAM.accent : 'transparent'}`,
        background: hover || active ? TEAM.hoverBg : 'transparent',
        color: active ? TEAM.textPrimary : TEAM.textSecondary,
        cursor: 'pointer',
        fontSize: 16,
        fontFamily: 'inherit',
      }}
    >
      {icon}
    </button>
  );
}
