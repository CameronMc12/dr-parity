'use client';

/**
 * Interactive map canvas. Renders the SVG world basemap + task markers inside a
 * pan/zoom viewport (drag to pan, wheel to zoom, plus +/− controls and a reset).
 * Zoom is clamped; pan is a simple translate so pins and silhouettes move
 * together. A derived-location footnote sits over the bottom edge.
 */

import { useCallback, useRef, useState } from 'react';
import type { Task } from '@/store/workspace/types';
import type { Cluster } from './geo';
import { MAP_H, MAP_W } from './geo';
import { MAP } from './tokens';
import { WorldMapBase } from './WorldMap';
import { MapMarkers } from './MapMarkers';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.5;

interface ViewportState {
  zoom: number;
  x: number;
  y: number;
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
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
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? MAP.hoverBg : MAP.panelBg,
        border: `1px solid ${MAP.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: MAP.textPrimary,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}

export function MapCanvas({
  clusters,
  expandedKey,
  onExpand,
  onOpen,
  onContextMenu,
  onHover,
  hoveredId,
}: {
  clusters: Cluster[];
  expandedKey: string | null;
  onExpand: (key: string) => void;
  onOpen: (taskId: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  onHover: (taskId: string | null) => void;
  hoveredId: string | null;
}) {
  const [view, setView] = useState<ViewportState>({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [panning, setPanning] = useState(false);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomBy = useCallback((delta: number) => {
    setView((prev) => {
      const zoom = clampZoom(prev.zoom + delta);
      if (zoom === MIN_ZOOM) return { zoom, x: 0, y: 0 };
      return { ...prev, zoom };
    });
  }, []);

  const reset = useCallback(() => setView({ zoom: 1, x: 0, y: 0 }), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return; // only zoom on intentional ctrl/⌘ + wheel
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setView((prev) => {
      const zoom = clampZoom(prev.zoom + delta);
      if (zoom === MIN_ZOOM) return { zoom, x: 0, y: 0 };
      return { ...prev, zoom };
    });
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (view.zoom === MIN_ZOOM) return;
      drag.current = { startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y };
      setPanning(true);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [view.zoom, view.x, view.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    setView((prev) => ({ ...prev, x: drag.current!.baseX + dx, y: drag.current!.baseY + dy }));
  }, []);

  const endPan = useCallback(() => {
    drag.current = null;
    setPanning(false);
  }, []);

  const canPan = view.zoom > MIN_ZOOM;

  return (
    <div
      data-testid="map-canvas"
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        background: MAP.oceanBg,
      }}
      onWheel={onWheel}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Task locations world map"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: canPan ? (panning ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          <WorldMapBase />
          <MapMarkers
            clusters={clusters}
            expandedKey={expandedKey}
            onExpand={onExpand}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onHover={onHover}
            hoveredId={hoveredId}
          />
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <ZoomButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
          +
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => zoomBy(-ZOOM_STEP)}>
          −
        </ZoomButton>
        <ZoomButton label="Reset view" onClick={reset}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 4v6h6M20 20v-6h-6"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 8a8 8 0 0 0-14-3M4 16a8 8 0 0 0 14 3"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </ZoomButton>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 14,
          fontSize: 11,
          color: MAP.textMuted,
          background: 'color-mix(in srgb, var(--cu-bg-app) 78%, transparent)',
          padding: '4px 8px',
          borderRadius: 6,
          pointerEvents: 'none',
        }}
      >
        Locations are derived from task ids for this preview.
      </div>
    </div>
  );
}
