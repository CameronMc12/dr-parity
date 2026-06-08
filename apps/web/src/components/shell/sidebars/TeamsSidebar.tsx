'use client';

import { useState } from 'react';
import { MemberAvatar } from '@/components/pages/team/MemberAvatar';
import {
  TEAM_SEED,
  MEMBER_SEED,
  PEOPLE_COUNT,
  GUEST_COUNT,
  TEAM_COUNT,
  type TeamSeed,
} from '@/data/teams-seed';
import { UsersIcon, TeamIcon } from '@/components/pages/teams/teams-icons';
import { PlusIcon } from '@/components/pages/page-primitives';

const MEMBER_BY_ID = new Map(MEMBER_SEED.map((m) => [m.id, m]));

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const COUNT = 'var(--cu-text-disabled, rgb(160,160,160))';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';
const DIVIDER = 'var(--cu-border-divider)';

type Selection = 'all-teams' | 'all-people' | 'guests' | string;

/** Teams hub sidebar: All Teams / All People / Guests + a My Teams group. */
export function TeamsSidebar() {
  const [active, setActive] = useState<Selection>('all-people');

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
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Teams</span>
      </div>

      <div style={{ padding: '0 4px', flexShrink: 0 }}>
        <NavRow
          icon={<TeamIcon size={16} />}
          label="All Teams"
          count={TEAM_COUNT}
          active={active === 'all-teams'}
          onClick={() => setActive('all-teams')}
        />
        <NavRow
          icon={<UsersIcon size={16} />}
          label="All People"
          count={PEOPLE_COUNT}
          active={active === 'all-people'}
          onClick={() => setActive('all-people')}
        />
        <NavRow
          icon={<UsersIcon size={16} />}
          label="Guests"
          count={GUEST_COUNT}
          active={active === 'guests'}
          onClick={() => setActive('guests')}
        />
        <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 8px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 12px' }}>
        <h3 style={{ margin: 0, padding: '0 8px 4px', color: MUTED, fontSize: 12, fontWeight: 600, lineHeight: '20px' }}>
          My Teams
        </h3>
        {TEAM_SEED.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            active={active === team.id}
            onClick={() => setActive(team.id)}
          />
        ))}
        <CreateTeamRow />
      </div>
    </div>
  );
}

function NavRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={rowStyle(active)} onMouseEnter={hoverOn(active)} onMouseLeave={hoverOff(active)}>
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: MUTED }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: COUNT, fontSize: 12, flexShrink: 0 }}>{count}</span>
    </button>
  );
}

function TeamRow({ team, active, onClick }: { team: TeamSeed; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={rowStyle(active)} onMouseEnter={hoverOn(active)} onMouseLeave={hoverOff(active)}>
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: team.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {team.name.slice(0, 1)}
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
      <span style={{ display: 'flex', flexShrink: 0 }}>
        {team.memberIds.slice(0, 3).map((id, i) => {
          const m = MEMBER_BY_ID.get(id);
          if (!m) return null;
          return (
            <span key={id} style={{ marginLeft: i === 0 ? 0 : -6, display: 'inline-flex', borderRadius: '50%', border: '1.5px solid var(--cu-bg-app)' }}>
              <MemberAvatar initials={m.initials} color={m.color} size={18} />
            </span>
          );
        })}
      </span>
    </button>
  );
}

function CreateTeamRow() {
  return (
    <button type="button" style={rowStyle(false)} onMouseEnter={hoverOn(false)} onMouseLeave={hoverOff(false)}>
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: MUTED }}>
        <PlusIcon size={15} />
      </span>
      <span style={{ flex: 1 }}>Create Team</span>
    </button>
  );
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
