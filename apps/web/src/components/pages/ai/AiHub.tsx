'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { PageSurface, TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY, BORDER, HOVER_BG } from '../page-primitives';
import {
  AI_ACCENT,
  SparkleIcon,
  ArrowUpIcon,
  QuickActionGlyph,
  SuggestionGlyph,
} from './ai-icons';
import {
  AI_GREETING,
  AI_QUICK_ACTIONS,
  AI_SUGGESTIONS,
  AI_THREADS,
  type AiThread,
} from '@/data/ai-seed';

const ACCENT_SOFT = 'rgba(124, 77, 255, 0.08)';

/** A locally-created thread from typing a prompt. Newest first in Recent. */
type LocalThread = Pick<AiThread, 'id' | 'title' | 'snippet' | 'timestamp'>;

/**
 * AI hub: /<wsId>/ai. ClickUp Brain landing — centered greeting, "Ask or find
 * anything" prompt, quick-action chips, suggestion cards, and a live Recent
 * list that grows as the user submits prompts (purely local state).
 */
export function AiHub() {
  const [prompt, setPrompt] = useState('');
  const [threads, setThreads] = useState<LocalThread[]>([]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setThreads((prev) => [
      {
        id: `local-${Date.now()}`,
        title: trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed,
        snippet: 'Drafting a response…',
        timestamp: 'Just now',
      },
      ...prev,
    ]);
    setPrompt('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(prompt);
  };

  const recents: LocalThread[] = [
    ...threads,
    ...AI_THREADS.filter((t) => t.group !== 'pinned').map((t) => ({
      id: t.id,
      title: t.title,
      snippet: t.snippet,
      timestamp: t.timestamp,
    })),
  ];

  return (
    <PageSurface>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '56px 24px 64px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Hero */}
          <span style={{ display: 'flex' }}>
            <SparkleIcon size={34} />
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: TEXT_PRIMARY, margin: '14px 0 0', textAlign: 'center' }}>
            {AI_GREETING}
          </h1>
          <p style={{ fontSize: 15, color: TEXT_MUTED, margin: '6px 0 28px', textAlign: 'center' }}>
            Ask Brain to summarize work, draft updates, and generate tasks.
          </p>

          {/* Prompt input */}
          <PromptInput value={prompt} onChange={setPrompt} onSubmit={onSubmit} />

          {/* Quick-action chips */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 16,
            }}
          >
            {AI_QUICK_ACTIONS.map((action) => (
              <QuickChip key={action.id} label={action.label} onClick={() => setPrompt(`${action.label}: `)}>
                <span style={{ color: AI_ACCENT, display: 'flex' }}>
                  <QuickActionGlyph glyph={action.glyph} />
                </span>
              </QuickChip>
            ))}
          </div>

          {/* Suggestion cards */}
          <div
            style={{
              width: '100%',
              marginTop: 40,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))',
              gap: 12,
            }}
          >
            {AI_SUGGESTIONS.map((s) => (
              <SuggestionCard
                key={s.id}
                title={s.title}
                description={s.description}
                onClick={() => submit(s.title)}
              >
                <SuggestionGlyph glyph={s.glyph} />
              </SuggestionCard>
            ))}
          </div>

          {/* Recent */}
          <div style={{ width: '100%', marginTop: 44 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: TEXT_MUTED, margin: '0 0 8px', letterSpacing: 0.2 }}>
              Recent
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recents.map((t) => (
                <RecentRow key={t.id} thread={t} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageSurface>
  );
}

function PromptInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <form
      onSubmit={onSubmit}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 56,
        padding: '0 8px 0 16px',
        background: 'var(--cu-bg-app, rgb(255, 255, 255))',
        border: `1.5px solid ${focused ? AI_ACCENT : BORDER}`,
        borderRadius: 28,
        boxShadow: focused ? '0 0 0 4px rgba(124, 77, 255, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>
        <SparkleIcon size={20} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask or find anything…"
        aria-label="Ask AI"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: TEXT_PRIMARY,
          fontSize: 15,
          fontFamily: 'inherit',
        }}
      />
      <button
        type="submit"
        aria-label="Submit prompt"
        disabled={!value.trim()}
        style={{
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: value.trim() ? AI_ACCENT : 'var(--cu-bg-hover, rgb(238, 238, 238))',
          color: value.trim() ? '#fff' : TEXT_MUTED,
          border: 'none',
          borderRadius: '50%',
          cursor: value.trim() ? 'pointer' : 'default',
          transition: 'background 120ms ease, transform 120ms ease',
        }}
        onMouseEnter={(e) => {
          if (value.trim()) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        <ArrowUpIcon size={18} />
      </button>
    </form>
  );
}

function QuickChip({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 34,
        padding: '0 14px',
        background: 'var(--cu-bg-app, rgb(255, 255, 255))',
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        transition: 'background 100ms ease, border-color 100ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = ACCENT_SOFT;
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124, 77, 255, 0.35)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-app, rgb(255, 255, 255))';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--cu-border-divider, rgb(232, 232, 232))';
      }}
    >
      {children}
      {label}
    </button>
  );
}

function SuggestionCard({
  title,
  description,
  children,
  onClick,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const base: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    background: 'var(--cu-bg-app, rgb(255, 255, 255))',
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={base}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
        el.style.borderColor = 'rgba(124, 77, 255, 0.35)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = 'none';
        el.style.borderColor = 'var(--cu-border-divider, rgb(232, 232, 232))';
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: ACCENT_SOFT,
          color: AI_ACCENT,
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{title}</span>
      <span style={{ fontSize: 12.5, lineHeight: '17px', color: TEXT_MUTED }}>{description}</span>
    </button>
  );
}

function RecentRow({ thread }: { thread: LocalThread }) {
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER_BG)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      <span
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: ACCENT_SOFT,
          flexShrink: 0,
        }}
      >
        <SparkleIcon size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {thread.title}
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: TEXT_MUTED,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {thread.snippet}
        </span>
      </span>
      <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>{thread.timestamp}</span>
    </button>
  );
}
