'use client';

import { useEffect, useRef, useState } from 'react';
import { ROLE_DEFS, ROLE_ORDER, type MemberRole } from '@/data/teams-seed';
import { T } from './teams-tokens';
import { CaretMini } from './teams-icons';

/** Editable role chip. Click opens a small dropdown that commits a new role. */
export function RolePill({
  role,
  onChange,
}: {
  role: MemberRole;
  onChange: (role: MemberRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const def = ROLE_DEFS[role];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 24,
          paddingLeft: 10,
          paddingRight: 7,
          background: def.bg,
          color: def.fg,
          border: 'none',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {def.label}
        <CaretMini size={9} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 40,
            minWidth: 150,
            padding: 4,
            background: T.menuBg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
          }}
        >
          {ROLE_ORDER.map((key) => {
            const opt = ROLE_DEFS[key];
            const active = key === role;
            return (
              <button
                key={key}
                role="menuitem"
                type="button"
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
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
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = T.hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = active ? T.hoverBg : 'transparent';
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.fg, flexShrink: 0 }} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
