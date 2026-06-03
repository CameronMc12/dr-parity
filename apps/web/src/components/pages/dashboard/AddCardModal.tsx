'use client';

/**
 * AddCardModal — the ClickUp "Add card" gallery. A left category rail, a header
 * with the active category title + a search box, and a 3-column grid of preview
 * tiles (coloured mini-preview + title + description). Selecting a tile adds the
 * card to the dashboard and closes.
 *
 * Rendered as a fixed full-screen overlay (no portal needed — it sits above the
 * view via z-index). Closes on backdrop click and Escape.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDashboardActions } from '@/store/dashboard/hooks';
import type { CardType } from '@/store/dashboard';
import {
  CARD_CATEGORIES,
  CARD_TYPES,
  type CardCategory,
  type CardTypeMeta,
} from './cards/registry';
import { DASH } from './tokens';

const EXTRA_LINKS = ['Help Docs', 'Dashboard Webinar', 'Dashboard Guide'] as const;

interface AddCardModalProps {
  viewId: string;
  open: boolean;
  onClose: () => void;
}

export function AddCardModal({ viewId, open, onClose }: AddCardModalProps) {
  const actions = useDashboardActions();
  const [category, setCategory] = useState<CardCategory>('Featured');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCategory('Featured');
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const tiles = useMemo<CardTypeMeta[]>(() => {
    const q = query.trim().toLowerCase();
    return CARD_TYPES.filter((c) => {
      const inCategory = category === 'Featured' ? true : c.category === category;
      const matches =
        q === '' ||
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);
      return inCategory && matches;
    });
  }, [category, query]);

  if (!open) return null;

  const pick = (type: CardType) => {
    actions.addCard(viewId, type);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label="Add card"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          width: 'min(880px, 100%)',
          height: 'min(560px, 100%)',
          background: DASH.cardBg,
          border: `1px solid ${DASH.border}`,
          borderRadius: DASH.radius,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <CategoryRail active={category} onSelect={setCategory} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <GalleryHeader
            title={category}
            query={query}
            onQuery={setQuery}
            onClose={onClose}
          />
          <GalleryGrid tiles={tiles} onPick={pick} />
        </div>
      </div>
    </div>
  );
}

// ── Category rail ───────────────────────────────────────────────────────────

function CategoryRail({
  active,
  onSelect,
}: {
  active: CardCategory;
  onSelect: (c: CardCategory) => void;
}) {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        borderRight: `1px solid ${DASH.border}`,
        padding: '12px 8px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {CARD_CATEGORIES.map((c) => (
        <RailButton
          key={c}
          label={c}
          active={c === active}
          onClick={() => onSelect(c)}
        />
      ))}
      <div style={{ height: 1, background: DASH.border, margin: '8px 4px' }} />
      {EXTRA_LINKS.map((l) => (
        <RailButton key={l} label={l} muted onClick={() => undefined} />
      ))}
    </div>
  );
}

function RailButton({
  label,
  active,
  muted,
  onClick,
}: {
  label: string;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        padding: '7px 10px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 400,
        color: active
          ? DASH.textPrimary
          : muted
            ? DASH.textMuted
            : DASH.textSecondary,
        background: active || hover ? DASH.cardHoverBg : 'transparent',
      }}
    >
      {label}
    </button>
  );
}

// ── Header + search ─────────────────────────────────────────────────────────

function GalleryHeader({
  title,
  query,
  onQuery,
  onClose,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${DASH.border}`,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: DASH.textPrimary,
          flexShrink: 0,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          padding: '0 12px',
          background: DASH.bg,
          border: `1px solid ${DASH.border}`,
          borderRadius: 17,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ flexShrink: 0, color: DASH.textMuted }}>
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search cards"
          style={{
            flex: 1,
            height: '100%',
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: DASH.textPrimary,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: 'transparent',
          color: DASH.textMuted,
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Gallery grid ────────────────────────────────────────────────────────────

function GalleryGrid({
  tiles,
  onPick,
}: {
  tiles: CardTypeMeta[];
  onPick: (type: CardType) => void;
}) {
  if (tiles.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: DASH.textMuted,
          fontSize: 13,
        }}
      >
        No cards match your search.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 12,
        alignContent: 'start',
      }}
    >
      {tiles.map((tile) => (
        <GalleryTile key={tile.type} tile={tile} onPick={() => onPick(tile.type)} />
      ))}
    </div>
  );
}

function GalleryTile({
  tile,
  onPick,
}: {
  tile: CardTypeMeta;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${hover ? DASH.accent : DASH.border}`,
        background: DASH.bg,
        cursor: 'pointer',
        overflow: 'hidden',
        fontFamily: 'inherit',
        transition: 'border-color 120ms ease, transform 120ms ease',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      <div
        aria-hidden
        style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          color: '#fff',
          background: `color-mix(in srgb, ${tile.accent} 80%, black)`,
        }}
      >
        {tile.glyph}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: DASH.textPrimary }}>
          {tile.label}
        </div>
        <div style={{ fontSize: 12, color: DASH.textMuted, marginTop: 2 }}>
          {tile.description}
        </div>
      </div>
    </button>
  );
}
