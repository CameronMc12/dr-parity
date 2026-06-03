'use client';

/**
 * DashboardGrid — lays cards out on a 12-column CSS grid (row height ~80px) and
 * owns pointer-based drag (move) and resize with grid snapping. No external dnd
 * library: a pointer-down on a card's drag handle / resize handle starts a
 * gesture, pointermove computes the snapped grid delta, and the store is
 * committed on pointerup.
 *
 * Each card body is resolved from the registry by type and wrapped in a
 * CardFrame. Drag/resize handles are only active in `editing` mode.
 */

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDashboardActions, useDashboardCards } from '@/store/dashboard/hooks';
import { DASHBOARD_GRID_COLS } from '@/store/dashboard';
import type { DashboardCard } from '@/store/dashboard';
import { CardFrame } from './CardFrame';
import { CardFullscreen } from './CardFullscreen';
import { CARD_RENDERERS } from './cards/registry';
import { DASH } from './tokens';

interface GestureState {
  kind: 'move' | 'resize';
  cardId: string;
  startPointerX: number;
  startPointerY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  colWidth: number;
}

interface Preview {
  cardId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DashboardGridProps {
  viewId: string;
  listId: string;
  editing: boolean;
  /** Card "Move" option asks the board to enter drag/edit mode. */
  onRequestEditing: () => void;
}

export function DashboardGrid({
  viewId,
  listId,
  editing,
  onRequestEditing,
}: DashboardGridProps) {
  const cards = useDashboardCards(viewId);
  const actions = useDashboardActions();
  const gridRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const fullscreenCard = fullscreenId
    ? cards.find((c) => c.id === fullscreenId) ?? null
    : null;

  const colWidth = useCallback((): number => {
    const el = gridRef.current;
    if (!el) return 80;
    const inner = el.clientWidth - DASH.gridPad * 2;
    return (inner - DASH.gridGap * (DASHBOARD_GRID_COLS - 1)) / DASHBOARD_GRID_COLS;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    const stepX = g.colWidth + DASH.gridGap;
    const stepY = DASH.rowHeight + DASH.gridGap;
    const dCol = Math.round((e.clientX - g.startPointerX) / stepX);
    const dRow = Math.round((e.clientY - g.startPointerY) / stepY);

    if (g.kind === 'move') {
      const w = g.startW;
      const x = Math.max(0, Math.min(g.startX + dCol, DASHBOARD_GRID_COLS - w));
      const y = Math.max(0, g.startY + dRow);
      setPreview({ cardId: g.cardId, x, y, w, h: g.startH });
    } else {
      const w = Math.max(2, Math.min(g.startW + dCol, DASHBOARD_GRID_COLS - g.startX));
      const h = Math.max(2, g.startH + dRow);
      setPreview({ cardId: g.cardId, x: g.startX, y: g.startY, w, h });
    }
  }, []);

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    setPreview((p) => {
      if (g && p && p.cardId === g.cardId) {
        if (g.kind === 'move') actions.moveCard(viewId, g.cardId, p.x, p.y);
        else actions.resizeCard(viewId, g.cardId, p.w, p.h);
      }
      return null;
    });
    gestureRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endGesture);
  }, [actions, viewId, onPointerMove]);

  const startGesture = useCallback(
    (kind: 'move' | 'resize', card: DashboardCard, e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      gestureRef.current = {
        kind,
        cardId: card.id,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startX: card.x,
        startY: card.y,
        startW: card.w,
        startH: card.h,
        colWidth: colWidth(),
      };
      setPreview({ cardId: card.id, x: card.x, y: card.y, w: card.w, h: card.h });
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endGesture);
    },
    [colWidth, onPointerMove, endGesture],
  );

  if (cards.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: 'center',
          color: DASH.textMuted,
          fontSize: 13,
        }}
      >
        This dashboard is empty. Use “Add card” to build it out.
      </div>
    );
  }

  return (
    <>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${DASHBOARD_GRID_COLS}, minmax(0, 1fr))`,
          gridAutoRows: `${DASH.rowHeight}px`,
          gap: DASH.gridGap,
          padding: DASH.gridPad,
          alignContent: 'start',
        }}
      >
        {cards.map((card) => {
          const Renderer = CARD_RENDERERS[card.type];
          const live = preview?.cardId === card.id ? preview : card;
          return (
            <div
              key={card.id}
              style={{
                gridColumn: `${live.x + 1} / span ${live.w}`,
                gridRow: `${live.y + 1} / span ${live.h}`,
                minHeight: 0,
                minWidth: 0,
                transition: preview?.cardId === card.id ? 'none' : 'all 160ms ease',
              }}
            >
              <CardFrame
                viewId={viewId}
                card={card}
                editing={editing}
                onDragStart={(e) => startGesture('move', card, e)}
                onResizeStart={(e) => startGesture('resize', card, e)}
                onFullscreen={() => setFullscreenId(card.id)}
                onRequestMove={onRequestEditing}
              >
                <Renderer card={card} listId={listId} viewId={viewId} />
              </CardFrame>
            </div>
          );
        })}
      </div>

      <CardFullscreen
        card={fullscreenCard}
        listId={listId}
        viewId={viewId}
        onRefresh={() =>
          fullscreenCard && actions.refreshCard(viewId, fullscreenCard.id)
        }
        onClose={() => setFullscreenId(null)}
      />
    </>
  );
}
