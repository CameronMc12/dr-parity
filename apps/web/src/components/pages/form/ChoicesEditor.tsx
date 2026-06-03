'use client';

/**
 * Inline editor for a Dropdown field's choices. Lets the form builder add,
 * rename, and remove options 1:1 with ClickUp's dropdown configuration. Sits
 * under the live ChoiceSelect in the preview card.
 */

import { useRef, useState } from 'react';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

interface ChoicesEditorProps {
  choices: string[];
  onChange: (next: string[]) => void;
}

interface KeyedChoice {
  id: string;
  label: string;
}

export function ChoicesEditor({ choices, onChange }: ChoicesEditorProps) {
  const [open, setOpen] = useState(false);

  // Stable per-row ids so editable inputs reconcile correctly across removals.
  // The public API stays string[]; ids live only inside this component.
  const idCounter = useRef(0);
  const keyedRef = useRef<KeyedChoice[]>([]);
  // Reconcile the id list against the incoming choices by position, but track a
  // pending removal so a middle removal drops the right id instead of shifting.
  const pendingRemoveId = useRef<string | null>(null);
  if (pendingRemoveId.current) {
    keyedRef.current = keyedRef.current.filter((c) => c.id !== pendingRemoveId.current);
    pendingRemoveId.current = null;
  }
  keyedRef.current = choices.map((label, i) => {
    const prev = keyedRef.current[i];
    return { id: prev ? prev.id : `choice-${idCounter.current++}`, label };
  });
  const keyed = keyedRef.current;

  function renameAt(index: number, label: string) {
    onChange(choices.map((c, i) => (i === index ? label : c)));
  }

  function removeAt(index: number) {
    const id = keyedRef.current[index]?.id;
    if (id) pendingRemoveId.current = id;
    onChange(choices.filter((_, i) => i !== index));
  }

  function addChoice() {
    onChange([...choices, `Option ${choices.length + 1}`]);
  }

  return (
    <div>
      <EditToggle open={open} onClick={() => setOpen((o) => !o)} count={choices.length} />
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {keyed.map((choice, index) => (
            <ChoiceRow
              key={choice.id}
              value={choice.label}
              removable={choices.length > 1}
              onRename={(label) => renameAt(index, label)}
              onRemove={() => removeAt(index)}
            />
          ))}
          <AddChoiceButton onClick={addChoice} />
        </div>
      )}
    </div>
  );
}

function EditToggle({ open, onClick, count }: { open: boolean; onClick: () => void; count: number }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        padding: '2px 0',
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 600,
        color: hover ? T.textPrimary : T.textSecondary,
        cursor: 'pointer',
        transition: HOVER_TRANSITION,
      }}
    >
      <GearIcon />
      {open ? 'Done editing choices' : `Edit choices (${count})`}
    </button>
  );
}

function ChoiceRow({
  value,
  removable,
  onRename,
  onRemove,
}: {
  value: string;
  removable: boolean;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <input
        value={value}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Choice label"
        style={{
          flex: 1,
          minWidth: 0,
          height: 32,
          borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
          background: T.bgInput,
          color: T.textPrimary,
          fontFamily: T.font,
          fontSize: 13,
          padding: '6px 10px',
          outline: 'none',
          transition: HOVER_TRANSITION,
          boxSizing: 'border-box',
        }}
      />
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove choice"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: T.radiusSm,
            border: 'none',
            background: hover ? T.bgHover : 'transparent',
            color: T.textMuted,
            cursor: 'pointer',
            flexShrink: 0,
            transition: HOVER_TRANSITION,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = T.danger)}
          onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function AddChoiceButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        height: 30,
        padding: '0 8px',
        borderRadius: T.radiusSm,
        border: `1px dashed ${T.border}`,
        background: hover ? T.bgHover : 'transparent',
        color: T.textSecondary,
        fontFamily: T.font,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: HOVER_TRANSITION,
      }}
    >
      <PlusIcon />
      Add choice
    </button>
  );
}

function GearIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx={8} cy={8} r={2} stroke="currentColor" strokeWidth={1.3} />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M14.5 8h-1.4M2.9 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
