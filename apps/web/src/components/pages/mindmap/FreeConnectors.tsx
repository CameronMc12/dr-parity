'use client';

/**
 * SVG layer for the Freeform board. Draws a bezier for every committed edge,
 * plus a live "rubber-band" bezier while the user is dragging from a node's
 * handle to an empty point. Sits behind the node cards inside the transformed
 * stage, so it pans and zooms with them.
 */

import {
  type FreeEdge,
  type FreeNode,
  freeEdgePath,
  FREE_NODE_H,
  FREE_NODE_W,
} from './freeform-model';

const STROKE = 'var(--cu-border-strong, rgba(255,255,255,0.24))';
const STROKE_DRAFT = 'var(--cu-accent, #4ecdc4)';

interface Props {
  nodes: FreeNode[];
  edges: FreeEdge[];
  width: number;
  height: number;
  /** Live drag-in-progress: from node id + current canvas-space cursor point. */
  draft: { from: string; x: number; y: number } | null;
}

export function FreeConnectors({ nodes, edges, width, height, draft }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      aria-hidden
    >
      {edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
        if (!from || !to) return null;
        return (
          <path
            key={edge.id}
            d={freeEdgePath(from, to)}
            fill="none"
            stroke={STROKE}
            strokeWidth={1.75}
          />
        );
      })}

      {draft &&
        (() => {
          const from = byId.get(draft.from);
          if (!from) return null;
          const x1 = from.x + FREE_NODE_W / 2;
          const y1 = from.y + FREE_NODE_H / 2;
          const dx = Math.abs(draft.x - x1) * 0.5;
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${draft.x - dx} ${draft.y}, ${draft.x} ${draft.y}`;
          return (
            <path
              d={d}
              fill="none"
              stroke={STROKE_DRAFT}
              strokeWidth={1.75}
              strokeDasharray="5 4"
            />
          );
        })()}
    </svg>
  );
}
