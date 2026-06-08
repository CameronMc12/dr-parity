'use client';

import { useState } from 'react';
import {
  AI_SUPER_AGENTS,
  AI_RECENT_AGENTS,
  AI_CREDIT_WIDGETS,
  type AiSuperAgentLink,
} from '@/data/ai-seed';
import {
  BrainFlower,
  ComposeIcon,
  ChevronDown,
  SuperAgentGlyph,
  ConnectionsIcon,
  NewTabIcon,
  CreditRing,
} from '@/components/pages/ai/ai-icons';

const TEXT = 'rgb(40, 42, 50)';
const MUTED = 'rgb(126, 132, 144)';
const SUBTITLE = 'rgb(150, 155, 166)';
const HOVER = 'rgb(244, 245, 247)';
const ACTIVE = 'rgb(237, 238, 242)';
const DIVIDER = 'rgb(233, 234, 238)';

const ACTIVE_ID = 'ask-or-create';

/**
 * ClickUp Brain sidebar: header ("AI" + compose), an active "Ask or Create"
 * row, the Super Agents nav (Create Agent / All Agents / My Agents / Activity),
 * a Recent Super Agents list, a Connections utility link, and a footer with two
 * credit-ring stats. Matches the real Brain sidebar 1:1.
 */
export function AiSidebar() {
  const [selectedId, setSelectedId] = useState<string>(ACTIVE_ID);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--cu-font)',
        background: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px 0 16px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700, flex: 1 }}>AI</span>
        <button
          type="button"
          aria-label="Create"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            height: 28,
            padding: '0 4px 0 7px',
            background: '#fff',
            border: `1px solid ${DIVIDER}`,
            borderRadius: 7,
            cursor: 'pointer',
            color: TEXT,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
        >
          <ComposeIcon size={16} />
          <span style={{ color: MUTED, display: 'flex' }}>
            <ChevronDown size={12} />
          </span>
        </button>
      </div>

      {/* Scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {/* Ask or Create */}
        <NavRow
          active={selectedId === ACTIVE_ID}
          onClick={() => setSelectedId(ACTIVE_ID)}
          icon={<BrainFlower size={16} />}
          label="Ask or Create"
        />

        <Subtitle>Super Agents</Subtitle>

        {AI_SUPER_AGENTS.map((item) => (
          <SuperAgentRow
            key={item.id}
            item={item}
            active={selectedId === item.id}
            onClick={() => setSelectedId(item.id)}
          />
        ))}

        <div style={{ height: 1, background: DIVIDER, margin: '10px 8px' }} />
        <Subtitle>Recent Super Agents</Subtitle>

        {AI_RECENT_AGENTS.map((a) => (
          <NavRow
            key={a.id}
            active={selectedId === a.id}
            onClick={() => setSelectedId(a.id)}
            icon={<Avatar initial={a.initial} bg={a.avatarBg} />}
            label={a.label}
          />
        ))}
      </div>

      {/* Connections utility link */}
      <div style={{ flexShrink: 0, padding: '0 8px 6px' }}>
        <button
          type="button"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 36,
            padding: '0 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            color: TEXT,
            fontSize: 13.5,
            textAlign: 'left',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <ConnectionsIcon size={18} />
          <span style={{ flex: 1 }}>Connections</span>
          <span style={{ color: MUTED, display: 'flex' }}>
            <NewTabIcon size={14} />
          </span>
        </button>
      </div>

      {/* Footer credit widgets */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${DIVIDER}`, padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', gap: 18 }}>
          {AI_CREDIT_WIDGETS.map((w) => (
            <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <CreditRing size={20} progress={w.progress} />
                <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{w.value}</span>
              </div>
              <span style={{ color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{w.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: 0,
        padding: '12px 8px 4px',
        color: SUBTITLE,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '16px',
      }}
    >
      {children}
    </h3>
  );
}

function NavRow({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 34,
        padding: '0 8px',
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        color: TEXT,
        fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, width: 18, justifyContent: 'center' }}>{icon}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span style={{ color: MUTED, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{count}</span>
      )}
    </button>
  );
}

function SuperAgentRow({
  item,
  active,
  onClick,
}: {
  item: AiSuperAgentLink;
  active: boolean;
  onClick: () => void;
}) {
  const icon =
    item.glyph === 'myAgents' ? (
      <Avatar initial="C" bg="rgb(24, 24, 24)" />
    ) : (
      <SuperAgentGlyph glyph={item.glyph} size={18} />
    );
  return <NavRow active={active} onClick={onClick} icon={icon} label={item.label} count={item.count} />;
}

function Avatar({ initial, bg }: { initial: string; bg: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        fontSize: 10,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}
