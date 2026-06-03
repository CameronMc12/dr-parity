'use client';

/**
 * Tasteful "coming together" placeholder body rendered by every view skeleton
 * before its real renderer is filled in. Centred, muted, uses the view's own
 * coloured glyph so each placeholder reads as the right view type. Replaces the
 * old "Phase 3 / Route stub" stub.
 */

import { viewTypeByCode } from '@/lib/view-types';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_MUTED = 'var(--cu-text-muted)';

export function ComingTogether({ code }: { code: string }) {
  const type = viewTypeByCode(code);
  const Glyph = type?.Glyph;
  const label = type?.label ?? code;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        height: '100%',
        minHeight: 280,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          background: 'var(--cu-bg-hover)',
          border: '1px solid var(--cu-border-divider)',
        }}
      >
        {Glyph && <Glyph size={28} color={type?.color ?? 'rgb(160,164,172)'} />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT_PRIMARY }}>
        {label} view
      </div>
      <div style={{ fontSize: 13, color: TEXT_MUTED, maxWidth: 380, lineHeight: 1.5 }}>
        This view is coming together. Your tasks, dates, and settings are ready and
        will appear here as soon as the {label.toLowerCase()} layout lands.
      </div>
    </div>
  );
}
