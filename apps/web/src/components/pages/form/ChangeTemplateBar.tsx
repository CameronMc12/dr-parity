'use client';

/**
 * Thin bar above the builder that names the active template and offers a
 * "Change template" affordance, which returns the Form view to the chooser.
 * Keeps the builder honest about where its starting field set came from.
 */

import { useState } from 'react';
import { findTemplate, type TemplateId } from './form-templates';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

function templateLabel(template: TemplateId): string {
  return template === 'scratch' ? 'Custom Form' : findTemplate(template)?.name ?? 'Form';
}

export function ChangeTemplateBar({
  template,
  onChangeTemplate,
}: {
  template: TemplateId;
  onChangeTemplate: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 16px',
        borderBottom: `1px solid ${T.borderDivider}`,
        background: T.bgApp,
        fontFamily: T.font,
        flexShrink: 0,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>Template</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: T.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {templateLabel(template)}
        </span>
      </span>
      <button
        type="button"
        onClick={onChangeTemplate}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 10px',
          borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
          background: hover ? T.bgHover : 'transparent',
          color: T.textSecondary,
          fontFamily: T.font,
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          transition: HOVER_TRANSITION,
          flexShrink: 0,
        }}
      >
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M9.5 3.5L5 8l4.5 4.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Change template
      </button>
    </div>
  );
}
