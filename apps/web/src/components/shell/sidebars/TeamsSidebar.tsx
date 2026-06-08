'use client';

import { useState } from 'react';
import { TEAM_SEED, TEAM_COUNT, PEOPLE_COUNT, type TeamSeed } from '@/data/teams-seed';
import {
  UserGroupIcon,
  UserIdIcon,
  PulseIcon,
  PlusGlyph,
  CaretMini,
} from '@/components/pages/teams/teams-icons';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const COUNT = 'var(--cu-text-disabled, rgb(160,160,160))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACTIVE = 'var(--cu-bg-active, rgb(240,240,240))';
const DIVIDER = 'var(--cu-border-divider, rgb(232,232,232))';

type Selection = 'all-teams' | 'all-people' | 'analytics' | string;

/** Teams Pulse sidebar: All Teams / All People / Analytics + a My Teams group. */
export function TeamsSidebar() {
  const [active, setActive] = useState<Selection>('all-teams');
  const myTeams = TEAM_SEED.filter((t) => t.name === 'Test Team');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--cu-font)',
      }}
    >
      <Header />

      <div style={{ padding: '0 4px', flexShrink: 0 }}>
        <NavRow
          icon={<UserGroupIcon size={16} />}
          label="All Teams"
          count={TEAM_COUNT}
          active={active === 'all-teams'}
          onClick={() => setActive('all-teams')}
        />
        <NavRow
          icon={<UserIdIcon size={16} />}
          label="All People"
          count={PEOPLE_COUNT}
          active={active === 'all-people'}
          onClick={() => setActive('all-people')}
        />
        <NavRow
          icon={<PulseIcon size={16} />}
          label="Analytics"
          active={active === 'analytics'}
          onClick={() => setActive('analytics')}
        />
      </div>

      <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 12px 6px' }} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 12px' }}>
        <h3
          style={{
            margin: 0,
            padding: '2px 8px 4px',
            color: MUTED,
            fontSize: 11.5,
            fontWeight: 600,
            lineHeight: '20px',
          }}
        >
          My Teams
        </h3>
        {myTeams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            active={active === team.id}
            onClick={() => setActive(team.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 8px 8px 12px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Teams</span>
      <button type="button" aria-label="Create" style={createBtnStyle}>
        <PlusGlyph size={15} />
        <span style={{ display: 'flex', color: MUTED }}>
          <CaretMini size={11} />
        </span>
      </button>
    </div>
  );
}

const createBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  height: 26,
  padding: '0 5px',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: TEXT,
};

function NavRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={rowStyle(active)}
      onMouseEnter={hoverOn(active)}
      onMouseLeave={hoverOff(active)}
    >
      <span style={iconCellStyle(MUTED)}>{icon}</span>
      <span style={labelStyle}>{label}</span>
      {count !== undefined && (
        <span style={{ color: COUNT, fontSize: 12, flexShrink: 0 }}>{count}</span>
      )}
    </button>
  );
}

function TeamRow({
  team,
  active,
  onClick,
}: {
  team: TeamSeed;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={rowStyle(active)}
      onMouseEnter={hoverOn(active)}
      onMouseLeave={hoverOff(active)}
    >
      <span style={iconCellStyle()}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: team.avatarBg,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {team.glyph}
        </span>
      </span>
      <span style={labelStyle}>{team.name}</span>
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function iconCellStyle(color?: string): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color,
  };
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    minHeight: 30,
    padding: '5px 8px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? TEXT : MUTED,
    background: active ? ACTIVE : 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  };
}

function hoverOn(active: boolean) {
  return (e: React.MouseEvent<HTMLElement>) => {
    if (!active) (e.currentTarget as HTMLElement).style.background = HOVER;
  };
}

function hoverOff(active: boolean) {
  return (e: React.MouseEvent<HTMLElement>) => {
    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
  };
}
