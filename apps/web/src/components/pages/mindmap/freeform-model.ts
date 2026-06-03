/**
 * Pure data model + localStorage persistence for the Freeform Mind Map. Nodes
 * are free-positioned cards with editable text; edges are directed connections
 * drawn as beziers. Everything is keyed by viewId so each view keeps its own
 * board. No React here — just types and serialisation helpers.
 */

export const FREE_NODE_W = 168;
export const FREE_NODE_H = 52;

/** Empty-state hint shown on a blank Freeform board. */
export const CANVAS_HINT = 'Double-click anywhere to add your first idea.';

export interface FreeNode {
  id: string;
  x: number;
  y: number;
  text: string;
  /** Set once this node has been converted into a real task. */
  taskId?: string;
}

export interface FreeEdge {
  id: string;
  from: string;
  to: string;
}

export interface FreeBoard {
  nodes: FreeNode[];
  edges: FreeEdge[];
}

export const EMPTY_BOARD: FreeBoard = { nodes: [], edges: [] };

const KEY_PREFIX = 'cu-mindmap-freeform:';

function storageKey(viewId: string): string {
  return `${KEY_PREFIX}${viewId}`;
}

function isFreeNode(v: unknown): v is FreeNode {
  if (typeof v !== 'object' || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.x === 'number' &&
    typeof n.y === 'number' &&
    typeof n.text === 'string'
  );
}

function isFreeEdge(v: unknown): v is FreeEdge {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.from === 'string' &&
    typeof e.to === 'string'
  );
}

export function loadBoard(viewId: string): FreeBoard {
  if (typeof window === 'undefined') return EMPTY_BOARD;
  try {
    const raw = window.localStorage.getItem(storageKey(viewId));
    if (!raw) return EMPTY_BOARD;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_BOARD;
    const obj = parsed as Record<string, unknown>;
    const nodes = Array.isArray(obj.nodes) ? obj.nodes.filter(isFreeNode) : [];
    const edges = Array.isArray(obj.edges) ? obj.edges.filter(isFreeEdge) : [];
    return { nodes, edges };
  } catch {
    return EMPTY_BOARD;
  }
}

export function saveBoard(viewId: string, board: FreeBoard): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(viewId), JSON.stringify(board));
  } catch {
    // Storage unavailable; keep the in-memory board only.
  }
}

let freeSeq = 0;

export function newNodeId(): string {
  freeSeq += 1;
  return `fn-${Date.now().toString(36)}-${freeSeq}`;
}

export function newEdgeId(): string {
  freeSeq += 1;
  return `fe-${Date.now().toString(36)}-${freeSeq}`;
}

/**
 * Padded bounding box of all nodes — used by fit-to-screen on the canvas.
 * Tracks both min and max so nodes placed in negative canvas space (reachable
 * after panning) are included. `minX`/`minY` give the top-left of the content;
 * the canvas offsets its stage origin by (minX - pad, minY - pad) so fit
 * centres on the real content rather than excluding the negative quadrant.
 */
export function boardBounds(board: FreeBoard, pad: number): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  const first = board.nodes[0];
  if (!first) {
    return { width: 1200, height: 800, minX: 0, minY: 0 };
  }
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + FREE_NODE_W;
  let maxY = first.y + FREE_NODE_H;
  for (const n of board.nodes.slice(1)) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + FREE_NODE_W);
    maxY = Math.max(maxY, n.y + FREE_NODE_H);
  }
  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    minX,
    minY,
  };
}

/** Bezier from one free node's centre-right to another's centre-left. */
export function freeEdgePath(from: FreeNode, to: FreeNode): string {
  const x1 = from.x + FREE_NODE_W / 2;
  const y1 = from.y + FREE_NODE_H / 2;
  const x2 = to.x + FREE_NODE_W / 2;
  const y2 = to.y + FREE_NODE_H / 2;
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}
