'use client';

/**
 * A collapsible status section inside a user-box card, 1:1 with ClickUp's
 * `cu-user-box__status` row: a rotate-on-open arrow, an 11px rounded status dot,
 * the uppercase 10px status title, and a count. Hovering reveals a "+" to add a
 * task straight into this status. Toggles the task list open/closed.
 */

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Assignee, Task } from '@/store/workspace/types';
import { MemberTaskRow } from './MemberTaskRow';
import type { TeamStatusGroup } from './team-data';
import { TEAM } from './tokens';

interface StatusGroupProps {
  group: TeamStatusGroup;
  listId: string;
  /** Member to pre-assign new tasks to; null for the Unassigned card. */
  assignee: Assignee | null;
  defaultOpen?: boolean;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function StatusGroup({
  group,
  listId,
  assignee,
  defaultOpen = true,
  onContextMenu,
}: StatusGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const addInStatus = () => {
    createTask({
      name: 'New task',
      listId,
      status: group.status,
      statusColor: group.color,
      statusType: group.statusType,
      assignees: assignee ? [assignee] : [],
    });
    if (!open) setOpen(true);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '6px 15px',
          background: hover ? TEAM.hoverBg : TEAM.cardBg,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            width: 10,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
            color: TEAM.textMuted,
            fontSize: 9,
          }}
        >
          ▶
        </span>
        <span
          aria-hidden
          style={{
            width: 11,
            height: 11,
            borderRadius: 2,
            marginLeft: 5,
            flexShrink: 0,
            background: group.color,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: 0.2,
            textTransform: 'uppercase',
            color: TEAM.textSecondary,
            margin: '1px 0 0 5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {group.status}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            color: TEAM.textMuted,
            margin: '1px 0 0 5px',
          }}
        >
          ({group.tasks.length})
        </span>
        <button
          type="button"
          title="Add task in this status"
          onClick={(e) => {
            e.stopPropagation();
            addInStatus();
          }}
          style={{
            marginLeft: 'auto',
            width: 18,
            height: 18,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: TEAM.textMuted,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            opacity: hover ? 1 : 0,
            transition: 'opacity 120ms ease',
            fontFamily: 'inherit',
          }}
        >
          +
        </button>
      </div>

      {open && (
        <div style={{ paddingBottom: 4 }}>
          {group.tasks.map((t) => (
            <MemberTaskRow key={t.id} task={t} onContextMenu={onContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
}
