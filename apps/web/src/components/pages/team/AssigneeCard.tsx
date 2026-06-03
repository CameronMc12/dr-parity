'use client';

/**
 * Per-assignee card, 1:1 with ClickUp's `cu-user-box`:
 *
 *   ┌ header: <name>            [+]  [≡ expand-all] ┐
 *   │ stat:   3 Not done  0 Done        (donut %)   │
 *   │         ───────── progress bar ─────────      │
 *   │ ▸ ■ TO DO (3)                                 │
 *   └ …task rows…                                   ┘
 *
 * 250px wide, 4px radius, elevation-2 shadow — only the palette is our dark
 * theme. The [+] adds a task assigned to this member; the expand-all toggle
 * flips every status group open/closed in one click.
 */

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Assignee, Task } from '@/store/workspace/types';
import { DonutRing } from './DonutRing';
import { StatusGroup } from './StatusGroup';
import type { TeamBucket } from './team-data';
import { TEAM, TEAM_CARD } from './tokens';

interface AssigneeCardProps {
  bucket: TeamBucket;
  listId: string;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function AssigneeCard({ bucket, listId, onContextMenu }: AssigneeCardProps) {
  const [allOpen, setAllOpen] = useState(false);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const assignee: Assignee | null = bucket.member;

  const addTask = () =>
    createTask({ name: 'New task', listId, assignees: assignee ? [assignee] : [] });

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
      <CardHeader
        name={bucket.name}
        allOpen={allOpen}
        onAdd={addTask}
        onToggleAll={() => setAllOpen((v) => !v)}
      />

      <StatBody notDone={bucket.notDone} done={bucket.done} pct={bucket.donePct} />

      <div style={{ maxHeight: 420, minHeight: bucket.groups.length ? undefined : 0, overflowY: 'auto' }}>
        {bucket.groups.length === 0 ? (
          <div style={{ fontSize: 12, color: TEAM.textMuted, padding: '4px 15px 12px' }}>
            No tasks
          </div>
        ) : (
          bucket.groups.map((g) => (
            <StatusGroup
              key={`${g.status}-${allOpen}`}
              group={g}
              listId={listId}
              assignee={assignee}
              defaultOpen={allOpen}
              onContextMenu={onContextMenu}
            />
          ))
        )}
      </div>
    </section>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

interface CardHeaderProps {
  name: string;
  allOpen: boolean;
  onAdd: () => void;
  onToggleAll: () => void;
}

function CardHeader({ name, allOpen, onAdd, onToggleAll }: CardHeaderProps) {
  return (
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
      <span
        title={name}
        style={{
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.1,
          color: TEAM.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
      <span style={{ flexGrow: 1, minWidth: 10 }} />
      <IconButton title="Add task" onClick={onAdd}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      </IconButton>
      <ExpandAllToggle allOpen={allOpen} onClick={onToggleAll} />
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 20,
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: hover ? TEAM.hoverBg : 'transparent',
        color: TEAM.textMuted,
        cursor: 'pointer',
        flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Collapse-all caret from the capture header: a single chevron that points down
 * when groups are open (click to collapse) and up when collapsed (click to
 * expand), matching ClickUp's `cu-user-box` header control — not a 4-bar icon.
 */
function ExpandAllToggle({ allOpen, onClick }: { allOpen: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={allOpen ? 'Collapse all' : 'Expand all'}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 20,
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: hover ? TEAM.hoverBg : 'transparent',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        color: TEAM.textMuted,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 11,
          lineHeight: 1,
          display: 'inline-flex',
          transform: allOpen ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 120ms ease',
        }}
      >
        ⌄
      </span>
    </button>
  );
}

// ── Stat body ───────────────────────────────────────────────────────────────

function StatBody({ notDone, done, pct }: { notDone: number; done: number; pct: number }) {
  return (
    <div style={{ padding: '0 15px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 22 }}>
          <Stat value={notDone} title="Not done" />
          <Stat value={done} title="Done" />
        </div>
        <DonutRing pct={pct} />
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          marginTop: 8,
          background: TEAM.track,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: TEAM.done,
            borderRadius: 2,
            transition: 'width 280ms ease',
          }}
        />
      </div>
    </div>
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
