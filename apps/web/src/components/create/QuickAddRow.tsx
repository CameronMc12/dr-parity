'use client';

import { useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useCurrentMemberId } from '@/store/workspace/hooks';
import type { Assignee } from '@/store/workspace/types';

const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';

/**
 * Inline quick-add. Type a name, press Enter → createTask in `listId` assigned
 * to the current member. Stays focused so several tasks can be added in a row.
 */
export function QuickAddRow({ listId, assignSelf = true }: { listId: string; assignSelf?: boolean }) {
  const createTask = useWorkspaceStore((s) => s.createTask);
  const myId = useCurrentMemberId();
  const members = useWorkspaceStore((s) => s.members);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function add() {
    const name = value.trim();
    if (!name) return;
    const me = members.find((m) => m.id === myId);
    const assignees: Assignee[] =
      assignSelf && me
        ? [{ id: me.id, name: me.name, initials: me.initials, color: me.color }]
        : [];
    createTask({ name, listId, assignees });
    setValue('');
    inputRef.current?.focus();
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 40,
        padding: '0 12px',
      }}
    >
      <span style={{ color: TEXT_MUTED, display: 'inline-flex', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
        onBlur={add}
        placeholder="Add Task"
        aria-label="Quick add task"
        data-testid="quick-add-input"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          fontSize: 14,
          color: TEXT_PRIMARY,
          background: 'transparent',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
