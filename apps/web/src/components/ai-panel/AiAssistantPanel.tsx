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
  PencilNewIcon,
  PlusIcon,
  SendIcon,
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

const PANEL_WIDTH = 360;

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
    tint: 'rgba(78,205,196,0.16)',
    fg: '#19a89c',
    Icon: SummaryTileIcon,
  },
  {
    key: 'project-update',
    title: 'Project Update',
    description: 'Time-based project status update.',
    tint: 'rgba(63,140,255,0.16)',
    fg: '#3f8cff',
    Icon: UpdateTileIcon,
  },
  {
    key: 'find-duplicate-tasks',
    title: 'Find duplicate tasks',
    description: 'Identify and merge duplicate tasks hassle-free.',
    tint: 'rgba(255,122,69,0.18)',
    fg: '#e8662a',
    Icon: DuplicateTileIcon,
  },
  {
    key: 'find-tasks-stuck',
    title: 'Find tasks that are stuck',
    description: 'Quickly locate and resolve stagnant tasks.',
    tint: 'rgba(245,195,68,0.22)',
    fg: '#caa01a',
    Icon: StuckTileIcon,
  },
];

const STATIC_SUGGESTIONS = [
  'Are there any overdue tasks?',
  'Which open tasks have the highest priority?',
  'What is assigned to me?',
];

/** Build a couple of context-aware suggestions from real recent tasks. */
function useSuggestions(): string[] {
  const recent = useRecentTasks(2);
  return useMemo(() => {
    const dynamic = recent
      .map((t) => t.name.trim())
      .filter(Boolean)
      .map((name) => `When was “${name}” created in ClickUp?`);
    return [...dynamic, ...STATIC_SUGGESTIONS].slice(0, 4);
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
        background: PANEL_BG,
        borderLeft: `1px solid ${BORDER}`,
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
        height: 44,
        padding: '0 6px 0 8px',
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
        <span
          id={titleId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            borderRadius: 7,
            border: `1px solid ${BORDER}`,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <FlowerBrandIcon size={15} />
          Max
          <span style={{ display: 'flex', color: TEXT_MUTED }}>
            <ChevronDownIcon size={12} />
          </span>
        </span>
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
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? suggestions : suggestions.slice(0, 3);
  const askLabel = scope ? `Ask about ${scope}` : 'Ask about your workspace';

  return (
    <div style={{ padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Brain greeting */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <FlowerBrandIcon size={17} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Brain</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: TEXT_PRIMARY }}>
          {greetingFor(scope)}
        </p>
      </div>

      {/* Suggestions */}
      <section>
        <SectionHeader>{askLabel}</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((q) => (
            <SuggestionRow key={q} text={q} onClick={() => onSuggest(q)} />
          ))}
          {!showAll && suggestions.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                alignSelf: 'flex-start',
                marginTop: 2,
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                color: TEXT_MUTED,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: 6,
              }}
            >
              Show more
            </button>
          )}
        </div>
      </section>

      {/* Features */}
      <section>
        <SectionHeader>Features</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        fontSize: 12,
        fontWeight: 600,
        color: TEXT_MUTED,
        padding: '0 2px 8px',
        textTransform: 'none',
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
        gap: 10,
        width: '100%',
        textAlign: 'left',
        padding: '8px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: TEXT_PRIMARY,
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', color: TEXT_FAINT, flexShrink: 0 }}>
        <ArrowRightIcon size={15} />
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.35 }}>{text}</span>
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
        gap: 11,
        width: '100%',
        textAlign: 'left',
        padding: '9px 8px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 9,
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
          <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{title}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.2,
              padding: '1px 6px',
              borderRadius: 999,
              background: INPUT_BG,
              color: TEXT_MUTED,
            }}
          >
            New
          </span>
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: TEXT_MUTED,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </span>
      </span>
      <span style={{ display: 'flex', color: TEXT_FAINT, flexShrink: 0 }}>
        <ChevronRightIcon size={16} />
      </span>
    </button>
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
      style={{ padding: '10px 12px 12px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}
    >
      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          background: SURFACE,
          padding: '8px 8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
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
            fontSize: 13.5,
            color: TEXT_PRIMARY,
            fontFamily: 'inherit',
            padding: '2px 4px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ComposerIconButton label="Add context">
            <PlusIcon size={16} />
          </ComposerIconButton>
          <ComposerIconButton label="Search the web">
            <GlobeIcon size={16} />
          </ComposerIconButton>

          <span style={{ flex: 1 }} />

          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              maxWidth: 150,
              height: 26,
              padding: '0 8px',
              borderRadius: 7,
              border: `1px solid ${BORDER}`,
              background: INPUT_BG,
              color: TEXT_PRIMARY,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
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
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: canSend ? ACCENT : SEND_DISABLED,
              color: ON_ACCENT,
              cursor: canSend ? 'pointer' : 'default',
              flexShrink: 0,
              marginLeft: 2,
            }}
          >
            <SendIcon size={15} />
          </button>
        </div>
      </div>
    </form>
  );
}

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
