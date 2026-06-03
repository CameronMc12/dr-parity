'use client';

/**
 * Freeform Mind Map canvas. A blank, pannable, zoomable board:
 *   - double-click empty space  -> add an editable node there
 *   - drag a node body          -> move it
 *   - drag a node's edge handle -> rubber-band to a target node to connect
 *   - right-click a node        -> edit / convert to task / delete
 *   - Delete / Backspace        -> remove the selected node
 * Pan/zoom + fit reuse the shared controller; nodes & edges persist per view.
 * Converting a node creates a real task in the workspace and links the id.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import {
  boardBounds,
  CANVAS_HINT,
  type FreeNode,
  FREE_NODE_H,
  FREE_NODE_W,
} from './freeform-model';
import { FreeConnectors } from './FreeConnectors';
import { FreeNodeCard } from './FreeNodeCard';
import { FreeNodeMenu, type FreeNodeMenuState } from './FreeNodeMenu';
import { MindControls } from './MindControls';
import { usePanZoom } from './use-pan-zoom';
import { useFreeform } from './use-freeform';

const CANVAS_BG = 'var(--cu-bg-app, rgb(20,20,20))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(120,120,120))';
const CANVAS_PAD = 160;

interface DragState {
  kind: 'move' | 'link';
  nodeId: string;
  /** Offset from node origin to pointer, in canvas space (move only). */
  offX: number;
  offY: number;
}

export function FreeformCanvas({
  viewId,
  listId,
}: {
  viewId: string;
  listId: string;
}) {
  const { board, addNode, moveNode, renameNode, deleteNode, connect, setNodeTask } =
    useFreeform(viewId);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const openTask = useUiStore((s) => s.openTask);

  const pz = usePanZoom();
  // fit is a stable useCallback inside usePanZoom; pulling it out keeps runFit's
  // memoization intact (pz itself is a fresh object literal every render).
  const { fit } = pz;
  const viewportRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<FreeNodeMenuState | null>(null);
  const [draft, setDraft] = useState<{ from: string; x: number; y: number } | null>(
    null,
  );
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const drag = useRef<DragState | null>(null);

  const bounds = useMemo(() => boardBounds(board, CANVAS_PAD), [board]);
  // Top-left of the content box in canvas space. The stage content is shifted
  // by -(originX, originY) so the bounding box maps from 0, which is what
  // bounds.width/height and the fit() maths assume.
  const originX = bounds.minX - CANVAS_PAD;
  const originY = bounds.minY - CANVAS_PAD;

  // Convert a screen point to canvas (stage) space using the live transform.
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      const t = pz.transform;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: (clientX - rect.left - t.x) / t.scale,
        y: (clientY - rect.top - t.y) / t.scale,
      };
    },
    [pz.transform],
  );

  const runFit = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    fit(bounds.width, bounds.height, el.clientWidth, el.clientHeight, originX, originY);
  }, [fit, bounds.width, bounds.height, originX, originY]);

  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Ignore double-clicks that land on a node (those edit instead).
      if ((e.target as HTMLElement).closest('[data-testid="freeform-node"]')) return;
      const p = toCanvas(e.clientX, e.clientY);
      const id = addNode(p.x - FREE_NODE_W / 2, p.y - FREE_NODE_H / 2);
      setSelectedId(id);
      setEditingId(id);
    },
    [addNode, toCanvas],
  );

  // ── Node body drag (move) ──────────────────────────────────────────────
  const onBodyPointerDown = useCallback(
    (e: React.PointerEvent, node: FreeNode) => {
      e.stopPropagation();
      setSelectedId(node.id);
      setMenu(null);
      const p = toCanvas(e.clientX, e.clientY);
      drag.current = {
        kind: 'move',
        nodeId: node.id,
        offX: p.x - node.x,
        offY: p.y - node.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [toCanvas],
  );

  // ── Handle drag (connect) ──────────────────────────────────────────────
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent, node: FreeNode) => {
      e.stopPropagation();
      const p = toCanvas(e.clientX, e.clientY);
      drag.current = { kind: 'link', nodeId: node.id, offX: 0, offY: 0 };
      setDraft({ from: node.id, x: p.x, y: p.y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [toCanvas],
  );

  const onStagePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = toCanvas(e.clientX, e.clientY);
      if (d.kind === 'move') {
        moveNode(d.nodeId, p.x - d.offX, p.y - d.offY);
        return;
      }
      // link: update rubber-band + detect a hovered target node
      setDraft({ from: d.nodeId, x: p.x, y: p.y });
      const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest('[data-node-id]') as HTMLElement | null;
      const targetId = el?.getAttribute('data-node-id') ?? null;
      setHoverTarget(targetId && targetId !== d.nodeId ? targetId : null);
    },
    [moveNode, toCanvas],
  );

  const onStagePointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === 'link' && hoverTarget) connect(d.nodeId, hoverTarget);
    setDraft(null);
    setHoverTarget(null);
  }, [connect, hoverTarget]);

  // ── Node context menu ──────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: FreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(node.id);
    setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY, isTask: Boolean(node.taskId) });
  }, []);

  const handleConvert = useCallback(
    (id: string) => {
      const node = board.nodes.find((n) => n.id === id);
      if (!node || node.taskId) return;
      const task = createTask({ name: node.text || 'New Task', listId });
      setNodeTask(id, task.id);
      openTask(task.id);
    },
    [board.nodes, createTask, listId, openTask, setNodeTask],
  );

  const onCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteNode(selectedId);
        setSelectedId(null);
      }
    },
    [deleteNode, editingId, selectedId],
  );

  const empty = board.nodes.length === 0;

  return (
    <div
      ref={viewportRef}
      data-testid="freeform-canvas"
      tabIndex={0}
      onPointerDown={(e) => {
        // Only the empty canvas starts a pan (nodes stop propagation).
        setMenu(null);
        setSelectedId(null);
        pz.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        onStagePointerMove(e);
        if (!drag.current) pz.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        onStagePointerUp();
        pz.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        onStagePointerUp();
        pz.onPointerUp(e);
      }}
      onWheel={pz.onWheel}
      onDoubleClick={onCanvasDoubleClick}
      onKeyDown={onCanvasKeyDown}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        width: '100%',
        outline: 'none',
        background: CANVAS_BG,
        backgroundImage:
          'radial-gradient(var(--cu-border-divider, rgba(255,255,255,0.06)) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        overflow: 'hidden',
        cursor: pz.dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      {empty && (
        <div
          data-testid="freeform-empty"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: TEXT_MUTED,
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          {CANVAS_HINT}
        </div>
      )}

      <div
        data-testid="freeform-stage"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transformOrigin: '0 0',
          transform: `translate(${pz.transform.x}px, ${pz.transform.y}px) scale(${pz.transform.scale})`,
          willChange: 'transform',
        }}
      >
        <FreeConnectors
          nodes={board.nodes}
          edges={board.edges}
          width={bounds.width}
          height={bounds.height}
          draft={draft}
        />
        {board.nodes.map((node) => (
          <FreeNodeCard
            key={node.id}
            node={node}
            editing={editingId === node.id}
            linkTarget={hoverTarget === node.id}
            onBodyPointerDown={onBodyPointerDown}
            onHandlePointerDown={onHandlePointerDown}
            onStartEdit={setEditingId}
            onCommitEdit={(id, text) => {
              renameNode(id, text);
              setEditingId(null);
            }}
            onContextMenu={onNodeContextMenu}
          />
        ))}
      </div>

      <MindControls
        scale={pz.transform.scale}
        onZoomIn={pz.zoomIn}
        onZoomOut={pz.zoomOut}
        onZoomTo={(s) => pz.zoomTo(s)}
      />

      {menu && (
        <FreeNodeMenu
          state={menu}
          onClose={() => setMenu(null)}
          onEdit={(id) => setEditingId(id)}
          onConvert={handleConvert}
          onDelete={(id) => {
            deleteNode(id);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
