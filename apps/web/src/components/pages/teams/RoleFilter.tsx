'use client';

import { useEffect, useRef, useState } from 'react';
import { PillButton } from '@/components/pages/page-primitives';
import { ROLE_DEFS, ROLE_ORDER, type MemberRole } from '@/data/teams-seed';
import { T } from './teams-tokens';

/** Toolbar "Role" filter dropdown. Null = all roles. */
export function RoleFilter({
  value,
  onChange,
}: {
  value: MemberRole | null;
  onChange: (role: MemberRole | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = value ? ROLE_DEFS[value].label : 'Role';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <PillButton caret active={value != null || open} onClick={() => setOpen((v) => !v)}>
        {label}
      </PillButton>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 40,
            minWidth: 160,
            padding: 4,
            background: T.menuBg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
          }}
        >
          <Item label="All roles" active={value == null} onClick={() => { onChange(null); setOpen(false); }} />
          {ROLE_ORDER.map((key) => (
            <Item
              key={key}
              label={ROLE_DEFS[key].label}
              dot={ROLE_DEFS[key].fg}
              active={value === key}
              onClick={() => { onChange(key); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Item({
  label,
  dot,
  active,
  onClick,
}: {
  label: string;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 32,
        padding: '0 10px',
        background: active ? T.hoverBg : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: T.textPrimary,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.hoverBg)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = active ? T.hoverBg : 'transparent')}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: dot ?? 'transparent',
          border: dot ? 'none' : `1px solid ${T.border}`,
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
}
