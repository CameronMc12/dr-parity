'use client';

/**
 * Bottom composer for the Chat view. A bordered card that focuses to the accent
 * colour, an auto-growing textarea (Enter sends, Shift+Enter newlines), the
 * attach / emoji / mention affordances ClickUp shows on the left, and a circular
 * send button that lights up only when there is trimmed text. Emoji inserts a
 * deterministic glyph at the caret; send/Enter bubbles the trimmed value up.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { CHAT, REACTIONS } from './chat-tokens';
import { AttachIcon, EmojiIcon, MentionIcon, SendIcon } from './chat-icons';

const ICON_COLOR = CHAT.textMuted;

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
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
        background: hover ? CHAT.hoverBg : 'transparent',
        color: ICON_COLOR,
        cursor: 'pointer',
        transition: CHAT.transition,
      }}
    >
      {children}
    </button>
  );
}

export function ChatComposer({
  channelName,
  onSend,
}: {
  channelName: string;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = draft.trim().length > 0;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
    textareaRef.current?.focus();
  };

  const insertEmoji = () => {
    const emoji = REACTIONS[(draft.length + channelName.length) % REACTIONS.length];
    setDraft((prev) => `${prev}${emoji} `);
    textareaRef.current?.focus();
  };

  const openFilePicker = () => fileInputRef.current?.click();

  // Real attach: surface the picked filename in the draft as ClickUp does when an
  // upload is queued, then clear the input so the same file can be re-picked.
  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      const names = files.map((f) => f.name).join(', ');
      setDraft((prev) => (prev ? `${prev} 📎 ${names}` : `📎 ${names}`));
    }
    event.target.value = '';
    textareaRef.current?.focus();
  };

  return (
    <div style={{ padding: '10px 16px 18px', flexShrink: 0 }}>
      <div
        style={{
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
          placeholder={`Message #${channelName}`}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            data-testid="chat-attach-input"
            onChange={onFilePicked}
            style={{ display: 'none' }}
          />
          <IconButton label="Attach a file" onClick={openFilePicker}>
            <AttachIcon />
          </IconButton>
          <IconButton label="Add emoji" onClick={insertEmoji}>
            <EmojiIcon />
          </IconButton>
          <IconButton label="Mention someone" onClick={() => setDraft((p) => `${p}@`)}>
            <MentionIcon />
          </IconButton>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            data-testid="chat-send"
            aria-label="Send message"
            onClick={submit}
            disabled={!canSend}
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: canSend ? CHAT.accent : 'var(--cu-bg-strong)',
              color: canSend ? '#fff' : CHAT.textMuted,
              cursor: canSend ? 'pointer' : 'default',
              transition: CHAT.transition,
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
