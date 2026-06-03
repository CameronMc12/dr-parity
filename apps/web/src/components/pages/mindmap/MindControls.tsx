'use client';

/**
 * Bottom-right control cluster, matching real ClickUp's Mind Map:
 *
 *   ┌─────────────┐  ┌─┐  +
 *   │  minimap    │  │ │  ▣  (draggable zoom thumb)
 *   │  thumbnail  │  │ │  −
 *   └─────────────┘  └─┘
 *
 * Left: a minimap panel showing a scaled thumbnail of the whole tree with the
 * current viewport drawn as a rectangle. Right: a vertical zoom slider with "+"
 * at the top, "−" at the bottom, and a draggable thumb. Every control is real
 * and wired to the pan/zoom controller.
 */

import { useCallback, useRef, useState } from 'react';
import type { MindLayout } from './layout';
import type { Transform } from './use-pan-zoom';

const PANEL_BG = 'var(--cu-bg-menu, rgb(34,34,34))';
const BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.10))';
const BORDER_STRONG = 'var(--cu-border-strong, rgba(255,255,255,0.28))';
const TEXT = 'var(--cu-text-secondary, rgb(160,160,160))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(217,217,217))';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.06))';
const NODE_DOT = 'var(--cu-text-muted, rgb(140,140,140))';
const VIEW_RECT = 'var(--cu-status-blue, rgb(91,141,239))';
const SHADOW = '0 4px 14px rgba(0,0,0,0.45)';

const MINIMAP_W = 132;
const MINIMAP_H = 84;
const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

interface Props {
  scale: number;
  /** Tree transform + geometry drive the minimap; omit for the freeform canvas. */
  transform?: Transform;
  layout?: MindLayout;
  viewport?: { w: number; h: number };
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (scale: number) => void;
}

export function MindControls({
  scale,
  transform,
  layout,
  viewport,
  onZoomIn,
  onZoomOut,
  onZoomTo,
}: Props) {
  const showMinimap = layout && transform && viewport && layout.nodes.length > 1;
  return (
    <div
      data-testid="mindmap-controls"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        zIndex: 2,
      }}
    >
      {showMinimap && (
        <Minimap layout={layout} transform={transform} scale={scale} viewport={viewport} />
      )}
      <ZoomSlider
        scale={scale}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomTo={onZoomTo}
      />
    </div>
  );
}

function Minimap({
  layout,
  transform,
  scale,
  viewport,
}: {
  layout: MindLayout;
  transform: Transform;
  scale: number;
  viewport: { w: number; h: number };
}) {
  const k = Math.min(MINIMAP_W / layout.width, MINIMAP_H / layout.height) || 1;
  const offX = (MINIMAP_W - layout.width * k) / 2;
  const offY = (MINIMAP_H - layout.height * k) / 2;

  // Viewport rectangle = the slice of canvas space currently visible, mapped
  // into minimap space. Canvas-space top-left of the viewport is (-x/scale,…).
  const viewX = -transform.x / scale;
  const viewY = -transform.y / scale;
  const viewW = viewport.w / scale;
  const viewH = viewport.h / scale;

  return (
    <div
      data-testid="mindmap-minimap"
      style={{
        position: 'relative',
        width: MINIMAP_W,
        height: MINIMAP_H,
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        boxShadow: SHADOW,
        overflow: 'hidden',
      }}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H} aria-hidden>
        {layout.edges.map((e) => (
          <line
            key={e.id}
            x1={offX + (e.from.x + 110) * k}
            y1={offY + (e.from.y + 24) * k}
            x2={offX + e.to.x * k}
            y2={offY + (e.to.y + 24) * k}
            stroke={BORDER_STRONG}
            strokeWidth={1}
          />
        ))}
        {layout.nodes.map((n) => (
          <rect
            key={n.id}
            x={offX + n.x * k}
            y={offY + n.y * k}
            width={Math.max(4, 220 * k)}
            height={Math.max(2, 48 * k)}
            rx={2}
            fill={NODE_DOT}
          />
        ))}
        <rect
          x={offX + viewX * k}
          y={offY + viewY * k}
          width={viewW * k}
          height={viewH * k}
          fill="none"
          stroke={VIEW_RECT}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

function ZoomSlider({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomTo,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (scale: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Map scale (log) to a 0..1 thumb position so the midpoint feels natural.
  const logMin = Math.log(MIN_SCALE);
  const logMax = Math.log(MAX_SCALE);
  const pos = (Math.log(scale) - logMin) / (logMax - logMin);
  const clampedPos = Math.min(1, Math.max(0, pos));

  const applyFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = 1 - (clientY - rect.top) / rect.height; // top = max zoom
      const clamped = Math.min(1, Math.max(0, ratio));
      onZoomTo(Math.exp(logMin + clamped * (logMax - logMin)));
    },
    [logMin, logMax, onZoomTo],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      applyFromClientY(e.clientY);
    },
    [applyFromClientY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      applyFromClientY(e.clientY);
    },
    [applyFromClientY],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be gone; ignore.
    }
  }, []);

  return (
    <div
      data-testid="mindmap-zoom"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: SHADOW,
        width: 34,
      }}
    >
      <SliderButton label="Zoom in" testid="mindmap-zoom-in" onClick={onZoomIn}>
        +
      </SliderButton>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Zoom level"
        aria-valuemin={MIN_SCALE * 100}
        aria-valuemax={MAX_SCALE * 100}
        aria-valuenow={Math.round(scale * 100)}
        tabIndex={0}
        data-testid="mindmap-zoom-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onZoomIn();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onZoomOut();
          }
        }}
        style={{
          position: 'relative',
          flex: 1,
          width: 6,
          margin: '8px 0',
          minHeight: 64,
          background: BORDER,
          borderRadius: 3,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        <span
          data-testid="mindmap-zoom-thumb"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            top: `${(1 - clampedPos) * 100}%`,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: TEXT_PRIMARY,
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      <SliderButton label="Zoom out" testid="mindmap-zoom-out" onClick={onZoomOut}>
        −
      </SliderButton>
    </div>
  );
}

function SliderButton({
  label,
  testid,
  onClick,
  children,
}: {
  label: string;
  testid: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testid}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: hover ? TEXT_PRIMARY : TEXT,
        fontSize: 17,
        lineHeight: 1,
        transition: 'background 120ms, color 120ms',
      }}
    >
      {children}
    </button>
  );
}
