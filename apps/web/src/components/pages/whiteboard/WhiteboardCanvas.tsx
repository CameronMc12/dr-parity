'use client';

/**
 * The interactive infinite canvas. Owns pointer wiring for the empty surface:
 * panning (space-drag, or drag with the Select tool on empty space), wheel-pan,
 * ctrl/⌘-wheel zoom (cursor-anchored), and tool-click creation. The transformed
 * `world` div applies pan/zoom to every child; boxes render inside it (each
 * draggable on its own), connectors render in an SVG layer beneath them. The
 * dotted background scrolls with the pan so the grid feels infinite.
 *
 * Element state and the viewport API are both lifted to the parent view and
 * passed in — this component holds only ephemeral pan/drag refs, never mutating
 * the element list or viewport state outside event handlers (no render loops).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Task } from '@/store/workspace/types';
import { ConnectorLayer } from './ConnectorLayer';
import { ElementBox } from './ElementBox';
import type { BoardTheme } from './PresenceCluster';
import type { CanvasViewportApi } from './useCanvasViewport';
import {
  GRID,
  hasBox,
  type BoardBackground,
  type ConnectorElement,
  type ToolId,
  type WhiteboardElement,
} from './types';
import type { WhiteboardApi } from './useWhiteboard';

// The dark board surface is our app background token; the dotted grid is a
// subtle muted light dot so the infinite canvas reads on dark without glare.
const CANVAS_BG_LIGHT = '#f4f5f7';
const CANVAS_BG_DARK = 'var(--cu-bg-app, #111111)';
const DOT_LIGHT = 'rgba(20,30,55,0.14)';
const DOT_DARK = 'rgba(255,255,255,0.10)';

function isConnector(el: WhiteboardElement): el is ConnectorElement {
  return el.kind === 'connector';
}

/** CSS background layers for the canvas surface given the board settings. */
function backgroundStyle(
  background: BoardBackground,
  theme: BoardTheme,
  zoom: number,
  panX: number,
  panY: number,
): React.CSSProperties {
  const base = theme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;
  if (background === 'blank') return { background: base };
  const ink = theme === 'dark' ? DOT_DARK : DOT_LIGHT;
  const size = `${GRID * zoom}px ${GRID * zoom}px`;
  const position = `${panX}px ${panY}px`;
  if (background === 'grid') {
    return {
      background: base,
      backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
      backgroundSize: `${size}, ${size}`,
      backgroundPosition: `${position}, ${position}`,
    };
  }
  return {
    background: base,
    backgroundImage: `radial-gradient(${ink} 1.4px, transparent 1.4px)`,
    backgroundSize: size,
    backgroundPosition: position,
  };
}

export function WhiteboardCanvas({
  board,
  vp,
  activeTool,
  background,
  theme,
  onToolUsed,
  onContextMenu,
  taskFor,
}: {
  board: WhiteboardApi;
  vp: CanvasViewportApi;
  activeTool: ToolId;
  background: BoardBackground;
  theme: BoardTheme;
  onToolUsed: () => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  taskFor: (id: string) => Task | null;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number } | null>(null);

  const { viewport, toBoard, panBy, zoomAt } = vp;
  const { select, edit, add } = board;

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const point = localPoint(e.clientX, e.clientY);

      // Pan when holding Space (any tool), using the Hand tool, or using the
      // Select tool on empty space. Otherwise the active tool creates an element
      // at the click point.
      if (spaceDown || activeTool === 'hand' || activeTool === 'select') {
        select(null);
        edit(null);
        pan.current = { x: e.clientX, y: e.clientY };
        setPanning(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      const at = toBoard(point.x, point.y);
      add(activeTool, at.x, at.y);
      onToolUsed();
    },
    [spaceDown, activeTool, localPoint, toBoard, add, onToolUsed, select, edit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = pan.current;
      if (!p) return;
      panBy(e.clientX - p.x, e.clientY - p.y);
      pan.current = { x: e.clientX, y: e.clientY };
    },
    [panBy],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pan.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    pan.current = null;
    setPanning(false);
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const point = localPoint(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.deltaY < 0 ? 1.12 : 0.89, point.x, point.y);
        return;
      }
      panBy(-e.deltaX, -e.deltaY);
    },
    [localPoint, zoomAt, panBy],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' && !spaceDown) setSpaceDown(true);
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'z' || e.key === 'Z') &&
        !board.editingId
      ) {
        e.preventDefault();
        if (e.shiftKey) board.redo();
        else board.undo();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || e.key === 'Y') &&
        !board.editingId
      ) {
        e.preventDefault();
        board.redo();
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        board.selectedId &&
        !board.editingId
      ) {
        e.preventDefault();
        board.remove(board.selectedId);
      }
      if (e.key === 'Escape') {
        board.edit(null);
        board.select(null);
      }
    },
    [spaceDown, board],
  );

  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ') setSpaceDown(false);
  }, []);

  const { boxes, connectors } = useMemo(() => {
    const b = board.elements.filter(hasBox);
    const c = board.elements.filter(isConnector);
    return { boxes: b, connectors: c };
  }, [board.elements]);

  const selectMode = activeTool === 'select' && !spaceDown;
  const surfaceCursor = panning
    ? 'grabbing'
    : spaceDown || activeTool === 'hand'
      ? 'grab'
      : activeTool !== 'select'
        ? 'crosshair'
        : 'default';

  const surfaceBg = backgroundStyle(
    background,
    theme,
    viewport.zoom,
    viewport.panX,
    viewport.panY,
  );

  return (
    <div
      ref={surfaceRef}
      data-testid="whiteboard-canvas"
      tabIndex={0}
      role="application"
      aria-label="Whiteboard canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        outline: 'none',
        cursor: surfaceCursor,
        touchAction: 'none',
        ...surfaceBg,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <ConnectorLayer
          connectors={connectors}
          selectedId={board.selectedId}
          onSelect={select}
          onRemove={board.remove}
        />
        {boxes.map((el) => (
          <ElementBox
            key={el.id}
            el={el}
            zoom={viewport.zoom}
            selected={board.selectedId === el.id}
            editing={board.editingId === el.id}
            selectMode={selectMode}
            onSelect={select}
            onMove={board.move}
            onBeginEdit={edit}
            onChangeText={board.setText}
            onRemove={board.remove}
            onContextMenu={onContextMenu}
            taskFor={taskFor}
          />
        ))}
      </div>
    </div>
  );
}
