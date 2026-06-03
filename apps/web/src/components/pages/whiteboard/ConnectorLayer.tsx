'use client';

/**
 * SVG overlay that paints every connector in board space. Sits inside the
 * transformed canvas world, so it inherits the same pan/zoom as the boxes. A
 * connector is a straight line with a small arrow head; selecting it draws a
 * thicker accent stroke. The layer spans a large fixed board area so lines are
 * never clipped.
 */

import { useId, useState } from 'react';
import { ElementContextMenu, type ElementMenuState } from './ElementContextMenu';
import type { ConnectorElement } from './types';

const SELECT_COLOR = 'var(--cu-accent, #4ecdc4)';
const BOARD_EXTENT = 8000;

/** Smooth (quadratic) SVG path through the pen stroke's relative points. */
function penPath(c: ConnectorElement, ox: number, oy: number): string {
  const pts = (c.points ?? []).map((p) => ({
    x: c.x + p.x + ox,
    y: c.y + p.y + oy,
  }));
  const first = pts[0];
  if (!first || pts.length < 2) {
    return `M${c.x + ox} ${c.y + oy} L${c.x2 + ox} ${c.y2 + oy}`;
  }
  let d = `M${first.x} ${first.y}`;
  let prev = first;
  for (let i = 1; i < pts.length; i += 1) {
    const n = pts[i];
    if (!n) break;
    const mx = (prev.x + n.x) / 2;
    const my = (prev.y + n.y) / 2;
    d += ` Q${prev.x} ${prev.y} ${mx} ${my}`;
    prev = n;
  }
  d += ` L${prev.x} ${prev.y}`;
  return d;
}

export function ConnectorLayer({
  connectors,
  selectedId,
  onSelect,
  onRemove,
}: {
  connectors: ConnectorElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const markerId = useId();
  const [menu, setMenu] = useState<ElementMenuState | null>(null);
  if (connectors.length === 0) return null;
  return (
    <>
    <svg
      width={BOARD_EXTENT}
      height={BOARD_EXTENT}
      style={{
        position: 'absolute',
        left: -BOARD_EXTENT / 2,
        top: -BOARD_EXTENT / 2,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1,
      }}
      aria-hidden
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="#64748b" />
        </marker>
      </defs>
      {connectors.map((c) => {
        const selected = c.id === selectedId;
        const ox = BOARD_EXTENT / 2;
        const oy = BOARD_EXTENT / 2;
        const stroke = selected ? SELECT_COLOR : c.stroke;
        const onDown = (e: React.PointerEvent) => {
          e.stopPropagation();
          onSelect(c.id);
        };
        const onMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(c.id);
          setMenu({ id: c.id, x: e.clientX, y: e.clientY });
        };
        if (c.style === 'pen') {
          return (
            <path
              key={c.id}
              d={penPath(c, ox, oy)}
              fill="none"
              stroke={stroke}
              strokeWidth={selected ? 3.5 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={c.dashed ? '7 6' : undefined}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerDown={onDown}
              onContextMenu={onMenu}
            />
          );
        }
        return (
          <line
            key={c.id}
            x1={c.x + ox}
            y1={c.y + oy}
            x2={c.x2 + ox}
            y2={c.y2 + oy}
            stroke={stroke}
            strokeWidth={selected ? 3 : 2}
            strokeLinecap="round"
            strokeDasharray={c.dashed ? '7 6' : undefined}
            markerEnd={`url(#${markerId})`}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onPointerDown={onDown}
            onContextMenu={onMenu}
          />
        );
      })}
    </svg>
    <ElementContextMenu
      state={menu}
      onClose={() => setMenu(null)}
      onDelete={onRemove}
    />
    </>
  );
}
