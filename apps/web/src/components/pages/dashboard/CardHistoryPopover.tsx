'use client';

/**
 * CardHistoryPopover — the panel ClickUp opens from a card's "Show history".
 * A small centered modal listing the card's activity, derived deterministically
 * from the live card record (its type, current config, and refresh count). No
 * fabricated timestamps — entries describe the card's real present state plus
 * how many times it has been refreshed this session.
 *
 * Closes on backdrop click and Escape.
 */

import { useEffect, useMemo } from 'react';
import type { DashboardCard } from '@/store/dashboard';
import { DASH } from './tokens';
import { cardTypeMeta } from './cards/registry';

interface HistoryEntry {
  label: string;
  detail: string;
}

function buildEntries(card: DashboardCard): HistoryEntry[] {
  const meta = cardTypeMeta(card.type);
  const entries: HistoryEntry[] = [
    { label: 'Card created', detail: `${meta?.label ?? card.type} added to this dashboard.` },
  ];

  if (card.config?.metric) {
    entries.push({ label: 'Metric set', detail: `Counting "${card.config.metric}".` });
  }
  if (card.config?.grouping) {
    entries.push({ label: 'Grouping set', detail: `Grouped by "${card.config.grouping}".` });
  }
  if (card.config?.openOnly) {
    entries.push({ label: 'Filter applied', detail: 'Open tasks only.' });
  }
  if (card.filters && (card.filters.assignee.length || card.filters.status.length)) {
    const n = card.filters.assignee.length + card.filters.status.length;
    entries.push({ label: 'Card filter', detail: `${n} value${n === 1 ? '' : 's'} pinned.` });
  }

  const ticks = card.refreshTick ?? 0;
  if (ticks > 0) {
    entries.push({
      label: 'Refreshed',
      detail: `Data refreshed ${ticks} time${ticks === 1 ? '' : 's'} this session.`,
    });
  }

  entries.push({
    label: 'Position',
    detail: `Column ${card.x + 1}, row ${card.y + 1} · ${card.w}×${card.h} grid units.`,
  });

  return entries;
}

interface CardHistoryPopoverProps {
  card: DashboardCard;
  open: boolean;
  onClose: () => void;
}

export function CardHistoryPopover({ card, open, onClose }: CardHistoryPopoverProps) {
  const entries = useMemo(() => buildEntries(card), [card]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label={`${card.title}, history`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          maxHeight: 'min(520px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          background: DASH.cardBg,
          border: `1px solid ${DASH.border}`,
          borderRadius: DASH.radius,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 12px 14px 18px',
            borderBottom: `1px solid ${DASH.border}`,
          }}
        >
          <h2
            style={{
              flex: 1,
              minWidth: 0,
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: DASH.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            History · {card.title}
          </h2>
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

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '8px 0',
            overflowY: 'auto',
          }}
        >
          {entries.map((entry, i) => (
            <li
              key={`${entry.label}-${i}`}
              style={{
                display: 'flex',
                gap: 12,
                padding: '8px 18px',
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: DASH.accent,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: DASH.textPrimary }}>
                  {entry.label}
                </div>
                <div style={{ fontSize: 12, color: DASH.textMuted, marginTop: 1 }}>
                  {entry.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
