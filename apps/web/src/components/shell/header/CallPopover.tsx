'use client';

/**
 * Call / Huddle popover. Lists project participants (workspace members), exposes
 * a mute / video / screen-share / leave control row backed by local toggle
 * state, and a Call / Huddle / Screen-share mode caret. Visual fidelity to
 * ClickUp's huddle, fully interactive but no real media stack.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useMembers } from '@/store/workspace/hooks';
import {
  GhostButton,
  HeaderIconButton,
  HeaderPopover,
  MemberBubble,
  PanelHeader,
  PrimaryButton,
  headerTokens,
} from './primitives';
import {
  MicIcon,
  PhoneIcon,
  ScreenShareIcon,
  VideoIcon,
} from './icons';

const { TEXT_MUTED, TEXT_PRIMARY, MENU_BORDER } = headerTokens;

type CallMode = 'call' | 'huddle' | 'screen';

const MODE_LABEL: Record<CallMode, string> = {
  call: 'Call',
  huddle: 'Huddle',
  screen: 'Screen share',
};

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const bg = danger
    ? 'var(--cu-status-red, #e15f5f)'
    : active
      ? 'var(--cu-accent, #4ecdc4)'
      : hover
        ? 'var(--cu-bg-hover, #f4f4f4)'
        : 'var(--cu-bg-input, #f7f7f7)';
  const color = danger || active ? '#fff' : TEXT_PRIMARY;
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        height: 40,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: bg,
        color,
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 10,
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

export function CallPopover() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modeWrapRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const members = useMembers();

  const [inCall, setInCall] = useState(false);
  const [muted, setMuted] = useState(false);
  const [video, setVideo] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [mode, setMode] = useState<CallMode>('call');
  const [modeMenu, setModeMenu] = useState(false);

  // The mode dropdown is a bare absolutely-positioned menu, so it needs its own
  // outside-pointerdown + Escape dismissal (the parent popover handlers stop at
  // its own surface). Escape closes the dropdown before the popover.
  useEffect(() => {
    if (!modeMenu) return;
    function onDown(e: PointerEvent) {
      if (modeWrapRef.current?.contains(e.target as Node)) return;
      setModeMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setModeMenu(false);
      }
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [modeMenu]);

  const close = () => {
    setOpen(false);
    setModeMenu(false);
  };

  const start = () => setInCall(true);
  const leave = () => {
    setInCall(false);
    setMuted(false);
    setVideo(false);
    setSharing(false);
  };

  return (
    <>
      <HeaderIconButton
        ref={triggerRef}
        label="Start call"
        caret
        active={open || inCall}
        width={36}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: 'flex', color: inCall ? 'var(--cu-status-green, #2bc46d)' : 'inherit' }}>
          <PhoneIcon />
        </span>
      </HeaderIconButton>

      <HeaderPopover
        open={open}
        onClose={close}
        triggerRef={triggerRef}
        width={280}
        labelledBy={titleId}
        surfaceStyle={modeMenu ? { overflow: 'visible' } : undefined}
      >
        <PanelHeader
          title={inCall ? `${MODE_LABEL[mode]} in progress` : 'Start a call'}
          titleId={titleId}
          icon={<PhoneIcon />}
          onClose={close}
        />

        <div style={{ padding: '12px 14px' }}>
          {/* Mode caret sub-option */}
          <div ref={modeWrapRef} style={{ position: 'relative', marginBottom: 12 }}>
            <button
              onClick={() => setModeMenu((v) => !v)}
              style={{
                width: '100%',
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px',
                background: 'var(--cu-bg-input, #f7f7f7)',
                border: `1px solid var(--cu-border, ${MENU_BORDER})`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'inherit',
                color: TEXT_PRIMARY,
              }}
            >
              <span>{MODE_LABEL[mode]}</span>
              <span style={{ color: TEXT_MUTED }}>▾</span>
            </button>
            {modeMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 36,
                  left: 0,
                  right: 0,
                  background: 'var(--cu-bg-menu, #fff)',
                  border: `1px solid ${MENU_BORDER}`,
                  borderRadius: 6,
                  boxShadow: 'var(--cu-shadow-md, 0 4px 14px rgba(0,0,0,.12))',
                  padding: '4px 0',
                  zIndex: 5,
                }}
              >
                {(Object.keys(MODE_LABEL) as CallMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setModeMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      background: m === mode ? 'var(--cu-bg-hover, #f4f4f4)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Participants */}
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, fontWeight: 600, letterSpacing: 0.3 }}>
            PARTICIPANTS · {members.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {members.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MemberBubble initials={m.initials} color={m.color} size={26} online />
                <span style={{ fontSize: 13, flex: 1, color: TEXT_PRIMARY }}>{m.name}</span>
                {inCall && (
                  <span style={{ color: TEXT_MUTED, display: 'flex' }}>
                    <MicIcon size={14} off={muted && m.roleKey === 'owner'} />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Controls */}
          {inCall ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <ControlButton label="Toggle mute" active={!muted} onClick={() => setMuted((v) => !v)}>
                  <MicIcon size={16} off={muted} />
                  {muted ? 'Unmute' : 'Mute'}
                </ControlButton>
                <ControlButton label="Toggle video" active={video} onClick={() => setVideo((v) => !v)}>
                  <VideoIcon size={16} />
                  {video ? 'Stop' : 'Video'}
                </ControlButton>
                <ControlButton label="Toggle screen share" active={sharing} onClick={() => setSharing((v) => !v)}>
                  <ScreenShareIcon size={16} />
                  Share
                </ControlButton>
              </div>
              <GhostButton onClick={leave}>
                <span style={{ color: 'var(--cu-status-red, #e15f5f)', fontWeight: 600 }}>Leave call</span>
              </GhostButton>
            </>
          ) : (
            <PrimaryButton full onClick={start}>
              <PhoneIcon size={15} />
              Start {MODE_LABEL[mode].toLowerCase()}
            </PrimaryButton>
          )}
        </div>
      </HeaderPopover>
    </>
  );
}
