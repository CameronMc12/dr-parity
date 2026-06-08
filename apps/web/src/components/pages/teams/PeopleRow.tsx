'use client';

import { useEffect, useRef, useState } from 'react';
import { MemberAvatar } from '@/components/pages/team/MemberAvatar';
import { teamName, type MemberRole, type MemberSeed } from '@/data/teams-seed';
import { EllipsisIcon } from '@/components/pages/page-primitives';
import { RolePill } from './RolePill';
import { T, ROW_HEIGHT } from './teams-tokens';
import { PencilIcon, TrashIcon } from './teams-icons';

const COLUMNS = '2.2fr 2.4fr 1fr 1.6fr 1.2fr 36px';

/** One member row in the People table. Hover reveals a kebab menu. */
export function PeopleRow({
  member,
  onRoleChange,
  onRemove,
}: {
  member: MemberSeed;
  onRoleChange: (role: MemberRole) => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div
      role="row"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS,
        alignItems: 'center',
        gap: 12,
        height: ROW_HEIGHT,
        paddingLeft: 24,
        paddingRight: 24,
        borderBottom: `1px solid ${T.border}`,
        background: hover ? T.hoverBg : 'transparent',
      }}
    >
      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <MemberAvatar initials={member.initials} color={member.color} size={30} />
          <span
            aria-label={member.online ? 'Online' : 'Offline'}
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: member.online ? T.green : 'rgb(180,180,180)',
              border: `2px solid ${T.appBg}`,
            }}
          />
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: T.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.name}
        </span>
      </div>

      {/* Email */}
      <span
        style={{
          fontSize: 13,
          color: T.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {member.email}
      </span>

      {/* Role */}
      <span>
        <RolePill role={member.role} onChange={onRoleChange} />
      </span>

      {/* Teams chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0 }}>
        {member.teamIds.map((id) => (
          <span
            key={id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 20,
              padding: '0 8px',
              background: T.hoverBg,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontSize: 11.5,
              fontWeight: 500,
              color: T.textSecondary,
              whiteSpace: 'nowrap',
            }}
          >
            {teamName(id)}
          </span>
        ))}
      </div>

      {/* Last active */}
      <span style={{ fontSize: 12.5, color: T.textMuted, whiteSpace: 'nowrap' }}>{member.lastActive}</span>

      {/* Kebab */}
      <div ref={kebabRef} style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          aria-label={`Actions for ${member.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: menuOpen ? T.hoverBg : 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: T.textMuted,
            opacity: hover || menuOpen ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        >
          <EllipsisIcon size={16} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 2px)',
              right: 0,
              zIndex: 40,
              minWidth: 160,
              padding: 4,
              background: T.menuBg,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              boxShadow: '0 6px 24px rgba(0,0,0,0.14)',
            }}
          >
            <MenuItem icon={<PencilIcon size={15} />} label="Edit role" onClick={() => setMenuOpen(false)} />
            <MenuItem
              icon={<TrashIcon size={15} />}
              label="Remove from workspace"
              danger
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const color = danger ? 'rgb(214,69,69)' : T.textPrimary;
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        height: 32,
        padding: '0 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color,
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = T.hoverBg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', color }}>{icon}</span>
      {label}
    </button>
  );
}

export { COLUMNS as PEOPLE_COLUMNS };
