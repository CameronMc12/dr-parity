'use client';

/**
 * A board frame: a labelled rectangular container used to group content. Renders
 * a header label above a soft outlined area. The fill is fully transparent so
 * elements dropped inside remain visible through it. Pointer events pass through
 * the interior (the wrapping box still owns selection on its border via the
 * canvas); the label chip stays clickable for selection.
 */

import type { FrameElement } from '../types';

export function Frame({ el }: { el: FrameElement }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -22,
          maxWidth: '100%',
          padding: '2px 8px',
          fontSize: 12,
          fontWeight: 600,
          color: '#5b6472',
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {el.label}
      </div>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 8,
          border: '2px solid rgba(91,100,114,0.45)',
          background: 'rgba(148,163,184,0.06)',
        }}
      />
    </div>
  );
}
