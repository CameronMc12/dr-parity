'use client';

/**
 * An image placeholder dropped by the Image tool. ClickUp drops an upload
 * affordance before a file is attached; this renders that empty-state card
 * (mountain glyph + "Add image"). No real file I/O — purely the visual node.
 */

import type { ImageElement } from '../types';

export function ImagePlaceholder({ el: _el }: { el: ImageElement }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 8,
        border: '1.5px dashed rgba(91,100,114,0.5)',
        background: 'rgba(148,163,184,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: '#5b6472',
      }}
    >
      <svg
        width={32}
        height={32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="M21 16l-5-5L5 20" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 600 }}>Add image</span>
    </div>
  );
}
