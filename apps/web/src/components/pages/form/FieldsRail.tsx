'use client';

/**
 * Left "Fields" rail of the Form view. Lists every ClickUp field type. Active
 * fields show a check + a remove control; inactive ones show a + to add. The
 * lead Task-name field is locked (always present, never removable).
 */

import { useState } from 'react';
import { FIELD_CATALOG, type FieldKey } from './form-fields';
import { FieldGlyph } from './field-glyphs';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

interface FieldsRailProps {
  active: FieldKey[];
  onAdd: (key: FieldKey) => void;
  onRemove: (key: FieldKey) => void;
}

export function FieldsRail({ active, onAdd, onRemove }: FieldsRailProps) {
  return (
    <aside
      style={{
        width: 256,
        flexShrink: 0,
        borderRight: `1px solid ${T.borderDivider}`,
        padding: '20px 12px',
        overflowY: 'auto',
        background: T.bgApp,
      }}
    >
      <div
        style={{
          padding: '0 8px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: T.textPrimary,
          letterSpacing: '0.01em',
        }}
      >
        Fields
      </div>
      <p style={{ padding: '0 8px 16px', margin: 0, fontSize: 12, lineHeight: 1.5, color: T.textMuted }}>
        Add fields to your form. Responses create tasks in this list.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {FIELD_CATALOG.map((def) => (
          <RailItem
            key={def.key}
            fieldKey={def.key}
            label={def.label}
            hint={def.hint}
            locked={def.locked}
            isActive={active.includes(def.key)}
            onAdd={() => onAdd(def.key)}
            onRemove={() => onRemove(def.key)}
          />
        ))}
      </div>
    </aside>
  );
}

interface RailItemProps {
  fieldKey: FieldKey;
  label: string;
  hint: string;
  locked: boolean;
  isActive: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function RailItem({ fieldKey, label, hint, locked, isActive, onAdd, onRemove }: RailItemProps) {
  const [hover, setHover] = useState(false);
  const interactive = !locked;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={interactive ? (isActive ? onRemove : onAdd) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                isActive ? onRemove() : onAdd();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 8px',
        borderRadius: T.radiusMd,
        cursor: interactive ? 'pointer' : 'default',
        background: hover && interactive ? T.bgHover : 'transparent',
        transition: HOVER_TRANSITION,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: T.radiusSm,
          background: isActive ? T.accent : T.bgActive,
          color: isActive ? '#fff' : T.textSecondary,
          flexShrink: 0,
        }}
      >
        <FieldGlyph field={fieldKey} size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: T.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: T.textMuted }}>{hint}</span>
      </span>
      <RailAffordance locked={locked} isActive={isActive} hover={hover} />
    </div>
  );
}

function RailAffordance({ locked, isActive, hover }: { locked: boolean; isActive: boolean; hover: boolean }) {
  if (locked) {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, color: T.textDisabled, letterSpacing: '0.04em' }}>
        REQUIRED
      </span>
    );
  }
  if (isActive) {
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          color: hover ? T.danger : T.accent,
          transition: HOVER_TRANSITION,
        }}
        aria-label="Remove field"
      >
        {hover ? <MinusIcon /> : <CheckIcon />}
      </span>
    );
  }
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, color: T.textSecondary }}
      aria-label="Add field"
    >
      <PlusIcon />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8h9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
