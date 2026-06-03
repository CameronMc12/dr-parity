'use client';

/**
 * One labelled field inside the form preview: label + required marker + remove
 * control on hover, the bound input below, and an inline validation message.
 */

import { useState, type ReactNode } from 'react';
import { fieldDef, type FieldKey } from './form-fields';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

interface FormFieldRowProps {
  fieldKey: FieldKey;
  error?: string;
  removable: boolean;
  onRemove: () => void;
  children: ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FormFieldRow({ fieldKey, error, removable, onRemove, children, onContextMenu }: FormFieldRowProps) {
  const def = fieldDef(fieldKey);
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenu={onContextMenu}
      style={{ marginBottom: 22, position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 4 }}>
          {def.label}
          {def.locked && <span style={{ color: T.danger }}>*</span>}
        </label>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              opacity: hover ? 1 : 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: T.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: T.radiusSm,
              transition: 'opacity 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.danger)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
            aria-label={`Remove ${def.label} field`}
          >
            <TrashIcon />
            Remove
          </button>
        )}
      </div>
      {children}
      {error && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: T.danger, transition: HOVER_TRANSITION }}>{error}</p>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4.5V3.5a1 1 0 011-1h1a1 1 0 011 1v1M5 4.5l.6 8a1 1 0 001 .9h2.8a1 1 0 001-.9l.6-8"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
