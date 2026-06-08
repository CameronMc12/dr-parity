'use client';

/**
 * Full ClickUp chat composer. A bordered card with an auto-growing textarea
 * (Enter sends, Shift+Enter newlines) above a toolbar row matching ClickUp:
 * + add, AI sparkle, attach, @ mention, emoji, video, mic — then a Send button
 * with a ⌄ dropdown. Typing + Enter / Send is the priority path: it bubbles the
 * trimmed value up to the caller's send action and persists. The emoji button
 * opens a small picker that inserts a glyph into the draft. Every other toolbar
 * icon is clickable and never crashes (no-op or tiny placeholder popover).
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
  ImagePlusIcon,
  MentionBoxIcon,
  MicIcon,
  PlusToolIcon,
  TaskCheckIcon,
} from './chat-tool-icons';

const ICON_COLOR = CHAT.textMuted;

const EMOJI_PALETTE = [
  '👍', '🎉', '👀', '❤️', '✅', '🔥', '😂', '🙏',
  '😍', '🤔', '👏', '💯', '🚀', '😎', '🥳', '👋',
];

function ToolButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  active?: boolean;
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
      }}
    >
      {children}
    </button>
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
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = CHAT.hoverBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Tiny no-op popover so non-core tools are clickable without crashing. */
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

export function ChatThreadComposer({
  placeholder,
  onSend,
  showMessagePill = false,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  /** Channel/DM threads show a "Message ⌄" mode pill after the + button. */
  showMessagePill?: boolean;
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

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    setPopover(null);
    focusInput();
  };

  const togglePopover = (key: string) => {
    setPopover((prev) => (prev === key ? null : key));
  };

  const insertEmoji = (emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`);
    setPopover(null);
    focusInput();
  };

  const openFilePicker = () => {
    setPopover(null);
    fileInputRef.current?.click();
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
    <div style={{ padding: '10px 16px 18px', flexShrink: 0 }}>
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
          placeholder={placeholder}
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            data-testid="chat-attach-input"
            onChange={onFilePicked}
            style={{ display: 'none' }}
          />

          <ToolButton label="Add" onClick={() => togglePopover('add')} active={popover === 'add'}>
            <PlusToolIcon />
          </ToolButton>

          {showMessagePill && (
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
          )}

          <ToolButton label="Ask AI" onClick={() => togglePopover('ai')} active={popover === 'ai'}>
            <AiFlowerIcon />
          </ToolButton>
          <ToolButton label="Ask AI mention" onClick={() => togglePopover('ai-at')} active={popover === 'ai-at'}>
            <AiAtIcon />
          </ToolButton>
          <ToolButton label="Attach a file" onClick={openFilePicker}>
            <AttachIcon />
          </ToolButton>
          <ToolButton
            label="Mention someone"
            onClick={() => {
              setDraft((p) => `${p}@`);
              focusInput();
            }}
          >
            <MentionIcon />
          </ToolButton>
          <ToolButton label="Mention box" onClick={() => togglePopover('mention-box')} active={popover === 'mention-box'}>
            <MentionBoxIcon />
          </ToolButton>
          <ToolButton
            label="Add emoji"
            onClick={() => togglePopover('emoji')}
            active={popover === 'emoji'}
          >
            <EmojiFaceIcon />
          </ToolButton>
          <ToolButton label="Record video" onClick={() => togglePopover('video')} active={popover === 'video'}>
            <CameraIcon />
          </ToolButton>
          <ToolButton label="Record audio" onClick={() => togglePopover('mic')} active={popover === 'mic'}>
            <MicIcon />
          </ToolButton>

          <span
            aria-hidden="true"
            style={{ width: 1, height: 18, background: CHAT.borderStrong, margin: '0 4px', flexShrink: 0 }}
          />

          <ToolButton label="Create task from message" onClick={() => togglePopover('task')} active={popover === 'task'}>
            <TaskCheckIcon />
          </ToolButton>
          <ToolButton label="Create doc from message" onClick={() => togglePopover('doc')} active={popover === 'doc'}>
            <DocPlusIcon />
          </ToolButton>
          <ToolButton label="Add image to message" onClick={() => togglePopover('image')} active={popover === 'image'}>
            <ImagePlusIcon />
          </ToolButton>

          <span style={{ flex: 1 }} />

          {/* Send + ⌄ split button */}
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
              aria-label="Send options"
              onClick={() => togglePopover('send')}
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
          {popover === 'add' && <NoopPopover text="Create task, doc, or clip from chat" />}
          {popover === 'mode' && <NoopPopover text="Message · Comment" />}
          {popover === 'ai' && <NoopPopover text="Ask AI to draft a reply" />}
          {popover === 'ai-at' && <NoopPopover text="Mention AI in this message" />}
          {popover === 'mention-box' && <NoopPopover text="Insert a mention" />}
          {popover === 'video' && <NoopPopover text="Video recording is unavailable in this preview" />}
          {popover === 'mic' && <NoopPopover text="Voice recording is unavailable in this preview" />}
          {popover === 'task' && <NoopPopover text="Create a task from this message" />}
          {popover === 'doc' && <NoopPopover text="Create a doc from this message" />}
          {popover === 'image' && <NoopPopover text="Add an image" />}
          {popover === 'send' && <NoopPopover text="Send now · Schedule send" />}
        </div>
      </div>
    </div>
  );
}
