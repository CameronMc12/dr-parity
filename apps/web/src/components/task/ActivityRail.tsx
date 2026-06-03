'use client';

import { useState } from 'react';
import type { Member } from '@/store/workspace/types';
import { AvatarChip } from './MetaEditors';
import {
  BellIcon,
  CommentIcon,
  FilterIcon,
  LinkIcon,
  PlusSmallIcon,
  SearchIcon,
} from './icons';

const RAIL_MUTED = 'var(--cu-text-muted, #7b7b7b)';

function RailIconButton({
  children,
  label,
  active,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--cu-bg-hover, #2a2a2a)' : 'transparent',
        color: active ? 'var(--cu-text-primary, #eee)' : RAIL_MUTED,
      }}
    >
      {children}
    </button>
  );
}

export interface ActivityItem {
  id: string;
  kind: 'comment' | 'event';
  authorId: string;
  text: string;
  createdAt: number;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActivityRail({
  items,
  members,
  onSubmit,
}: {
  items: ActivityItem[];
  members: Member[];
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const memberById = new Map(members.map((m) => [m.id, m]));

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
    setDraft('');
  }

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--cu-bg-app, #111)',
        borderLeft: '1px solid var(--cu-border-divider, #333)',
      }}
    >
      {/* Activity header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '16px 16px 12px',
        }}
      >
        <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--cu-text-primary, #eee)' }}>
          Activity
        </h2>
        <RailIconButton label="Search">
          <SearchIcon />
        </RailIconButton>
        <RailIconButton label="Notifications">
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <BellIcon />
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                fontSize: 9,
                color: RAIL_MUTED,
              }}
            >
              0
            </span>
          </span>
        </RailIconButton>
        <RailIconButton label="Filter">
          <FilterIcon />
        </RailIconButton>
      </header>

      {/* Activity feed */}
      <div data-testid="activity-feed" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {items.length === 0 ? (
          <div style={{ height: '100%' }} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((item) => {
              const author = memberById.get(item.authorId);
              if (item.kind === 'event') {
                return (
                  <li
                    key={item.id}
                    data-testid="activity-event"
                    style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: RAIL_MUTED }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--cu-text-secondary, #aaa)' }}>
                      {author?.name ?? 'Someone'}
                    </span>
                    <span>{item.text}</span>
                    <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtTime(item.createdAt)}</span>
                  </li>
                );
              }
              return (
                <li key={item.id} data-testid="activity-comment" style={{ display: 'flex', gap: 10 }}>
                  <AvatarChip initials={author?.initials ?? '??'} color={author?.color ?? '#595d66'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cu-text-primary, #eee)' }}>
                        {author?.name ?? 'Someone'}
                      </span>
                      <span style={{ fontSize: 11, color: RAIL_MUTED }}>{fmtTime(item.createdAt)}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--cu-text-secondary, #aaa)', whiteSpace: 'pre-wrap' }}>
                      {item.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Comment composer */}
      <div style={{ padding: 16 }}>
        <div
          style={{
            border: '1px solid var(--cu-border-divider, #333)',
            borderRadius: 10,
            background: 'var(--cu-bg-input, #222)',
            overflow: 'hidden',
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Comment"
            rows={2}
            style={{
              width: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--cu-text-primary, #eee)',
              fontFamily: 'inherit',
              fontSize: 13,
              padding: '12px 14px 6px',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px 8px',
              color: RAIL_MUTED,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--cu-bg-hover, #2a2a2a)',
              }}
            >
              <PlusSmallIcon size={14} />
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '0 6px' }}>
              <CommentIcon size={14} /> Comment
            </span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={send}
              aria-label="Send comment"
              style={{
                width: 28,
                height: 26,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: draft.trim() ? 'var(--cu-accent, #7b68ee)' : RAIL_MUTED,
              }}
            >
              <LinkIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
