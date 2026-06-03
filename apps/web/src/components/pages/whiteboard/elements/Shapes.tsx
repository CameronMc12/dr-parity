'use client';

/**
 * Shape fills for the four whiteboard variants (rect / ellipse / triangle /
 * diamond). Pure presentational; size comes from the wrapping positioned box,
 * so each paints fill + stroke to 100% of it. Triangle and diamond are drawn as
 * an inline SVG so the stroke hugs the true polygon edge, not a bounding box.
 */

import type { ShapeElement } from '../types';

const RADIUS = 4;

export function ShapeView({ el }: { el: ShapeElement }) {
  if (el.variant === 'rect') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: el.fill,
          border: `2px solid ${el.stroke}`,
          borderRadius: RADIUS,
          boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
        }}
      />
    );
  }

  if (el.variant === 'ellipse') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: el.fill,
          border: `2px solid ${el.stroke}`,
          borderRadius: '50%',
          boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
        }}
      />
    );
  }

  // triangle / diamond — vector so the stroke traces the real polygon.
  const points =
    el.variant === 'triangle'
      ? '50,4 96,96 4,96'
      : '50,4 96,50 50,96 4,50';

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        display: 'block',
        filter: 'drop-shadow(0 4px 12px rgba(15,23,42,0.12))',
      }}
      aria-hidden
    >
      <polygon
        points={points}
        fill={el.fill}
        stroke={el.stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
