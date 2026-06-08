'use client';

import { useState } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import type { Target } from '@/data/goals-seed';
import { useGoalsStore } from './goals-ui-store';
import { targetPercent, targetValueLabel } from './progress';
import { ProgressBar } from './ProgressBar';
import { TargetGlyph, TinyCheck } from './goals-icons';

const GREEN = 'rgb(36, 174, 100)';

/**
 * One key-result row beneath a goal. Clicking the value opens an inline editor:
 *   - number / currency / task → numeric stepper for `current` (or `completed`)
 *   - boolean → toggle done / not done
 * Edits write back through the store so the goal's overall % recomputes live.
 */
export function TargetRow({ goalId, target }: { goalId: string; target: Target }) {
  const setTarget = useGoalsStore((s) => s.setTarget);
  const [editing, setEditing] = useState(false);
  const pct = targetPercent(target);

  const commit = (next: Target) => {
    setTarget(goalId, target.id, next);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px 8px 44px',
        borderTop: `1px solid ${BORDER}`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: TEXT_MUTED, display: 'flex', flexShrink: 0 }}>
        <TargetGlyph size={15} />
      </span>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: TEXT_PRIMARY,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {target.name}
      </span>

      <ProgressBar progress={pct} width={96} />

      {editing ? (
        <TargetEditor
          target={target}
          onCommit={(next) => {
            commit(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            minWidth: 108,
            textAlign: 'right',
            background: 'transparent',
            border: 'none',
            padding: '2px 4px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: pct >= 100 ? GREEN : TEXT_MUTED,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {targetValueLabel(target)}
        </button>
      )}
    </div>
  );
}

function TargetEditor({
  target,
  onCommit,
  onCancel,
}: {
  target: Target;
  onCommit: (next: Target) => void;
  onCancel: () => void;
}) {
  if (target.type === 'boolean') {
    return (
      <button
        autoFocus
        onClick={() => onCommit({ ...target, done: !target.done })}
        onBlur={onCancel}
        style={{
          minWidth: 108,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          color: target.done ? GREEN : TEXT_MUTED,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: `1.5px solid ${target.done ? GREEN : 'rgb(190,190,190)'}`,
            background: target.done ? GREEN : 'transparent',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {target.done && <TinyCheck size={11} />}
        </span>
        {target.done ? 'Done' : 'Not done'}
      </button>
    );
  }

  const value = target.type === 'task' ? target.completed : target.current;
  const max = target.type === 'task' ? target.total : target.target;

  return (
    <input
      type="number"
      autoFocus
      defaultValue={value}
      min={0}
      max={max}
      onBlur={(e) => apply(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') apply((e.target as HTMLInputElement).value);
        if (e.key === 'Escape') onCancel();
      }}
      style={{
        width: 108,
        height: 26,
        textAlign: 'right',
        padding: '0 8px',
        border: '1px solid rgb(36, 174, 100)',
        borderRadius: 6,
        outline: 'none',
        fontSize: 12,
        fontFamily: 'inherit',
        color: 'rgb(32,32,32)',
        fontVariantNumeric: 'tabular-nums',
      }}
    />
  );

  function apply(raw: string) {
    const parsed = Number(raw);
    const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : value;
    if (target.type === 'task') {
      onCommit({ ...target, completed: clamped });
    } else if (target.type === 'number' || target.type === 'currency') {
      onCommit({ ...target, current: clamped });
    }
  }
}
