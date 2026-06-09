'use client';

/**
 * Brain / Max — the right-docked AI assistant panel. A fixed-width column that
 * lives inside the AppShell flex row (it shrinks the main content, it does NOT
 * overlay). Mirrors ClickUp's content-assistant: a header bar (new-chat ·
 * history · "Max" title with the Brain flower · overflow · collapse), a welcome
 * body (greeting + suggestion rows + feature cards), and a pinned composer
 * (+ · globe · scope chip · send). Sending a message switches the body to a
 * lightweight local chat transcript with a canned reply. No backend.
 *
 * Theme: every surface colour is centralised in `panelTokens` below and points
 * at a design-system `var(--cu-*)` token, so the panel follows the active theme
 * automatically (dark now under [data-theme="dark"], light if flipped back).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useRecentTasks } from '@/store/workspace/hooks';
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CollapseRightIcon,
  DuplicateTileIcon,
  EllipsisIcon,
  FlowerBrandIcon,
  GlobeIcon,
  HistoryIcon,
  MaxOrbIcon,
  PencilNewIcon,
  PlusIcon,
  SendArrowIcon,
  SpaceIcon,
  StuckTileIcon,
  SummaryTileIcon,
  UpdateTileIcon,
} from './icons';

const panelTokens = {
  PANEL_BG: 'var(--cu-bg-app)',
  SURFACE: 'var(--cu-bg-menu)',
  BORDER: 'var(--cu-border-divider)',
  TEXT_PRIMARY: 'var(--cu-text-primary)',
  TEXT_MUTED: 'var(--cu-text-muted)',
  TEXT_FAINT: 'var(--cu-text-disabled)',
  HOVER_BG: 'var(--cu-bg-hover)',
  INPUT_BG: 'var(--cu-bg-input)',
  ACCENT: 'var(--cu-accent)',
  ON_ACCENT: 'var(--cu-bg-app)',
  SEND_DISABLED: 'var(--cu-border-strong)',
};

const {
  PANEL_BG,
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_FAINT,
  HOVER_BG,
  INPUT_BG,
  ACCENT,
  ON_ACCENT,
  SEND_DISABLED,
} = panelTokens;

// Figma-spec literals (the panel is a 1:1 emulation of ClickUp's Max panel and
// these exact values are part of the reference, not theme-driven).
const PANEL_WIDTH = 418;
const CARD_BG = '#1e2024';
const CARD_BORDER = '#2a2a2a';
const CARD_BORDER_HOVER = '#3a3a3a';
const ROW_HOVER = 'rgba(255,255,255,0.07)';
const BADGE_BG = '#5842c8';
const BADGE_FG = '#cfc7ff';
const DIVIDER = '#3a3a3a';
const GLOW_BLUE = '#3e63dd';
const GLOW_ORANGE = '#f76808';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

interface Feature {
  key: string;
  title: string;
  description: string;
  tint: string;
  fg: string;
  Icon: (props: { size?: number }) => React.ReactElement;
}

const FEATURES: Feature[] = [
  {
    key: 'executive-summary',
    title: 'Executive Summary',
    description: 'Choose from 25+ reporting tools.',
    tint: 'rgba(62,99,221,0.18)',
    fg: '#6f93ff',
    Icon: SummaryTileIcon,
  },
  {
    key: 'project-update',
    title: 'Project Update',
    description: 'Time-based project status update.',
    tint: 'rgba(255,255,255,0.06)',
    fg: '#c4c4c4',
    Icon: UpdateTileIcon,
  },
  {
    key: 'find-duplicate-tasks',
    title: 'Find duplicate tasks',
    description: 'Identify and merge duplicate tasks hassle-free.',
    tint: 'rgba(56,178,118,0.18)',
    fg: '#4cc38a',
    Icon: DuplicateTileIcon,
  },
  {
    key: 'find-tasks-stuck',
    title: 'Find tasks that are stuck',
    description: 'Quickly locate and resolve stagnant tasks.',
    tint: 'rgba(247,104,8,0.20)',
    fg: '#f79009',
    Icon: StuckTileIcon,
  },
];

const STATIC_SUGGESTIONS = [
  'When was Task 1 created in ClickUp?',
  'What project is Task 1 associated with in Team Space',
  "What steps are included in the task 'Set up Your ClickUp'?",
];

/** Build a couple of context-aware suggestions from real recent tasks. */
function useSuggestions(): string[] {
  const recent = useRecentTasks(2);
  return useMemo(() => {
    const dynamic = recent
      .map((t) => t.name.trim())
      .filter(Boolean)
      .map((name) => `When was “${name}” created in ClickUp?`);
    return [...dynamic, ...STATIC_SUGGESTIONS].slice(0, 3);
  }, [recent]);
}

function greetingFor(scope: string | null): string {
  if (scope) {
    return `Welcome back! Feel free to ask me anything about ${scope}. How can I help?`;
  }
  return 'Welcome back! Feel free to ask me anything about your workspace. How can I help?';
}

function replyFor(question: string, scope: string | null): string {
  const where = scope ?? 'your workspace';
  return `Here's what I found across ${where} for “${question.trim()}”. I scanned the live tasks and pulled together the most relevant items — ask a follow-up to drill in further.`;
}

export function AiAssistantPanel() {
  const open = useUiStore((s) => s.aiPanelOpen);
  const scope = useUiStore((s) => s.aiPanelScope);
  const close = useUiStore((s) => s.closeAiPanel);

  const titleId = useId();
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const suggestions = useSuggestions();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const userId = `u-${idRef.current++}`;
    const aiId = `a-${idRef.current++}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: q },
      { id: aiId, role: 'ai', text: replyFor(q, scope) },
    ]);
    setInput('');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const newChat = () => setMessages([]);
  const scopeLabel = scope ?? 'Team Space';
  const hasChat = messages.length > 0;

  return (
    <aside
      role="complementary"
      aria-labelledby={titleId}
      style={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--cu-bg-app)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '6px',
        marginLeft: '6px',
        fontFamily: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
        color: TEXT_PRIMARY,
        overflow: 'hidden',
      }}
    >
      <PanelHeaderBar titleId={titleId} onNewChat={newChat} onClose={close} />

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {hasChat ? (
          <Transcript messages={messages} />
        ) : (
          <WelcomeBody scope={scope} suggestions={suggestions} onSuggest={send} />
        )}
      </div>

      <Composer
        input={input}
        inputRef={inputRef}
        scopeLabel={scopeLabel}
        onChange={setInput}
        onSend={() => send(input)}
      />
    </aside>
  );
}

// ── Header bar ────────────────────────────────────────────────────────────

function PanelHeaderBar({
  titleId,
  onNewChat,
  onClose,
}: {
  titleId: string;
  onNewChat: () => void;
  onClose: () => void;
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 48,
        padding: '0 16px',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      <IconButton label="New chat" onClick={onNewChat}>
        <PencilNewIcon size={16} />
      </IconButton>
      <IconButton label="Chat history">
        <HistoryIcon size={16} />
      </IconButton>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          id={titleId}
          aria-label="Select model: Max"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: TEXT_PRIMARY,
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <MaxOrbIcon size={16} />
          Max
          <span style={{ display: 'flex', color: TEXT_MUTED }}>
            <ChevronDownIcon size={12} />
          </span>
        </button>
      </div>

      <IconButton label="More options">
        <EllipsisIcon size={16} />
      </IconButton>
      <IconButton label="Collapse panel" onClick={onClose}>
        <CollapseRightIcon size={16} />
      </IconButton>
    </header>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
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
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        flexShrink: 0,
        background: hover ? HOVER_BG : 'transparent',
        color: hover ? TEXT_PRIMARY : TEXT_MUTED,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

// ── Welcome body ────────────────────────────────────────────────────────────

function WelcomeBody({
  scope,
  suggestions,
  onSuggest,
}: {
  scope: string | null;
  suggestions: string[];
  onSuggest: (text: string) => void;
}) {
  const askLabel = scope ? `Ask about ${scope}` : 'Ask about your Space';
  const rows = [...suggestions, 'Show more'];

  return (
    <div style={{ padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Brain greeting */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FlowerBrandIcon size={20} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Brain</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: '21px',
            color: 'rgba(255,255,255,0.93)',
          }}
        >
          {greetingFor(scope)}
        </p>
      </div>

      {/* Suggestions */}
      <section>
        <SectionHeader>{askLabel}</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((q) => (
            <SuggestionRow key={q} text={q} onClick={() => onSuggest(q)} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <SectionHeader>Features</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FEATURES.map((f) => (
            <FeatureCard key={f.key} feature={f} onClick={() => onSuggest(f.title)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 30,
        fontSize: 12,
        fontWeight: 500,
        color: '#7b7b7b',
        paddingLeft: 8,
      }}
    >
      {children}
    </div>
  );
}

function SuggestionRow({ text, onClick }: { text: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: 28,
        textAlign: 'left',
        padding: '0 8px',
        background: hover ? ROW_HOVER : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'rgba(255,255,255,0.93)',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', color: '#7b7b7b', flexShrink: 0 }}>
        <ArrowRightIcon size={14} />
      </span>
      <span
        style={{
          fontSize: 14,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </button>
  );
}

function FeatureCard({ feature, onClick }: { feature: Feature; onClick: () => void }) {
  const { title, description, tint, fg, Icon } = feature;
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: 12,
        background: CARD_BG,
        border: `1px solid ${hover ? CARD_BORDER_HOVER : CARD_BORDER}`,
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 120ms ease',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: tint,
          color: fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</span>
          <NewBadge />
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            lineHeight: '17px',
            color: '#b4b4b4',
            marginTop: 3,
          }}
        >
          {description}
        </span>
      </span>
      <span style={{ display: 'flex', color: '#7b7b7b', flexShrink: 0 }}>
        <ChevronRightIcon size={16} />
      </span>
    </button>
  );
}

function NewBadge() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        lineHeight: 1,
        padding: '2px 6px',
        borderRadius: 999,
        background: BADGE_BG,
        color: BADGE_FG,
        flexShrink: 0,
      }}
    >
      New
    </span>
  );
}

// ── Chat transcript ─────────────────────────────────────────────────────────

function Transcript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {messages.map((m) => (
        <Bubble key={m.id} msg={m} />
      ))}
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '86%',
          padding: '9px 12px',
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.45,
          background: isUser ? ACCENT : INPUT_BG,
          color: isUser ? ON_ACCENT : TEXT_PRIMARY,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

function Composer({
  input,
  inputRef,
  scopeLabel,
  onChange,
  onSend,
}: {
  input: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  scopeLabel: string;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  const canSend = input.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
      style={{ padding: '12px 16px 16px', flexShrink: 0 }}
    >
      <style>{COMPOSER_GLOW_CSS}</style>
      {/* Glow wrapper: animated blue→orange gradient border around the box. */}
      <div
        className="cu-ai-composer-glow"
        style={{
          borderRadius: 10,
          padding: 2,
          background: `linear-gradient(120deg, ${GLOW_BLUE}, ${GLOW_ORANGE}, ${GLOW_BLUE})`,
          backgroundSize: '200% 200%',
        }}
      >
        <div
          style={{
            borderRadius: 8,
            background: 'var(--cu-bg-sidebar)',
            padding: '12px 16px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tell AI what to do next"
            aria-label="Message Max"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
              padding: '0 2px',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label="Add context"
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                background: '#2a2a2a',
                color: '#fff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <PlusIcon size={16} />
            </button>

            <span style={{ flex: 1 }} />

            <ComposerIconButton label="Search the web">
              <GlobeIcon size={16} />
            </ComposerIconButton>

            <span
              aria-hidden="true"
              style={{ width: 1, height: 16, background: DIVIDER, flexShrink: 0, margin: '0 2px' }}
            />

            <button
              type="button"
              aria-label={`Knowledge scope: ${scopeLabel}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                maxWidth: 145,
                height: 26,
                padding: '0 8px',
                borderRadius: 6,
                border: `1px solid ${BORDER}`,
                background: INPUT_BG,
                color: TEXT_PRIMARY,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', color: TEXT_MUTED, flexShrink: 0 }}>
                <SpaceIcon size={13} />
              </span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {scopeLabel}
              </span>
              <span style={{ display: 'flex', color: TEXT_MUTED, flexShrink: 0 }}>
                <ChevronDownIcon size={12} />
              </span>
            </button>

            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              style={{
                position: 'relative',
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                overflow: 'hidden',
                padding: 0,
                background: 'transparent',
                cursor: canSend ? 'pointer' : 'default',
                opacity: canSend ? 1 : 0.45,
                flexShrink: 0,
                marginLeft: 2,
              }}
            >
              <span style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                <MaxOrbIcon size={28} />
              </span>
              <span style={{ position: 'relative', display: 'flex' }}>
                <SendArrowIcon size={15} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

const COMPOSER_GLOW_CSS = `
@keyframes cu-ai-composer-sweep {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.cu-ai-composer-glow {
  animation: cu-ai-composer-sweep 6s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cu-ai-composer-glow { animation: none; }
}
`;

function ComposerIconButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        background: hover ? HOVER_BG : 'transparent',
        color: hover ? TEXT_PRIMARY : TEXT_MUTED,
        flexShrink: 0,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}
