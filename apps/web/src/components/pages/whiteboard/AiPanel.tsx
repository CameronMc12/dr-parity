'use client';

/**
 * Whiteboard AI assistant popover, matching ClickUp's dark AI surface. Opens
 * above the toolbar when the AI button is pressed. It is a real, observable
 * feature: typing a prompt and pressing Generate (or ⌘/Ctrl+Enter) drops one
 * sticky per non-empty line of the prompt onto the board through the supplied
 * callback, then closes. No network — purely local generation from the prompt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const PANEL_BG = 'var(--cu-bg-menu, #1f2127)';
const BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.1))';
const TEXT = 'var(--cu-text-primary, #e8eaed)';
const TEXT_MUTED = 'var(--cu-text-muted, #8a8f99)';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const ACCENT_DARK = 'var(--cu-accent-dark, #3db8b0)';
const FIELD_BG = 'var(--cu-bg-input, rgba(255,255,255,0.06))';

const SUGGESTIONS = [
  'Brainstorm launch tasks',
  'Sprint retro themes',
  'Roadmap milestones',
] as const;

function promptToLines(prompt: string): string[] {
  return prompt
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 12);
}

export function AiPanel({
  open,
  onClose,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  /** Receives one label per generated sticky; the view places them. */
  onGenerate: (labels: string[]) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt('');
    const id = window.setTimeout(() => fieldRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const submit = useCallback(() => {
    const labels = promptToLines(prompt);
    if (labels.length === 0) return;
    onGenerate(labels);
    onClose();
  }, [prompt, onGenerate, onClose]);

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      role="dialog"
      aria-label="ClickUp AI"
      aria-modal="false"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 72,
        transform: 'translateX(-50%)',
        width: 360,
        padding: 16,
        borderRadius: 14,
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill={ACCENT} aria-hidden>
          <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
        </svg>
        <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>
          ClickUp AI
        </span>
        <button
          type="button"
          aria-label="Close AI"
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            width: 26,
            height: 26,
            border: 'none',
            background: 'transparent',
            color: TEXT_MUTED,
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
            borderRadius: 6,
          }}
        >
          ×
        </button>
      </div>

      <textarea
        ref={fieldRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Describe what to add. One idea per line."
        rows={3}
        style={{
          resize: 'none',
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: FIELD_BG,
          color: TEXT,
          fontSize: 13,
          lineHeight: 1.5,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPrompt(s)}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              background: 'transparent',
              color: TEXT_MUTED,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={promptToLines(prompt).length === 0}
        style={{
          height: 36,
          borderRadius: 8,
          border: 'none',
          cursor:
            promptToLines(prompt).length === 0 ? 'not-allowed' : 'pointer',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          opacity: promptToLines(prompt).length === 0 ? 0.5 : 1,
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
        }}
      >
        Generate stickies
      </button>
    </div>
  );
}
