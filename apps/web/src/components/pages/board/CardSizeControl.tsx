'use client';

/**
 * Board-only card-size toggle (ClickUp Customize → "Card size": Small / Medium /
 * Large). Sits above the lanes; flips the board-local card-size store so every
 * card resizes live. Rendered as a compact segmented control in dark tokens.
 */

import { BOARD, type CardSize } from './tokens';

const SIZES: { id: CardSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export function CardSizeControl({
  value,
  onChange,
}: {
  value: CardSize;
  onChange: (next: CardSize) => void;
}) {
  return (
    <div
      data-testid="board-card-size"
      role="radiogroup"
      aria-label="Card size"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: BOARD.cardRadius,
        background: BOARD.cardBg,
        border: `1px solid ${BOARD.border}`,
      }}
    >
      {SIZES.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-test={`board__card-size__${s.id}`}
            onClick={() => onChange(s.id)}
            style={{
              height: 22,
              padding: '0 8px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              background: active ? BOARD.cardHoverBg : 'transparent',
              color: active ? BOARD.textPrimary : BOARD.textMuted,
              transition: 'background 90ms, color 90ms',
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
