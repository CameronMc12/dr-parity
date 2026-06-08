'use client';

import { useState } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import type { Goal } from '@/data/goals-seed';
import { goalPercent } from './progress';
import { ProgressBar, OwnerAvatar } from './ProgressBar';
import { TargetRow } from './TargetRow';
import { ChevronIcon } from './goals-icons';

const GREEN = 'rgb(36, 174, 100)';

/**
 * A goal: a collapsible header carrying the name, owner avatar, due date, an
 * overall green progress bar and rolled-up %. Expanding reveals its targets.
 */
export function GoalRow({ goal }: { goal: Goal }) {
  const [open, setOpen] = useState(true);
  const pct = goalPercent(goal);
  const count = goal.targets.length;

  return (
    <div style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          cursor: 'pointer',
          background: 'transparent',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span
          style={{
            width: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_MUTED,
            flexShrink: 0,
          }}
        >
          <ChevronIcon open={open} size={14} />
        </span>

        <OwnerAvatar owner={goal.owner} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {goal.name}
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>
            {count} {count === 1 ? 'target' : 'targets'} · Due {goal.dueLabel}
          </div>
        </div>

        <ProgressBar progress={pct} width={140} />
        <span
          style={{
            minWidth: 38,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 600,
            color: pct >= 100 ? GREEN : TEXT_PRIMARY,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(pct)}%
        </span>
      </div>

      {open &&
        goal.targets.map((target) => (
          <TargetRow key={target.id} goalId={goal.id} target={target} />
        ))}
    </div>
  );
}
