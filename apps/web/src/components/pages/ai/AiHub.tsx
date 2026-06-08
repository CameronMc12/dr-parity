'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { PageSurface } from '../page-primitives';
import {
  STROKE,
  BrainFlower,
  BrainWordmark,
  PlusIcon,
  ChevronDown,
  GlobeIcon,
  SendIcon,
  AgentIcon,
  HistoryIcon,
  SuggestionCardGlyph,
} from './ai-icons';
import { AI_SUGGESTION_CARDS } from '@/data/ai-seed';

const TEXT_PRIMARY = 'rgb(29, 31, 38)';
const TEXT_MUTED = 'rgb(110, 116, 128)';
const PLACEHOLDER = 'rgb(140, 146, 158)';
const CARD_BORDER = 'rgb(229, 231, 235)';
const ICON_BTN_HOVER = 'rgb(240, 241, 244)';

type Tab = 'ask' | 'agents';

/**
 * ClickUp Brain hub: /<wsId>/ai/brain. A centered "Brain™" hero over a large
 * rounded prompt box (Ask | Agents toggle, + / model selector / globe / send),
 * with four suggestion cards beneath. Mirrors the real Brain landing 1:1.
 */
export function AiHub() {
  const [prompt, setPrompt] = useState('');
  const [tab, setTab] = useState<Tab>('ask');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPrompt('');
  };

  return (
    <PageSurface>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* Soft top gradient band */}
        <div
          style={{
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 140,
            background:
              'linear-gradient(180deg, rgba(255, 214, 165, 0.45) 0%, rgba(255, 196, 222, 0.34) 22%, rgba(206, 200, 255, 0.30) 44%, rgba(189, 224, 255, 0.22) 64%, rgba(255, 255, 255, 0) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* History button, top-right */}
        <div style={{ position: 'absolute', top: 14, right: 18, zIndex: 2 }}>
          <IconButton ariaLabel="Chat history">
            <HistoryIcon size={18} />
          </IconButton>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 640,
            margin: '0 auto',
            padding: '150px 24px 64px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Hero brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 28 }}>
            <BrainFlower size={48} />
            <BrainWordmark height={32} />
          </div>

          {/* Ask | Agents pill toggle */}
          <TabToggle tab={tab} onSelect={setTab} />

          {/* Prompt box */}
          <PromptBox value={prompt} onChange={setPrompt} onSubmit={onSubmit} />

          {/* Suggestion cards */}
          <div
            style={{
              width: '100%',
              marginTop: 22,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}
          >
            {AI_SUGGESTION_CARDS.map((c) => (
              <SuggestionCard
                key={c.id}
                title={c.title}
                description={c.description}
                onClick={() => setPrompt(`${c.title}: `)}
              >
                <SuggestionCardGlyph glyph={c.glyph} />
              </SuggestionCard>
            ))}
          </div>
        </div>
      </div>
    </PageSurface>
  );
}

function TabToggle({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="AI mode selection"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        marginBottom: 14,
        background: 'rgb(238, 240, 243)',
        borderRadius: 12,
      }}
    >
      <TabButton selected={tab === 'ask'} onClick={() => onSelect('ask')}>
        <BrainFlower size={15} />
        Ask
      </TabButton>
      <TabButton selected={tab === 'agents'} onClick={() => onSelect('agents')}>
        <span style={{ color: tab === 'agents' ? TEXT_PRIMARY : TEXT_MUTED, display: 'flex' }}>
          <AgentIcon size={15} />
        </span>
        Agents
      </TabButton>
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 14px',
        background: selected ? '#fff' : 'transparent',
        border: 'none',
        borderRadius: 9,
        boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.10)' : 'none',
        cursor: 'pointer',
        color: selected ? TEXT_PRIMARY : TEXT_MUTED,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function PromptBox({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const canSend = value.trim().length > 0;
  return (
    <form
      onSubmit={onSubmit}
      style={{
        position: 'relative',
        width: '100%',
        background: '#fff',
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 18,
        boxShadow:
          '0 0 0 6px rgba(255, 213, 196, 0.30), 0 0 36px 10px rgba(255, 200, 224, 0.22), 0 6px 22px rgba(120, 100, 160, 0.10)',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Get instant answers, insights, and ideas."
        aria-label="Ask Brain"
        rows={2}
        style={{
          width: '100%',
          resize: 'none',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '16px 18px 4px',
          color: TEXT_PRIMARY,
          fontSize: 15,
          lineHeight: '22px',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <style>{`textarea::placeholder { color: ${PLACEHOLDER}; }`}</style>

      {/* Bottom toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px 12px',
        }}
      >
        <IconButton ariaLabel="Add attachment">
          <PlusIcon size={18} />
        </IconButton>
        <span style={{ width: 1, height: 18, background: CARD_BORDER, margin: '0 2px' }} />

        {/* Model selector */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setModelOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={modelOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 6px 0 4px',
              background: modelOpen ? ICON_BTN_HOVER : 'transparent',
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              color: TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <BrainFlower size={16} />
            Max
            <span style={{ color: TEXT_MUTED, display: 'flex' }}>
              <ChevronDown size={13} />
            </span>
          </button>
          {modelOpen && <ModelMenu onClose={() => setModelOpen(false)} />}
        </div>

        <span style={{ flex: 1 }} />

        <IconButton ariaLabel="Search Web">
          <GlobeIcon size={18} />
        </IconButton>
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: canSend ? TEXT_PRIMARY : 'rgb(228, 230, 234)',
            color: canSend ? '#fff' : 'rgb(150, 155, 165)',
            border: 'none',
            borderRadius: '50%',
            cursor: canSend ? 'pointer' : 'default',
            transition: 'background 120ms ease',
          }}
        >
          <SendIcon size={15} />
        </button>
      </div>
    </form>
  );
}

function ModelMenu({ onClose }: { onClose: () => void }) {
  const models = ['Max', 'Balanced', 'Fast'];
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: 0,
        minWidth: 160,
        background: '#fff',
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
        padding: 4,
        zIndex: 10,
      }}
    >
      {models.map((m) => (
        <button
          key={m}
          type="button"
          role="menuitem"
          onClick={onClose}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 32,
            padding: '0 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_PRIMARY,
            fontSize: 13,
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = ICON_BTN_HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <BrainFlower size={15} />
          {m}
        </button>
      ))}
    </div>
  );
}

function IconButton({ children, ariaLabel }: { children: React.ReactNode; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        color: STROKE,
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = ICON_BTN_HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {children}
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
    gap: 14,
    padding: '12px 13px',
    background: '#fff',
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    minWidth: 0,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={base}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = 'rgb(205, 208, 214)';
        el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.borderColor = CARD_BORDER;
        el.style.boxShadow = 'none';
      }}
    >
      <span style={{ color: STROKE, display: 'flex' }}>{children}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 12,
            color: TEXT_MUTED,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </span>
      </span>
    </button>
  );
}
