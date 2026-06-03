'use client';

/**
 * Ask AI panel. A right-anchored conversational surface: scrollable message
 * thread + composer. Answers are deterministic templates derived from the
 * project's REAL tasks (counts by status via useViewTasks/useStatusColumns), so
 * the AI "knows" the live workspace without any network call. Suggested-prompt
 * chips seed common questions.
 */

import { useId, useMemo, useRef, useState } from 'react';
import { useViewTasks, useStatusColumns } from '@/lib/view-data';
import {
  HeaderIconButton,
  HeaderPopover,
  PanelHeader,
  headerTokens,
} from './primitives';
import { SparkleIcon, SendIcon, AiBrandIcon } from './icons';

const { TEXT_MUTED, TEXT_PRIMARY, MENU_BORDER, ACCENT } = headerTokens;

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const SUGGESTIONS = [
  'Summarize this project',
  'What needs attention?',
  'How many tasks are open?',
];

/** Build a deterministic answer from real task data for the given question. */
function answerFor(
  question: string,
  total: number,
  cols: { status: string; count: number }[],
  projectName: string,
): string {
  const q = question.toLowerCase();
  const biggest = [...cols].sort((a, b) => b.count - a.count)[0];
  if (total === 0 || !biggest) {
    return `${projectName} has no tasks yet. Create one to get started.`;
  }

  const breakdown = cols
    .filter((c) => c.count > 0)
    .map((c) => `${c.count} in ${c.status}`)
    .join(', ');

  if (q.includes('open') || q.includes('how many')) {
    const open = cols
      .filter((c) => !/complete|closed|done/i.test(c.status))
      .reduce((n, c) => n + c.count, 0);
    return `${projectName} has ${total} task${total === 1 ? '' : 's'}, ${open} of which ${open === 1 ? 'is' : 'are'} still open (${breakdown}).`;
  }

  if (q.includes('attention') || q.includes('blocked') || q.includes('risk')) {
    return `Most of the work sits in ${biggest.status} (${biggest.count} task${biggest.count === 1 ? '' : 's'}). Focus there first — the full breakdown is ${breakdown}.`;
  }

  // default: summary
  const allSame = cols.filter((c) => c.count > 0).length === 1;
  if (allSame) {
    return `${projectName} has ${total} task${total === 1 ? '' : 's'}, all in ${biggest.status}.`;
  }
  return `${projectName} has ${total} task${total === 1 ? '' : 's'}: ${breakdown}. The largest group is ${biggest.status}.`;
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '82%',
          padding: '8px 11px',
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.4,
          background: isUser ? ACCENT : 'var(--cu-bg-input, #f4f4f4)',
          color: isUser ? '#fff' : TEXT_PRIMARY,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

export function AskPanel({ viewId, projectName }: { viewId: string; projectName: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const idRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const tasks = useViewTasks(viewId);
  const statusCols = useStatusColumns(viewId);
  const cols = useMemo(
    () => statusCols.map((c) => ({ status: c.status, count: c.tasks.length })),
    [statusCols],
  );

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const reply = answerFor(q, tasks.length, cols, projectName);
    const userId = `u-${idRef.current++}`;
    const aiId = `a-${idRef.current++}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: q },
      { id: aiId, role: 'ai', text: reply },
    ]);
    setInput('');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  return (
    <>
      <HeaderIconButton
        ref={triggerRef}
        label="Ask AI"
        active={open}
        width={66}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 6px',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'inherit',
          }}
        >
          <span style={{ display: 'flex' }}>
            <AiBrandIcon size={15} />
          </span>
          Ask AI
        </span>
      </HeaderIconButton>

      <HeaderPopover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        width={360}
        labelledBy={titleId}
        surfaceStyle={{ display: 'flex', flexDirection: 'column', height: 460, maxHeight: 'calc(100vh - 80px)' }}
      >
        <PanelHeader title="Ask AI" titleId={titleId} icon={<SparkleIcon />} onClose={() => setOpen(false)} />

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {messages.length === 0 ? (
            <div style={{ margin: 'auto 0', textAlign: 'center', color: TEXT_MUTED }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(78,205,196,0.16)',
                  color: ACCENT,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <SparkleIcon size={20} />
              </div>
              <div style={{ fontSize: 13.5, color: TEXT_PRIMARY, fontWeight: 600 }}>Ask about {projectName}</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Answers use this project&apos;s live tasks.</div>
            </div>
          ) : (
            messages.map((m) => <Bubble key={m.id} msg={m} />)
          )}
        </div>

        {/* Suggested prompt chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 8px' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              style={{
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 999,
                border: `1px solid ${MENU_BORDER}`,
                background: 'transparent',
                color: TEXT_PRIMARY,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cu-bg-hover, #f4f4f4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${MENU_BORDER}` }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this project…"
            style={{
              flex: 1,
              height: 34,
              padding: '0 12px',
              background: 'var(--cu-bg-input, #f7f7f7)',
              border: `1px solid ${MENU_BORDER}`,
              borderRadius: 8,
              fontSize: 13,
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!input.trim()}
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: input.trim() ? ACCENT : 'var(--cu-border-strong, #d0d0d0)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            <SendIcon size={16} />
          </button>
        </form>
      </HeaderPopover>
    </>
  );
}
