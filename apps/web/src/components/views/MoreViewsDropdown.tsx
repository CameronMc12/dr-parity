'use client';

/**
 * "N more…" overflow dropdown for the view-tab strip. Holds the views that don't
 * fit the available width; clicking one navigates to it (same handler the inline
 * tabs use). Closes on outside-click / Escape.
 */

import { useEffect, useRef, useState } from 'react';
import { viewTypeByCode } from '@/lib/view-types';
import type { View } from '@/store/views/types';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const MENU_BG = 'var(--cu-bg-menu)';
const BORDER = 'var(--cu-border-divider)';
const HOVER_BG = 'var(--cu-bg-hover)';

export function MoreViewsDropdown({
  views,
  activeCode,
  onSelect,
}: {
  views: View[];
  activeCode: string;
  onSelect: (view: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  if (views.length === 0) return null;

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        data-testid="viewtabs-more"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 8px',
          background: open ? HOVER_BG : 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: TEXT_SECONDARY,
          fontSize: 13,
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        {views.length} more…
      </button>

      {open && (
        <div
          role="menu"
          data-testid="viewtabs-more-menu"
          style={{
            position: 'absolute',
            top: 34,
            left: 0,
            zIndex: 50,
            minWidth: 180,
            padding: 6,
            background: MENU_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))',
          }}
        >
          {views.map((view) => {
            const type = viewTypeByCode(view.code);
            const Glyph = type?.Glyph;
            const active = view.code === activeCode;
            return (
              <button
                key={view.id + view.code}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect(view);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  height: 32,
                  padding: '0 8px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {Glyph && <Glyph size={15} color={type?.color ?? 'rgb(160,164,172)'} />}
                {view.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
