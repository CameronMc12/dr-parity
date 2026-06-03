'use client';

/**
 * Presence / collaborators popover. The header shows an overlapping avatar
 * stack; clicking opens a list of current collaborators (workspace members)
 * with online status dots. Pure presentation over the real members list.
 */

import { useRef, useState } from 'react';
import { useMembers } from '@/store/workspace/hooks';
import {
  HeaderPopover,
  MemberBubble,
  PanelHeader,
  headerTokens,
} from './primitives';

const { TEXT_MUTED, TEXT_PRIMARY } = headerTokens;

const MAX_STACK = 3;

export function PresencePopover() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const members = useMembers();

  const stack = members.slice(0, MAX_STACK);
  const overflow = members.length - stack.length;

  return (
    <>
      <button
        ref={triggerRef}
        aria-label="Collaborators"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 28,
          padding: '0 4px',
          border: 'none',
          background: hover || open ? 'var(--cu-bg-hover, #f4f4f4)' : 'transparent',
          borderRadius: 6,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 120ms ease',
        }}
      >
        {stack.map((m, i) => (
          <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -6, display: 'inline-flex' }}>
            <MemberBubble initials={m.initials} color={m.color} size={22} online ring />
          </span>
        ))}
        {overflow > 0 && (
          <span
            style={{
              marginLeft: -6,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--cu-bg-input, #ececec)',
              color: TEXT_MUTED,
              fontSize: 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--cu-bg-topbar, #fff)',
            }}
          >
            +{overflow}
          </span>
        )}
      </button>

      <HeaderPopover open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} width={260}>
        <PanelHeader title={`Collaborators · ${members.length}`} onClose={() => setOpen(false)} />
        <div style={{ padding: '8px 6px' }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6 }}
            >
              <MemberBubble initials={m.initials} color={m.color} size={28} online />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, color: TEXT_PRIMARY }}>{m.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cu-status-green, #2bc46d)' }}>
                  Online
                </span>
              </span>
            </div>
          ))}
        </div>
      </HeaderPopover>
    </>
  );
}
