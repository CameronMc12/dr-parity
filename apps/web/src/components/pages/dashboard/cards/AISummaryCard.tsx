'use client';

/**
 * AISummaryCard — the "AI Executive Summary" card. A sparkle mark plus an
 * "Executive Summary" heading over the deterministic executiveSummary() rollup,
 * then a "Key Efforts & Initiatives" section listing the most material open
 * tasks with inline status pills. All text references real task names, statuses,
 * counts, and the earliest creation date — no lorem.
 */

import { useMemo, useState } from 'react';
import { useViewCrumbs } from '@/components/views/useViewCrumbs';
import { useUiStore } from '@/store/ui-store';
import type { Task } from '@/store/workspace/types';
import {
  COMPLETE,
  executiveSummary,
  useDashboardMetrics,
} from '../dashboard-data';
import { DASH } from '../tokens';
import type { CardRenderProps } from './card-props';

function useListName(listId: string): string {
  const crumbs = useViewCrumbs(listId, 'Dashboard');
  return crumbs[crumbs.length - 1]?.label ?? 'This list';
}

/**
 * Pick the tasks worth calling out: open work first (in progress before not
 * started), then the rest, capped to keep the card scannable. Deterministic —
 * sorts by completion bucket then by name.
 */
function keyEfforts(tasks: Task[], limit = 6): Task[] {
  const weight = (t: Task): number => {
    if (t.statusType === 'custom') return 0; // in progress
    if (COMPLETE.has(t.statusType)) return 2; // done
    return 1; // not started
  };
  const seen = new Set<string>();
  const unique = tasks.filter((t) => (seen.has(t.id) ? false : seen.add(t.id)));
  return unique
    .sort((a, b) => weight(a) - weight(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function StatusPill({ task }: { task: Task }) {
  const color = task.statusColor || DASH.textMuted;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 32%, transparent)`,
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
      />
      {task.status}
    </span>
  );
}

function EffortRow({ task, onOpen }: { task: Task; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onOpen(task.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        width: '100%',
        padding: '7px 10px',
        border: `1px solid ${DASH.border}`,
        borderRadius: DASH.radiusSm,
        background: hover ? DASH.cardHoverBg : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: DASH.textPrimary,
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.name}
      </span>
      <StatusPill task={task} />
    </button>
  );
}

export function AISummaryCard({ listId }: CardRenderProps) {
  const listName = useListName(listId);
  const { tasks, members } = useDashboardMetrics(listId);
  const openTask = useUiStore((s) => s.openTask);

  const summary = useMemo(
    () => executiveSummary(tasks, members, listName),
    [tasks, members, listName],
  );
  const efforts = useMemo(() => keyEfforts(tasks), [tasks]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '6px 18px 10px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: DASH.accentSubtle,
            color: DASH.accent,
            fontSize: 16,
          }}
        >
          ✦
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '2px 0 6px',
              fontSize: 13,
              fontWeight: 600,
              color: DASH.textPrimary,
              letterSpacing: '0.01em',
            }}
          >
            Executive Summary
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.55,
              color: DASH.textSecondary,
              maxWidth: '72ch',
            }}
          >
            {summary}
          </p>
        </div>
      </div>

      {efforts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: DASH.textMuted,
            }}
          >
            Key Efforts &amp; Initiatives
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {efforts.map((t) => (
              <EffortRow key={t.id} task={t} onOpen={openTask} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
