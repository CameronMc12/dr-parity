'use client';

/**
 * SVG connector layer. Draws a smooth cubic-bezier curve from each parent's
 * right edge to each child's left edge. Sits behind the node cards inside the
 * transformed canvas, so it pans and zooms with them. Pure render keyed on the
 * memoised edge list.
 */

import { connectorPath, type MindEdge } from './layout';

const STROKE = 'var(--cu-border-strong, rgba(255,255,255,0.22))';

interface Props {
  edges: MindEdge[];
  width: number;
  height: number;
}

export function MindConnectors({ edges, width, height }: Props) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
      aria-hidden
    >
      {edges.map((edge) => (
        <path
          key={edge.id}
          d={connectorPath(edge.from, edge.to)}
          fill="none"
          stroke={STROKE}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
