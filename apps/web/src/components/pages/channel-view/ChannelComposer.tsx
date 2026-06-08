'use client';

/**
 * Channel/DM comment-bar composer matching the real ClickUp footer toolbar
 * order. Auto-growing textarea (Enter sends, Shift+Enter newlines) above a
 * toolbar row: round "+" slash-commands · divider · "Message ⌄" pill · Ask Brain
 * privately · Ask Brain in thread · attachment · mention task · assign comment ·
 * emoji · divider · record video · record voice · divider · new task · new doc ·
 * new whiteboard · (far right) Send + schedule chevron. Below: a "Shift + Return
 * to add a new line" hint with a key chip. Send persists via onSend and is
 * disabled while empty; the emoji picker inserts a glyph into the draft.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { CHAT } from '../chatview/chat-tokens';
import { AttachIcon, MentionIcon, SendIcon } from '../chatview/chat-icons';
import {
  AiAtIcon,
  AiFlowerIcon,
  CameraIcon,
  ChevronDownIcon,
  DocPlusIcon,
  EmojiFaceIcon,
  MicIcon,
  PlusToolIcon,
  TaskCheckIcon,
} from '../chat/chat-tool-icons';

const ICON_COLOR = CHAT.textMuted;

const EMOJI_PALETTE = ['👍', '🎉', '👀', '❤️', '✅', '🔥', '😂', '🙏', '😍', '🤔', '👏', '💯', '🚀', '😎', '🥳', '👋'];

function ToolButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: CHAT.radiusSm,
        background: hover || active ? CHAT.hoverBg : 'transparent',
        color: active ? CHAT.accent : ICON_COLOR,
        cursor: 'pointer',
        transition: CHAT.transition,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 18, background: CHAT.borderStrong, margin: '0 4px', flexShrink: 0 }}
    />
  );
}

function RoundPlus() {
  return (
    <span
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: `1px solid ${CHAT.borderStrong}`,
        color: ICON_COLOR,
        flexShrink: 0,
      }}
    >
      <PlusToolIcon />
    </span>
  );
}

function AssignCommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v10H9l-5 4V5Z" />
      <path d="M9.5 9.5l1.8 1.8 3.2-3.4" />
    </svg>
  );
}

function WhiteboardAddIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="13" height="10" rx="1.8" />
      <path d="M9 15v3M6.5 18h5M18 6v6M21 9h-6" />
    </svg>
  );
}

function NoopPopover({ text }: { text: string }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: 40,
        left: 0,
        zIndex: 40,
        whiteSpace: 'nowrap',
        padding: '8px 12px',
        background: CHAT.menuBg,
        border: `1px solid ${CHAT.borderStrong}`,
        borderRadius: CHAT.radiusMd,
        boxShadow: CHAT.shadowSm,
        fontSize: 12,
        color: CHAT.textSecondary,
      }}
    >
      {text}
    </div>
  );
}

function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      data-testid="chat-emoji-picker"
      role="menu"
      aria-label="Emoji picker"
      style={{
        position: 'absolute',
        bottom: 40,
        left: 0,
        zIndex: 40,
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 28px)',
        gap: 2,
        padding: 8,
        background: CHAT.menuBg,
        border: `1px solid ${CHAT.borderStrong}`,
        borderRadius: CHAT.radiusMd,
        boxShadow: CHAT.shadowSm,
      }}
    >
      {EMOJI_PALETTE.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={`Insert ${emoji}`}
          onClick={() => onPick(emoji)}
          style={{
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        background: CHAT.hoverBg,
        border: `1px solid ${CHAT.borderStrong}`,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: CHAT.textSecondary,
      }}
    >
      {children}
    </span>
  );
}

export function ChannelComposer({
  channelName,
  onSend,
}: {
  channelName: string;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [popover, setPopover] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = draft.trim().length > 0;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const focusInput = () => textareaRef.current?.focus();
  const togglePopover = (key: string) => setPopover((prev) => (prev === key ? null : key));

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    setPopover(null);
    focusInput();
  };

  const insertEmoji = (emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`);
    setPopover(null);
    focusInput();
  };

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      const names = files.map((f) => f.name).join(', ');
      setDraft((prev) => (prev ? `${prev} 📎 ${names}` : `📎 ${names}`));
    }
    event.target.value = '';
    focusInput();
  };

  return (
    <div style={{ padding: '8px 16px 12px', flexShrink: 0 }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          border: `1px solid ${focused ? CHAT.accent : CHAT.borderStrong}`,
          borderRadius: CHAT.radiusMd,
          background: CHAT.inputBg,
          padding: '8px 8px 6px 12px',
          transition: CHAT.transition,
        }}
      >
        <textarea
          ref={textareaRef}
          data-testid="chat-composer"
          value={draft}
          rows={1}
          placeholder={`Write to ${channelName}, press 'space' for AI, '/' for commands`}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: '20px',
            color: CHAT.textPrimary,
            maxHeight: 160,
          }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <input ref={fileInputRef} type="file" multiple data-testid="chat-attach-input" onChange={onFilePicked} style={{ display: 'none' }} />

          <ToolButton label="Slash commands (/)" onClick={() => togglePopover('slash')} active={popover === 'slash'}>
            <RoundPlus />
          </ToolButton>

          <ToolDivider />

          <button
            type="button"
            aria-label="Message mode"
            onClick={() => togglePopover('mode')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 26,
              padding: '0 8px',
              marginRight: 2,
              border: `1px solid ${CHAT.borderStrong}`,
              borderRadius: CHAT.radiusSm,
              background: popover === 'mode' ? CHAT.hoverBg : 'transparent',
              color: CHAT.textSecondary,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            Message
            <ChevronDownIcon />
          </button>

          <ToolButton label="Ask Brain privately" onClick={() => togglePopover('ai')} active={popover === 'ai'}>
            <AiFlowerIcon />
          </ToolButton>
          <ToolButton label="Ask Brain (replies in thread)" onClick={() => togglePopover('ai-thread')} active={popover === 'ai-thread'}>
            <AiAtIcon />
          </ToolButton>
          <ToolButton label="Attach a file" onClick={() => fileInputRef.current?.click()}>
            <AttachIcon />
          </ToolButton>
          <ToolButton
            label="Mention a task"
            onClick={() => {
              setDraft((p) => `${p}@`);
              focusInput();
            }}
          >
            <MentionIcon />
          </ToolButton>
          <ToolButton label="Assign comment" onClick={() => togglePopover('assign')} active={popover === 'assign'}>
            <AssignCommentIcon />
          </ToolButton>
          <ToolButton label="Add emoji" onClick={() => togglePopover('emoji')} active={popover === 'emoji'}>
            <EmojiFaceIcon />
          </ToolButton>

          <ToolDivider />

          <ToolButton label="Record Video Clip" onClick={() => togglePopover('video')} active={popover === 'video'}>
            <CameraIcon />
          </ToolButton>
          <ToolButton label="Record Voice Clip" onClick={() => togglePopover('mic')} active={popover === 'mic'}>
            <MicIcon />
          </ToolButton>

          <ToolDivider />

          <ToolButton label="New Task" onClick={() => togglePopover('task')} active={popover === 'task'}>
            <TaskCheckIcon />
          </ToolButton>
          <ToolButton label="New Doc" onClick={() => togglePopover('doc')} active={popover === 'doc'}>
            <DocPlusIcon />
          </ToolButton>
          <ToolButton label="New Whiteboard" onClick={() => togglePopover('wb')} active={popover === 'wb'}>
            <WhiteboardAddIcon />
          </ToolButton>

          <span style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              data-testid="chat-send"
              aria-label="Send message"
              onClick={submit}
              disabled={!canSend}
              style={{
                height: 30,
                paddingLeft: 12,
                paddingRight: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: `${CHAT.radiusSm} 0 0 ${CHAT.radiusSm}`,
                border: 'none',
                background: canSend ? CHAT.accent : 'var(--cu-bg-strong)',
                color: canSend ? '#fff' : CHAT.textMuted,
                cursor: canSend ? 'pointer' : 'default',
                fontSize: 13,
                fontWeight: 600,
                transition: CHAT.transition,
              }}
            >
              <SendIcon />
            </button>
            <button
              type="button"
              aria-label="Schedule for later"
              onClick={() => togglePopover('schedule')}
              style={{
                height: 30,
                width: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: `0 ${CHAT.radiusSm} ${CHAT.radiusSm} 0`,
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.24)',
                background: canSend ? CHAT.accent : 'var(--cu-bg-strong)',
                color: canSend ? '#fff' : CHAT.textMuted,
                cursor: 'pointer',
                transition: CHAT.transition,
              }}
            >
              <ChevronDownIcon />
            </button>
          </div>

          {popover === 'emoji' && <EmojiPicker onPick={insertEmoji} />}
          {popover === 'slash' && <NoopPopover text="Create task, doc, or clip from chat" />}
          {popover === 'mode' && <NoopPopover text="Message · Comment" />}
          {popover === 'ai' && <NoopPopover text="Ask Brain privately" />}
          {popover === 'ai-thread' && <NoopPopover text="Ask Brain — replies in thread" />}
          {popover === 'assign' && <NoopPopover text="Assign this comment" />}
          {popover === 'video' && <NoopPopover text="Video recording is unavailable in this preview" />}
          {popover === 'mic' && <NoopPopover text="Voice recording is unavailable in this preview" />}
          {popover === 'task' && <NoopPopover text="Create a task from this message" />}
          {popover === 'doc' && <NoopPopover text="Create a doc from this message" />}
          {popover === 'wb' && <NoopPopover text="Create a whiteboard from this message" />}
          {popover === 'schedule' && <NoopPopover text="Send now · Schedule send" />}
        </div>
      </div>

      <div
        data-testid="composer-hint"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px 0', fontSize: 11, color: CHAT.textMuted }}
      >
        <KeyChip>Shift + Return</KeyChip>
        to add a new line
      </div>
    </div>
  );
}
