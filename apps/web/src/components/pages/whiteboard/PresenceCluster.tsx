'use client';

/**
 * Top-right floating cluster for the whiteboard: the current user's presence
 * avatar, a collaborators chip (count of board members), a Fullscreen toggle,
 * and a Settings gear that opens the board-settings menu (background + theme).
 * Every control is real: avatar/chip reflect real workspace members, Fullscreen
 * drives the Fullscreen API, and the settings menu mutates the board background
 * + theme passed down from the view.
 */

import { useEffect, useRef, useState } from 'react';
import { useMembers, useCurrentMemberId } from '@/store/workspace/hooks';
import type { Member } from '@/store/workspace/types';
import { BoardSettingsMenu, type BoardTheme } from './BoardSettingsMenu';
import type { BoardBackground } from './types';

export type { BoardTheme };

// Dark floating pills, matching the real ClickUp whiteboard top-right cluster
// in dark mode. All surfaces use our dark --cu-* tokens.
const PILL_BG = 'var(--cu-bg-menu, #222222)';
const BORDER = 'var(--cu-border-divider, #363636)';
const ICON = 'var(--cu-text-secondary, #aaaaaa)';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.08))';

function Avatar({ member, ring }: { member: Member; ring: boolean }) {
  return (
    <span
      title={member.name}
      aria-label={member.name}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: '#fff',
        background: member.color,
        boxShadow: ring ? '0 0 0 2px #22c55e' : 'none',
        flexShrink: 0,
      }}
    >
      {member.initials}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        color: ICON,
        background: active ? HOVER_BG : 'transparent',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = active ? HOVER_BG : 'transparent')
      }
    >
      {children}
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {active ? (
        <path d="M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

export function PresenceCluster({
  background,
  theme,
  onBackground,
  onTheme,
  fullscreenTarget,
}: {
  background: BoardBackground;
  theme: BoardTheme;
  onBackground: (v: BoardBackground) => void;
  onTheme: (t: BoardTheme) => void;
  fullscreenTarget: React.RefObject<HTMLElement | null>;
}) {
  const members = useMembers();
  const currentId = useCurrentMemberId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const me = members.find((m) => m.id === currentId) ?? members[0] ?? null;
  const others = members.filter((m) => m.id !== me?.id);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const toggleFullscreen = () => {
    const el = fullscreenTarget.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen().catch(() => undefined);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        top: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 20,
      }}
    >
      {me ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 4,
            borderRadius: 999,
            background: PILL_BG,
            border: `1px solid ${BORDER}`,
            boxShadow: 'var(--cu-shadow-md, 0 4px 12px rgba(0,0,0,0.55))',
          }}
        >
          <Avatar member={me} ring />
          {others.length > 0 ? (
            <span
              title={`${others.length} collaborator${others.length === 1 ? '' : 's'}`}
              aria-label={`${others.length} collaborators`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 28,
                padding: '0 10px 0 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: ICON,
                background: HOVER_BG,
              }}
            >
              +{others.length}
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: 4,
          borderRadius: 12,
          background: PILL_BG,
          border: `1px solid ${BORDER}`,
          boxShadow: 'var(--cu-shadow-md, 0 4px 12px rgba(0,0,0,0.55))',
        }}
      >
        <IconButton
          label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={toggleFullscreen}
          active={isFullscreen}
        >
          <FullscreenIcon active={isFullscreen} />
        </IconButton>
        <IconButton
          label="Board settings"
          onClick={() => setSettingsOpen((o) => !o)}
          active={settingsOpen}
        >
          <GearIcon />
        </IconButton>
        {settingsOpen ? (
          <BoardSettingsMenu
            background={background}
            theme={theme}
            onBackground={onBackground}
            onTheme={onTheme}
          />
        ) : null}
      </div>
    </div>
  );
}
