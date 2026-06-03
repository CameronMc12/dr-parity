'use client';

/**
 * One task row inside a user-box status group: status circle + name. Single
 * click opens the task modal; double-click enters inline rename (commits on
 * Enter / blur, cancels on Escape); right-click opens the shared context menu.
 * Indented to align under the 15px-padded status row.
 */

import { useRef, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { StatusRing } from './StatusRing';
import { TEAM } from './tokens';

interface MemberTaskRowProps {
  task: Task;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
}

export function MemberTaskRow({ task, onContextMenu }: MemberTaskRowProps) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const draft = useRef(task.name);
  const openTask = useUiStore((s) => s.openTask);
  const updateTask = useWorkspaceStore((s) => s.updateTask);

  const commit = () => {
    const next = draft.current.trim();
    if (next && next !== task.name) updateTask(task.id, { name: next });
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      title={task.name}
      data-task-id={task.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (!editing) openTask(task.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        draft.current = task.name;
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openTask(task.id);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, task)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        padding: '0 15px 0 30px',
        background: hover ? TEAM.hoverBg : 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms',
        userSelect: 'none',
      }}
    >
      <StatusRing task={task} />
      {editing ? (
        <input
          autoFocus
          defaultValue={task.name}
          onChange={(e) => {
            draft.current = e.target.value;
          }}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
            e.stopPropagation();
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: 22,
            padding: '0 4px',
            border: `1px solid ${TEAM.accent}`,
            borderRadius: 4,
            background: TEAM.bg,
            color: TEAM.textPrimary,
            fontSize: 13,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      ) : (
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 400,
            color: TEAM.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {task.name}
        </span>
      )}
    </div>
  );
}
