'use client';

import { MemberAvatar } from '@/components/pages/team/MemberAvatar';
import { TEAM_SEED, teamMembers, type TeamSeed } from '@/data/teams-seed';
import { T } from './teams-tokens';
import { ChevronRightIcon } from './teams-icons';

const MAX_STACK = 4;

/** Teams tab: responsive grid of team cards with an avatar stack + count. */
export function TeamsGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
        padding: 24,
      }}
    >
      {TEAM_SEED.map((team) => (
        <TeamCard key={team.id} team={team} />
      ))}
    </div>
  );
}

function TeamCard({ team }: { team: TeamSeed }) {
  const members = teamMembers(team);
  const overflow = members.length - MAX_STACK;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 18,
        background: T.appBg,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.16)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background: team.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {team.name.slice(0, 1)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.textPrimary }}>{team.name}</div>
          <div style={{ fontSize: 12.5, color: T.textMuted }}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {members.slice(0, MAX_STACK).map((m, i) => (
          <span
            key={m.id}
            style={{
              marginLeft: i === 0 ? 0 : -8,
              borderRadius: '50%',
              border: `2px solid ${T.appBg}`,
              display: 'inline-flex',
            }}
          >
            <MemberAvatar initials={m.initials} color={m.color} size={28} />
          </span>
        ))}
        {overflow > 0 && (
          <span
            style={{
              marginLeft: -8,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `2px solid ${T.appBg}`,
              background: T.hoverBg,
              color: T.textSecondary,
              fontSize: 11,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +{overflow}
          </span>
        )}
      </div>

      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          alignSelf: 'flex-start',
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: T.textSecondary,
          fontSize: 13,
          fontWeight: 600,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.textPrimary)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = T.textSecondary)}
      >
        View team
        <ChevronRightIcon size={13} />
      </button>
    </div>
  );
}
