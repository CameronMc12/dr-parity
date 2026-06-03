'use client';

/**
 * Post-submit confirmation card. Mirrors ClickUp's "Response submitted" state
 * with a check badge, the form title, and a "Submit another response" reset.
 */

import { useState } from 'react';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

export function FormSuccess({
  title,
  createdName,
  onReset,
}: {
  title: string;
  createdName: string;
  onReset: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        boxShadow: T.shadowMd,
        padding: '48px 40px',
        textAlign: 'center',
        animation: 'cu-form-pop 220ms ease-out',
      }}
    >
      <style>{`@keyframes cu-form-pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: T.accent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
        }}
      >
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: T.textPrimary }}>Response submitted</h2>
      <p style={{ margin: '0 0 4px', fontSize: 14, color: T.textSecondary }}>
        Your response to <strong style={{ color: T.textPrimary }}>{title}</strong> was recorded.
      </p>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: T.textMuted }}>
        Created task: <span style={{ color: T.textSecondary }}>{createdName}</span>
      </p>
      <button
        type="button"
        onClick={onReset}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          height: 40,
          padding: '0 20px',
          borderRadius: T.radiusMd,
          border: `1px solid ${T.border}`,
          background: hover ? T.bgHover : 'transparent',
          color: T.textPrimary,
          fontFamily: T.font,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: HOVER_TRANSITION,
        }}
      >
        Submit another response
      </button>
    </div>
  );
}
