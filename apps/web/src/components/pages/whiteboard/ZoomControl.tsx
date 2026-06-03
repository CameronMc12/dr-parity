'use client';

/**
 * Bottom-left zoom control for the whiteboard: "−  100%  +" plus a fit/expand
 * button that recentres the board. Matches ClickUp's dark pill. Every button is
 * real and drives the shared viewport API.
 */

// Dark floating pill, matching the real ClickUp whiteboard zoom control in dark
// mode. All surfaces use our dark --cu-* tokens.
const PILL_BG = 'var(--cu-bg-menu, #222222)';
const BORDER = 'var(--cu-border-divider, #363636)';
const ICON = 'var(--cu-text-secondary, #aaaaaa)';
const ICON_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.08))';

function StepButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: ICON_MUTED,
        fontSize: 18,
        lineHeight: 1,
        cursor: 'pointer',
        borderRadius: 6,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {glyph}
    </button>
  );
}

/** Leading double-chevron-up control: fits/recentres the board (real layout). */
function FitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Fit to screen"
      aria-label="Fit to screen"
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        color: ICON_MUTED,
        cursor: 'pointer',
        borderRadius: 6,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 13l6-6 6 6M6 18l6-6 6 6" />
      </svg>
    </button>
  );
}

export function ZoomControl({
  zoomPct,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitContent,
}: {
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitContent: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 10,
        background: PILL_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: 'var(--cu-shadow-md, 0 4px 12px rgba(0,0,0,0.55))',
        zIndex: 20,
      }}
    >
      <FitButton onClick={onFitContent} />
      <span
        aria-hidden
        style={{ width: 1, height: 18, margin: '0 2px', background: BORDER }}
      />
      <StepButton label="Zoom out" onClick={onZoomOut} glyph="−" />
      <button
        type="button"
        title="Reset zoom"
        aria-label="Reset zoom"
        onClick={onResetView}
        style={{
          minWidth: 52,
          height: 28,
          padding: '0 8px',
          border: 'none',
          background: 'transparent',
          color: ICON,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          borderRadius: 6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {Math.round(zoomPct)}%
      </button>
      <StepButton label="Zoom in" onClick={onZoomIn} glyph="+" />
    </div>
  );
}
