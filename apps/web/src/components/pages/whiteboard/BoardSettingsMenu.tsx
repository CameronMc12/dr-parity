'use client';

/**
 * Board-settings popover opened by the Presence cluster's gear: pick the canvas
 * background (dots / grid / blank) and the board theme (light / dark). Pure
 * presentational; the active values + setters come from the whiteboard view.
 */

import type { BoardBackground } from './types';

const PILL_BG = 'var(--cu-bg-menu, #1f2127)';
const BORDER = 'var(--cu-border-divider, rgba(255,255,255,0.1))';
const HOVER_BG = 'var(--cu-bg-hover, rgba(255,255,255,0.08))';
const TEXT = 'var(--cu-text-primary, #e8eaed)';
const MUTED = 'var(--cu-text-muted, #8a8f99)';
const ACCENT = 'var(--cu-accent, #4ecdc4)';

export type BoardTheme = 'light' | 'dark';

function swatchImage(value: BoardBackground): string {
  if (value === 'dots') {
    return 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)';
  }
  if (value === 'grid') {
    return 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)';
  }
  return 'none';
}

function BackgroundRow({
  value,
  current,
  label,
  onPick,
}: {
  value: BoardBackground;
  current: BoardBackground;
  label: string;
  onPick: (v: BoardBackground) => void;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={() => onPick(value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        border: 'none',
        background: selected ? HOVER_BG : 'transparent',
        color: TEXT,
        fontSize: 13,
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: 6,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = selected ? HOVER_BG : 'transparent')
      }
    >
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: `1px solid ${BORDER}`,
          backgroundColor: '#2a2d35',
          backgroundImage: swatchImage(value),
          backgroundSize: value === 'blank' ? 'auto' : '5px 5px',
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

export function BoardSettingsMenu({
  background,
  theme,
  onBackground,
  onTheme,
}: {
  background: BoardBackground;
  theme: BoardTheme;
  onBackground: (v: BoardBackground) => void;
  onTheme: (t: BoardTheme) => void;
}) {
  return (
    <div
      role="menu"
      aria-label="Board settings"
      style={{
        position: 'absolute',
        right: 0,
        top: 'calc(100% + 8px)',
        width: 200,
        padding: 6,
        borderRadius: 10,
        background: PILL_BG,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
      }}
    >
      <SectionLabel>Background</SectionLabel>
      <BackgroundRow
        value="dots"
        current={background}
        label="Dots"
        onPick={onBackground}
      />
      <BackgroundRow
        value="grid"
        current={background}
        label="Grid"
        onPick={onBackground}
      />
      <BackgroundRow
        value="blank"
        current={background}
        label="Blank"
        onPick={onBackground}
      />
      <span
        aria-hidden
        style={{
          display: 'block',
          height: 1,
          margin: '6px 0',
          background: BORDER,
        }}
      />
      <SectionLabel>Theme</SectionLabel>
      <div style={{ display: 'flex', gap: 4, padding: '2px 4px 4px' }}>
        {(['light', 'dark'] as const).map((t) => {
          const selected = t === theme;
          return (
            <button
              key={t}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onTheme(t)}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 6,
                border: `1px solid ${selected ? ACCENT : BORDER}`,
                background: selected
                  ? 'var(--cu-accent-subtle, rgba(78,205,196,0.18))'
                  : 'transparent',
                color: TEXT,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
