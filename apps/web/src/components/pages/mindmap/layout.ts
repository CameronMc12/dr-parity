/**
 * Pure tidy-tree layout for the Mind Map. Walks a root -> tasks -> subtasks
 * hierarchy and assigns each node an (x, y) on a left-to-right axis: x is driven
 * by depth (fixed column gap), y is distributed so siblings never overlap. The
 * algorithm is the classic two-pass approach — leaves are packed sequentially on
 * the y-axis, parents are centred over their children — which yields a stable,
 * deterministic layout suitable for `useMemo` memoisation.
 */

import type { Task } from '@/store/workspace/types';

export const NODE_W = 220;
export const NODE_H = 48;
/** Horizontal gap between a node's right edge and its children's left edge. */
export const COL_GAP = 96;
/** Vertical gap between sibling node centres at the densest level. */
export const ROW_GAP = 20;
/** Padding applied around the laid-out tree before it is centred on the canvas. */
export const CANVAS_PAD = 80;

export type MindNodeKind = 'root' | 'task' | 'subtask';

export interface MindInput {
  id: string;
  /** Display label (list name for the root, task name otherwise). */
  label: string;
  kind: MindNodeKind;
  /** Status accent. Root has no status. */
  statusColor?: string;
  status?: string;
  /** The backing task — absent for the synthetic root. */
  task?: Task;
  children: MindInput[];
}

export interface MindNode extends MindInput {
  x: number;
  y: number;
  depth: number;
  children: MindNode[];
  /** True when this node has children that are hidden because it is collapsed. */
  collapsed: boolean;
}

export interface MindEdge {
  id: string;
  from: MindNode;
  to: MindNode;
}

/** Anchor for the collapse/expand toggle that sits on a parent's outgoing fan. */
export interface MindToggle {
  /** The id of the node whose subtree this toggle collapses. */
  nodeId: string;
  /** Canvas-space centre of the toggle circle. */
  x: number;
  y: number;
  /** Whether the parent's subtree is currently collapsed. */
  collapsed: boolean;
}

export interface MindLayout {
  root: MindNode;
  nodes: MindNode[];
  edges: MindEdge[];
  toggles: MindToggle[];
  width: number;
  height: number;
}

/** Distance from a parent's right edge to its collapse-toggle centre. */
const TOGGLE_OFFSET = COL_GAP / 2;

const STEP_Y = NODE_H + ROW_GAP;
const STEP_X = NODE_W + COL_GAP;

/**
 * First pass: assign each node a y-centre. Leaves consume the next free slot;
 * internal nodes are centred over their first and last child. `cursor` is the
 * running slot index, threaded through the recursion via a one-element box.
 */
function assignY(node: MindNode, depth: number, cursor: { v: number }): void {
  node.depth = depth;
  node.x = depth * STEP_X;

  if (node.children.length === 0) {
    node.y = cursor.v * STEP_Y;
    cursor.v += 1;
    return;
  }

  for (const child of node.children) assignY(child, depth + 1, cursor);
  const first = node.children[0];
  const last = node.children[node.children.length - 1];
  if (!first || !last) {
    node.y = cursor.v * STEP_Y;
    return;
  }
  node.y = (first.y + last.y) / 2;
}

function collect(node: MindNode, nodes: MindNode[], edges: MindEdge[]): void {
  nodes.push(node);
  for (const child of node.children) {
    edges.push({ id: `${node.id}->${child.id}`, from: node, to: child });
    collect(child, nodes, edges);
  }
}

function toMindNode(input: MindInput, collapsed: ReadonlySet<string>): MindNode {
  const isCollapsed = collapsed.has(input.id) && input.children.length > 0;
  return {
    ...input,
    x: 0,
    y: 0,
    depth: 0,
    collapsed: isCollapsed,
    // A collapsed node keeps its children data but does not lay them out.
    children: isCollapsed ? [] : input.children.map((c) => toMindNode(c, collapsed)),
  };
}

/**
 * Build a fully-positioned layout from a hierarchical input tree. `collapsed`
 * holds node ids whose subtrees should be hidden; such nodes still render a
 * collapse toggle (in the "+"/expand state) so the user can re-open them.
 */
export function buildLayout(
  input: MindInput,
  collapsed: ReadonlySet<string> = new Set(),
): MindLayout {
  const root = toMindNode(input, collapsed);
  assignY(root, 0, { v: 0 });

  const nodes: MindNode[] = [];
  const edges: MindEdge[] = [];
  collect(root, nodes, edges);

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }

  // Shift the whole tree into the padded canvas origin.
  for (const n of nodes) {
    n.x += CANVAS_PAD;
    n.y += CANVAS_PAD;
  }

  // A toggle sits on the fan of any node that has children (rendered) or is
  // collapsed (children hidden). Centre it in the gap to the right of the node.
  const toggles: MindToggle[] = [];
  for (const n of nodes) {
    const hasRenderedChildren = n.children.length > 0;
    if (!hasRenderedChildren && !n.collapsed) continue;
    toggles.push({
      nodeId: n.id,
      x: n.x + NODE_W + TOGGLE_OFFSET,
      y: n.y + NODE_H / 2,
      collapsed: n.collapsed,
    });
  }

  return {
    root,
    nodes,
    edges,
    toggles,
    width: maxX + CANVAS_PAD * 2,
    height: maxY + CANVAS_PAD * 2,
  };
}

/** Radius of the collapse/expand toggle circle that the fan originates from. */
export const TOGGLE_R = 10;

/**
 * Cubic-bezier path from a parent's collapse toggle to a child's left edge,
 * mirroring ClickUp's fan: the line leaves the toggle circle, runs flat for a
 * short stub, then curves smoothly into each child. Inputs are node top-left
 * coordinates.
 */
export function connectorPath(from: MindNode, to: MindNode): string {
  // Origin = the toggle circle on the parent's fan, not the card edge.
  const x1 = from.x + NODE_W + TOGGLE_OFFSET + TOGGLE_R;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}
