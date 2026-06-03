'use client';

/**
 * Embed empty state — 1:1 with the real ClickUp embed view.
 *
 * Capture anatomy (`cu2-dashboard-embed__empty`):
 *   - full-bleed surface, flex centered column, background --cu-background-subtle
 *   - 144×128 illustration: rounded square (rx 48) + triangle
 *   - title  "No embed displayed"  (medium / strong, margin-block 32 8)
 *   - desc   "Connect a URL or source to view content" (small, margin-bottom 20)
 *   - "Edit source" cu3button (outline, medium) → opens the source-config popover
 *
 * Rendered in our dark tokens; geometry/spacing/copy match the capture verbatim.
 */

import { forwardRef, useRef, useState } from 'react';
import { EMBED } from './tokens';
import { EmbedSourceConfig, type EmbedSource } from './EmbedSourceConfig';

export function EmbedEmptyState({
  source,
  onApply,
}: {
  source: EmbedSource | null;
  onApply: (source: EmbedSource) => void;
}) {
  const [configOpen, setConfigOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      data-testid="embed-empty"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: EMBED.emptyBg,
        position: 'relative',
      }}
    >
      <EmbedEmptyIllustration />

      <div
        style={{
          color: EMBED.textPrimary,
          fontSize: 15,
          fontWeight: 600,
          marginTop: 32,
          marginBottom: 8,
        }}
      >
        No embed displayed
      </div>

      <div style={{ color: EMBED.textSecondary, fontSize: 13, marginBottom: 20 }}>
        Connect a URL or source to view content
      </div>

      <EditSourceButton ref={btnRef} onClick={() => setConfigOpen(true)} />

      {configOpen && (
        <EmbedSourceConfig
          anchorRef={btnRef}
          initial={source}
          onClose={() => setConfigOpen(false)}
          onApply={(next) => {
            setConfigOpen(false);
            onApply(next);
          }}
        />
      )}
    </div>
  );
}

/** The circle-over-triangle mark from the capture (`width=144 height=128`). */
function EmbedEmptyIllustration() {
  return (
    <svg width={144} height={128} viewBox="0 0 144 128" fill="none" aria-hidden="true">
      <rect width={96} height={96} x={48} y={32} rx={48} fill={EMBED.illoRect} />
      <path d="m48 0 48 80H0L48 0Z" fill={EMBED.illoPath} />
    </svg>
  );
}

const EditSourceButton = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  function EditSourceButton({ onClick }, ref) {
    const [hover, setHover] = useState(false);
    return (
      <button
        ref={ref}
        type="button"
        data-testid="embed-edit-source"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          height: 36,
          padding: '0 16px',
          background: hover ? EMBED.hover : 'transparent',
          border: `1px solid ${EMBED.border}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: EMBED.textPrimary,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: EMBED.transition,
        }}
      >
        Edit source
      </button>
    );
  },
);
