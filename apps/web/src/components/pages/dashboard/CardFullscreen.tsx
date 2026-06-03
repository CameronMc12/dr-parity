'use client';

/**
 * CardFullscreen — the modal ClickUp opens from a card's "Fullscreen" action.
 * A centered overlay that re-renders the same card body (via the registry) at a
 * large size, with the card title in the header and a close button. The body is
 * keyed by `card.refreshTick` so the in-modal Refresh re-runs the derivation,
 * matching the inline card.
 *
 * Rendered as a fixed overlay (z above the grid). Closes on backdrop click and
 * Escape.
 */

import { useEffect } from 'react';
import type { DashboardCard } from '@/store/dashboard';
import { CARD_RENDERERS } from './cards/registry';
import { DASH } from './tokens';

interface CardFullscreenProps {
  card: DashboardCard | null;
  listId: string;
  viewId: string;
  onRefresh: () => void;
  onClose: () => void;
}

export function CardFullscreen({
  card,
  listId,
  viewId,
  onRefresh,
  onClose,
}: CardFullscreenProps) {
  useEffect(() => {
    if (!card) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  if (!card) return null;
  const Renderer = CARD_RENDERERS[card.type];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label={`${card.title}, fullscreen`}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 'min(1100px, 100%)',
          height: 'min(760px, 100%)',
          background: DASH.cardBg,
          border: `1px solid ${DASH.border}`,
          borderRadius: DASH.radius,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 48,
            padding: '0 10px 0 18px',
            borderBottom: `1px solid ${DASH.border}`,
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: DASH.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.title}
          </h2>
          <HeaderAction title="Refresh" onClick={onRefresh}>
            ⟳
          </HeaderAction>
          <HeaderAction title="Close" onClick={onClose}>
            ×
          </HeaderAction>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Renderer
            key={card.refreshTick ?? 0}
            card={card}
            listId={listId}
            viewId={viewId}
          />
        </div>
      </div>
    </div>
  );
}

function HeaderAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: DASH.textMuted,
        fontSize: title === 'Close' ? 20 : 15,
        lineHeight: 1,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = DASH.cardHoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
