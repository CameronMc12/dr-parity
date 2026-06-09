'use client';

import { TEAM_SEED, type TeamSeed } from '@/data/teams-seed';
import { T, CARD } from './teams-tokens';

/** "All Teams" gallery: virtualization-style auto-fill grid of team cards. */
export function TeamsGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${CARD.minWidth}px, 1fr))`,
        gap: 12,
        padding: 12,
        alignContent: 'start',
      }}
    >
      {TEAM_SEED.map((team) => (
        <TeamGalleryCard key={team.id} team={team} />
      ))}
    </div>
  );
}

function TeamGalleryCard({ team }: { team: TeamSeed }) {
  return (
    <div
      tabIndex={0}
      style={{
        maxWidth: CARD.maxWidth,
        height: CARD.height,
        display: 'flex',
        flexDirection: 'column',
        background: T.cardBg,
        border: `1px solid ${T.border}`,
        borderRadius: CARD.radius,
        overflow: 'hidden',
        cursor: 'pointer',
        outline: 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.28)';
        e.currentTarget.style.borderColor = 'var(--cu-border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      <Cover team={team} />
      <Content team={team} />
    </div>
  );
}

/** Faint preview header with two skeleton lines + overlapping square avatar. */
function Cover({ team }: { team: TeamSeed }) {
  return (
    <div
      style={{
        position: 'relative',
        height: CARD.coverHeight,
        background: team.coverBg,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 26,
          left: 24,
          right: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        <span style={{ height: 9, width: '46%', borderRadius: 4, background: T.skeleton }} />
        <span style={{ height: 9, width: '78%', borderRadius: 4, background: T.skeleton }} />
      </div>

      <span
        style={{
          position: 'absolute',
          left: 14,
          bottom: -16,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: team.avatarBg,
          border: `2px solid ${T.cardBg}`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          boxSizing: 'border-box',
        }}
      >
        {team.glyph}
      </span>
    </div>
  );
}

/** Name + member count on the left, owner avatar on the right. */
function Content({ team }: { team: TeamSeed }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 14px 14px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: T.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {team.name}
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
          {team.memberCount} members
        </div>
      </div>

      <span
        aria-label={team.owner.name}
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: team.owner.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10.5,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {team.owner.initials}
      </span>
    </div>
  );
}
