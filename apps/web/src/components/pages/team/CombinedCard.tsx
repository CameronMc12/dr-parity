'use client';

/**
 * Combined card — the "Separate: off" state. Pools every assignee's tasks into a
 * single user-box, grouped by status. Same `cu-user-box` anatomy as AssigneeCard
 * (name header + [+] + expand-all, Not done / Done stats + donut + progress bar,
 * then status groups) but summarising the whole list. Header [+] adds a task to
 * the list; right-click / double-click on rows behave exactly as the per-member
 * cards.
 */

import { useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { DonutRing } from './DonutRing';
import { StatusGroup } from './StatusGroup';
import { combinedGroups, isTaskDone, type TeamBucket } from './team-data';
import { TEAM, TEAM_CARD } from './tokens';

interface CombinedCardProps {
  buckets: TeamBucket[];
  listId: string;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function CombinedCard({ buckets, listId, onContextMenu }: CombinedCardProps) {
  const [allOpen, setAllOpen] = useState(true);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const { groups, done, notDone, donePct } = useMemo(() => {
    const merged = combinedGroups(buckets);
    let total = 0;
    let doneCount = 0;
    for (const g of merged) {
      total += g.tasks.length;
      for (const t of g.tasks) if (isTaskDone(t)) doneCount += 1;
    }
    return {
      groups: merged,
      done: doneCount,
      notDone: total - doneCount,
      donePct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    };
  }, [buckets]);

  return (
    <section
      style={{
        width: TEAM_CARD.width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: TEAM.cardBg,
        borderRadius: TEAM_CARD.radius,
        boxShadow: TEAM_CARD.shadow,
        margin: `0 ${TEAM_CARD.gutter}px ${TEAM_CARD.gutter}px 0`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 33,
          padding: '0 15px 5px',
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.1, color: TEAM.textPrimary }}>
          All assignees
        </span>
        <span style={{ flexGrow: 1, minWidth: 10 }} />
        <button
          type="button"
          title="Add task"
          onClick={() => createTask({ name: 'New task', listId })}
          style={{
            width: 20,
            height: 20,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: TEAM.textMuted,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
        >
          +
        </button>
        <button
          type="button"
          title={allOpen ? 'Collapse all' : 'Expand all'}
          onClick={() => setAllOpen((v) => !v)}
          style={{
            width: 14,
            height: 13,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
            opacity: 0.7,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} aria-hidden style={{ height: 2, borderRadius: 1, background: TEAM.textMuted }} />
          ))}
        </button>
      </div>

      <div style={{ padding: '0 15px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 22 }}>
            <Stat value={notDone} title="Not done" />
            <Stat value={done} title="Done" />
          </div>
          <DonutRing pct={donePct} />
        </div>
        <div style={{ height: 4, borderRadius: 2, marginTop: 8, background: TEAM.track, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${donePct}%`,
              background: TEAM.done,
              borderRadius: 2,
              transition: 'width 280ms ease',
            }}
          />
        </div>
      </div>

      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <div style={{ fontSize: 12, color: TEAM.textMuted, padding: '4px 15px 12px' }}>
            No tasks
          </div>
        ) : (
          groups.map((g) => (
            <StatusGroup
              key={`${g.status}-${allOpen}`}
              group={g}
              listId={listId}
              assignee={null}
              defaultOpen={allOpen}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Stat({ value, title }: { value: number; title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, fontWeight: 400, lineHeight: 1, color: TEAM.textPrimary, marginBottom: 5 }}>
        {value}
      </span>
      <span style={{ fontSize: 10, fontWeight: 400, lineHeight: 1, color: TEAM.textMuted }}>
        {title}
      </span>
    </div>
  );
}
