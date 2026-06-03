'use client';

/**
 * Presentational pieces of a board card, split out of `BoardCard` to keep each
 * file focused: the meta-field trigger button, the stacked assignee avatars, the
 * hover complete-circle, the hover kebab, and the double-click inline rename
 * name field. All wire to the same store actions ClickUp's card uses.
 */

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { BOARD, CARD_SIZE, type CardSize } from './tokens';

/** Inline trigger button for a meta editor — stops bubbling so the card stays closed. */
export function MetaTrigger({
  ref,
  onClick,
  children,
  color,
  testid,
  label,
}: {
  ref: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  color?: string;
  testid: string;
  label: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={ref}
      type="button"
      data-testid={testid}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 4px',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'background 90ms',
        color: color ?? BOARD.textMuted,
        background: hover ? BOARD.iconHoverBg : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

export function AssigneeStack({ task }: { task: Task }) {
  return (
    <span style={{ display: 'inline-flex' }}>
      {task.assignees.map((a, i) => (
        <span
          key={a.id}
          title={a.name}
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: a.color || '#7b68ee',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: i === 0 ? 0 : -6,
            border: `2px solid ${BOARD.cardBg}`,
          }}
        >
          {a.initials}
        </span>
      ))}
    </span>
  );
}

/** Leading complete-circle revealed on hover. */
export function CompleteCircle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const [hover, setHover] = useState(false);
  const ring = done ? BOARD.completeGreen : hover ? BOARD.completeGreen : BOARD.textMuted;
  return (
    <button
      type="button"
      data-testid="board-card-complete"
      aria-label={done ? 'Mark incomplete' : 'Mark complete'}
      aria-pressed={done}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke={ring} strokeWidth="1.8" fill={done ? BOARD.completeGreen : 'none'} />
        {(done || hover) && (
          <path d="M8 12.2l2.6 2.6L16 9" stroke={done ? '#fff' : ring} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

/** Trailing kebab revealed on hover — opens the shared task context menu. */
export function CardKebab({ onOpenMenu }: { onOpenMenu: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="board-card-kebab"
      aria-label="Task actions"
      onClick={(e) => {
        e.stopPropagation();
        onOpenMenu(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? BOARD.iconHoverBg : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: BOARD.textSecondary,
        transition: 'background 90ms',
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>
  );
}

/** Inline-rename name editor — double-click swaps the title link for an input. */
export function NameField({
  task,
  cardSize,
  done,
  onOpen,
}: {
  task: Task;
  cardSize: CardSize;
  done: boolean;
  onOpen: () => void;
}) {
  const size = CARD_SIZE[cardSize];
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.name);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== task.name) updateTask(task.id, { name: next });
    else setDraft(task.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        data-testid="board-card-name-input"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            setDraft(task.name);
            setEditing(false);
          }
        }}
        rows={1}
        style={{
          flex: 1,
          minWidth: 0,
          resize: 'none',
          fontSize: size.nameSize,
          fontWeight: 500,
          lineHeight: 1.35,
          color: BOARD.textPrimary,
          background: BOARD.bg,
          border: `1px solid ${BOARD.accent}`,
          borderRadius: 4,
          padding: '2px 4px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <a
      data-testid="board-card-name"
      data-test={`board-task__name-link__${task.name}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDraft(task.name);
        setEditing(true);
      }}
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: size.nameSize,
        fontWeight: 500,
        lineHeight: 1.35,
        color: BOARD.textPrimary,
        textDecoration: done ? 'line-through' : 'none',
        opacity: done ? 0.65 : 1,
        cursor: 'pointer',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: size.nameClamp,
        WebkitBoxOrient: 'vertical',
      }}
    >
      {task.name}
    </a>
  );
}
