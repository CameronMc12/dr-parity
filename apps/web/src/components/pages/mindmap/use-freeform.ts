/**
 * Stateful controller for the Freeform board: add / move / rename / delete nodes,
 * connect / disconnect edges, and convert a node into a real task. Loads the
 * board from localStorage on mount (per viewId) and writes back on every change.
 * All updates go through functional setState; selectors never leak fresh objects.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMPTY_BOARD,
  type FreeBoard,
  type FreeEdge,
  type FreeNode,
  loadBoard,
  newEdgeId,
  newNodeId,
  saveBoard,
} from './freeform-model';

export interface FreeformApi {
  board: FreeBoard;
  addNode: (x: number, y: number) => string;
  moveNode: (id: string, x: number, y: number) => void;
  renameNode: (id: string, text: string) => void;
  deleteNode: (id: string) => void;
  connect: (from: string, to: string) => void;
  setNodeTask: (id: string, taskId: string) => void;
}

export function useFreeform(viewId: string): FreeformApi {
  const [board, setBoard] = useState<FreeBoard>(EMPTY_BOARD);
  // Tracks which viewId the board currently in state was loaded for. Until the
  // async setBoard from effect 1 lands, this stays as the previous view (or
  // null on first mount), so effect 2 will not persist a board under a view it
  // does not belong to.
  const loadedForView = useRef<string | null>(null);

  // Load this view's persisted board after mount (SSR-safe). We do NOT set
  // loadedForView here — effect 2 sets it once the new board has actually
  // landed in state, which is the only moment it is safe to persist.
  useEffect(() => {
    setBoard(loadBoard(viewId));
    return () => {
      loadedForView.current = null;
    };
  }, [viewId]);

  // Persist on every change, but only once the board in state belongs to the
  // current viewId. On a viewId change both effects flush together: effect 1
  // queues setBoard(newView) while `board` here is still the OLD view's data.
  // loadedForView is null at that point (cleared by the cleanup above), so we
  // skip and merely adopt the new view without writing the stale board. The
  // next render — with the freshly loaded board — runs this effect again, now
  // marks loadedForView = viewId, and from then on real edits persist normally.
  useEffect(() => {
    if (loadedForView.current !== viewId) {
      loadedForView.current = viewId;
      return;
    }
    saveBoard(viewId, board);
  }, [viewId, board]);

  const addNode = useCallback((x: number, y: number): string => {
    const id = newNodeId();
    const node: FreeNode = { id, x, y, text: 'New idea' };
    setBoard((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    return id;
  }, []);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setBoard((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const renameNode = useCallback((id: string, text: string) => {
    setBoard((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, text } : n)),
    }));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setBoard((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== id),
      edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
    }));
  }, []);

  const connect = useCallback((from: string, to: string) => {
    if (from === to) return;
    setBoard((prev) => {
      const exists = prev.edges.some((e) => e.from === from && e.to === to);
      if (exists) return prev;
      const edge: FreeEdge = { id: newEdgeId(), from, to };
      return { ...prev, edges: [...prev.edges, edge] };
    });
  }, []);

  const setNodeTask = useCallback((id: string, taskId: string) => {
    setBoard((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, taskId } : n)),
    }));
  }, []);

  return { board, addNode, moveNode, renameNode, deleteNode, connect, setNodeTask };
}
