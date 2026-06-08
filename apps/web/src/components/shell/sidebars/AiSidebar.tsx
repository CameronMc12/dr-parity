'use client';

import { useState } from 'react';
import { AI_THREADS, type AiThread } from '@/data/ai-seed';
import { AI_ACCENT, SparkleIcon, PlusIcon } from '@/components/pages/ai/ai-icons';

const TEXT = 'var(--cu-text-primary, rgb(32, 32, 32))';
const MUTED = 'var(--cu-text-muted, rgb(130, 130, 130))';
const HOVER = 'var(--cu-bg-hover, rgb(244, 244, 244))';
const ACTIVE = 'var(--cu-bg-active, rgb(237, 237, 240))';
const DIVIDER = 'var(--cu-border-divider, rgb(232, 232, 232))';
const ACCENT_SOFT = 'rgba(124, 77, 255, 0.10)';

const GROUPS: { id: AiThread['group']; title: string }[] = [
  { id: 'pinned', title: 'Pinned' },
  { id: 'today', title: 'Today' },
  { id: 'previous7', title: 'Previous 7 days' },
];

/**
 * ClickUp AI sidebar: a "+ New chat" button over a scrolling list of AI
 * threads grouped Pinned / Today / Previous 7 days. Selecting a thread is a
 * no-op beyond local active highlight.
 */
export function AiSidebar() {
  const [selectedId, setSelectedId] = useState<string | null>(AI_THREADS[0]?.id ?? null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--cu-font)' }}>
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <SparkleIcon size={18} />
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>AI</span>
      </div>

      {/* New chat */}
      <div style={{ padding: '0 8px 8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          style={{
            width: '100%',
            height: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            background: ACCENT_SOFT,
            border: '1px solid rgba(124, 77, 255, 0.22)',
            borderRadius: 8,
            cursor: 'pointer',
            color: AI_ACCENT,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'left',
            transition: 'background 100ms ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(124, 77, 255, 0.16)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = ACCENT_SOFT)}
        >
          <PlusIcon size={14} />
          New chat
        </button>
      </div>

      {/* Grouped threads */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {GROUPS.map(({ id, title }) => {
          const rows = AI_THREADS.filter((t) => t.group === id);
          if (rows.length === 0) return null;
          return (
            <div key={id} style={{ marginTop: 8 }}>
              <h3 style={{ margin: 0, padding: '0 8px 4px', color: MUTED, fontSize: 12, fontWeight: 600, lineHeight: '20px' }}>
                {title}
              </h3>
              {rows.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  active={thread.id === selectedId}
                  onSelect={() => setSelectedId(thread.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Credit footer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${DIVIDER}`, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <SparkleIcon size={16} />
        <span style={{ color: MUTED, fontSize: 12 }}>AI credits available</span>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onSelect,
}: {
  thread: AiThread;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        minHeight: 32,
        padding: '6px 8px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <SparkleIcon size={15} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? TEXT : MUTED,
        }}
      >
        {thread.title}
      </span>
    </button>
  );
}
