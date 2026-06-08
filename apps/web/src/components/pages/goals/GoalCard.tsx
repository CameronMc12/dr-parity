'use client';

import { useState } from 'react';
import type { Goal } from '@/data/goals-seed';
import { ProgressRing } from './ProgressRing';

const PANEL_BG = 'rgb(245, 246, 248)';
const TITLE = 'rgb(54, 56, 60)';
const LINK = 'rgb(120, 123, 130)';
const DATE = 'rgb(168, 171, 178)';
const DIVIDER = 'rgb(228, 230, 234)';

/**
 * One goal tile from the Goals landing grid: centered progress ring, goal name,
 * a "N targets" link, a divider, and a footer (owner avatar / timestamp).
 * Clicking the ring nudges the percentage so the surface feels live.
 */
export function GoalCard({ goal }: { goal: Goal }) {
  const [percent, setPercent] = useState(goal.percent);

  const bumpRing = () => setPercent((p) => (p >= 100 ? 0 : Math.min(100, p + 10)));

  return (
    <div
      style={{
        width: 226,
        height: 226,
        boxSizing: 'border-box',
        background: PANEL_BG,
        borderRadius: 8,
        padding: '24px 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={bumpRing}
        aria-label={`${goal.name}, ${percent} percent`}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: '4px 0 14px',
          cursor: 'pointer',
          lineHeight: 0,
        }}
      >
        <ProgressRing percent={percent} />
      </button>

      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: TITLE,
          textAlign: 'center',
          lineHeight: '18px',
          maxWidth: 180,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {goal.name}
      </div>

      <button
        type="button"
        style={{
          marginTop: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontSize: 12,
          color: LINK,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {goal.targetCount} {goal.targetCount === 1 ? 'target' : 'targets'}
      </button>

      <div style={{ flex: 1 }} />
      <div style={{ width: '100%', height: 1, background: DIVIDER, margin: '0 0 12px' }} />

      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: goal.owner.color,
            color: 'white',
            fontSize: 11,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1.5px solid white',
            boxSizing: 'border-box',
          }}
        >
          {goal.owner.initials}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: DATE, whiteSpace: 'nowrap' }}>{goal.dateLabel}</span>
      </div>
    </div>
  );
}
