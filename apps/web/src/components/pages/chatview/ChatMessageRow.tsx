'use client';

/**
 * A single grouped message block. The first message in a run renders the full
 * header (avatar + author + timestamp); consecutive messages from the same author
 * collapse into a tight stacked line with the timestamp revealed on hover, exactly
 * like ClickUp Chat. Hovering surfaces a quick-reaction bar; existing reactions
 * render as toggle chips. The whole row carries the shared task context menu when
 * it references a real task.
 */

import { memo, useState } from 'react';
import type { Member, Task } from '@/store/workspace/types';
import { CHAT, REACTIONS } from './chat-tokens';
import type { ChatMessage } from './chat-messages';
import { timeLabel } from './chat-messages';

function Avatar({ member }: { member?: Member }) {
  const initials = member?.initials ?? '?';
  const color = member?.color ?? 'var(--cu-accent)';
  return (
    <span
      style={{
        width: CHAT.avatarSize,
        height: CHAT.avatarSize,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
}

function ReactionChip({
  emoji,
  count,
  onClick,
}: {
  emoji: string;
  count: number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 8px',
        borderRadius: 11,
        border: `1px solid ${hover ? CHAT.accent : CHAT.border}`,
        background: hover ? CHAT.accentSubtle : CHAT.inputBg,
        color: CHAT.textSecondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: CHAT.transition,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      {count > 0 ? count : null}
    </button>
  );
}

function HoverActions({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: -14,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: CHAT.radiusMd,
        background: CHAT.menuBg,
        border: `1px solid ${CHAT.border}`,
        boxShadow: CHAT.shadowSm,
      }}
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          style={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            borderRadius: CHAT.radiusSm,
            fontSize: 15,
            cursor: 'pointer',
            transition: CHAT.transition,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = CHAT.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export interface ChatMessageRowProps {
  message: ChatMessage;
  author?: Member;
  /** True when the previous message shares this author within the time window. */
  grouped: boolean;
  /** The task this message references, if any — drives click + context menu. */
  task?: Task;
  onReact: (messageId: string, emoji: string) => void;
  onOpenTask?: (taskId: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
}

function ChatMessageRowImpl({
  message,
  author,
  grouped,
  task,
  onReact,
  onOpenTask,
  onContextMenu,
}: ChatMessageRowProps) {
  const [hover, setHover] = useState(false);
  const reactionEntries = Object.entries(message.reactions);
  const clickable = Boolean(task && onOpenTask);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={task && onContextMenu ? (e) => onContextMenu(e, task) : undefined}
      onClick={clickable ? () => onOpenTask?.(task!.id) : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 12,
        padding: grouped ? '2px 16px 2px 16px' : '8px 16px 2px 16px',
        background: hover ? CHAT.hoverBg : 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        transition: CHAT.transition,
      }}
    >
      <div style={{ width: CHAT.avatarSize, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        {grouped ? (
          <span
            style={{
              fontSize: 10,
              color: CHAT.textMuted,
              lineHeight: '20px',
              opacity: hover ? 1 : 0,
              transition: CHAT.transition,
            }}
          >
            {timeLabel(message.createdAt)}
          </span>
        ) : (
          <Avatar member={author} />
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        {!grouped && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: CHAT.textPrimary }}>
              {author?.name ?? 'Member'}
            </span>
            <span style={{ fontSize: 11, color: CHAT.textMuted }}>
              {timeLabel(message.createdAt)}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            lineHeight: '20px',
            color: message.system ? CHAT.textMuted : CHAT.textPrimary,
            fontStyle: message.system ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.system && author ? `${author.name} ` : ''}
          {message.text}
        </div>

        {reactionEntries.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {reactionEntries.map(([emoji, count]) => (
              <ReactionChip
                key={emoji}
                emoji={emoji}
                count={count}
                onClick={() => onReact(message.id, emoji)}
              />
            ))}
          </div>
        )}
      </div>

      {hover && <HoverActions onReact={(emoji) => onReact(message.id, emoji)} />}
    </div>
  );
}

/**
 * Memoized so a single reaction or send only re-renders the affected row. Rows
 * whose `message` reference is unchanged (the stable seed objects) skip render
 * even as sibling rows update. Default shallow prop comparison is correct here:
 * an overridden message gets a fresh object, an unchanged one keeps its ref.
 */
export const ChatMessageRow = memo(ChatMessageRowImpl);
