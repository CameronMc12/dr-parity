import { BORDER, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import { ProgressRing } from './ProgressRing';
import type { Goal } from '@/data/goals-seed';

/**
 * Goal card. Oracle: square-ish card, centred progress ring + percentage, goal
 * name, underlined "<n> targets" link, then a footer with the owner avatar and
 * the relative updated timestamp.
 */
export function GoalCard({ goal }: { goal: Goal }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 226,
        height: 226,
        padding: 20,
        borderRadius: 8,
        background: 'rgb(250, 250, 250)',
        border: `1px solid ${BORDER}`,
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgb(250, 250, 250)')}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <ProgressRing progress={goal.progress} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRIMARY, lineHeight: '20px' }}>
            {goal.name}
          </div>
          <button
            style={{
              marginTop: 4,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12,
              color: TEXT_MUTED,
              textDecoration: 'underline',
            }}
          >
            {goal.targetCount} {goal.targetCount === 1 ? 'target' : 'targets'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 9999,
            background: goal.owner.color,
            color: 'white',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {goal.owner.initials}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>{goal.updatedLabel}</span>
      </div>
    </div>
  );
}
