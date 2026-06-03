'use client';

/**
 * Workload footer overlays: the bottom-left "Show N person without scheduled
 * tasks in this period" reveal link and the bottom-right +/- zoom stepper. Both
 * float over the grid via absolute positioning so they never push the scroll
 * track. Pure presentational controls driven by the view's state.
 */

import { useState } from 'react';
import { WL } from './tokens';

export function EmptyLanesLink({
  count,
  showEmpty,
  onToggle,
  topOffset,
}: {
  count: number;
  showEmpty: boolean;
  onToggle: () => void;
  /** Distance from the grid top to just below the last visible lane row. */
  topOffset: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        position: 'absolute',
        left: WL.labelColWidth,
        right: 0,
        top: topOffset,
        zIndex: 4,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <button
        data-testid="workload-show-empty"
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          pointerEvents: 'auto',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: WL.textMuted,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.4,
          textAlign: 'center',
          textDecoration: hover ? 'underline' : 'none',
          fontFamily: 'inherit',
          maxWidth: 320,
        }}
      >
        {showEmpty ? 'Hide' : 'Show'} {count} {count === 1 ? 'person' : 'people'} without scheduled tasks in this period
      </button>
    </div>
  );
}

export function ZoomControl({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 12,
        zIndex: 5,
        display: 'inline-flex',
        height: 28,
        background: WL.menuBg,
        border: `1px solid ${WL.gridBorderStrong}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <ZoomButton label="Zoom out" testid="workload-zoom-out" onClick={onZoomOut}>
        −
      </ZoomButton>
      <span style={{ width: 1, background: WL.gridBorder }} />
      <ZoomButton label="Zoom in" testid="workload-zoom-in" onClick={onZoomIn}>
        +
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
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
      data-testid={testid}
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30,
        height: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? WL.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: WL.textSecondary,
        fontSize: 16,
        fontWeight: 600,
        lineHeight: 1,
        fontFamily: 'inherit',
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}
