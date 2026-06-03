'use client';

/**
 * Option-backed cell editors (dropdown + labels). Split out of CustomFieldCell
 * to keep each file focused. Both read the field's `options`, resolve the
 * task's stored value (an option id for dropdown, an id[] for labels), and write
 * back via setCustomFieldValue. The picker reuses the shared Menu primitive.
 */

import { useMemo, useState } from 'react';
import { Menu } from '@/components/ui/Menu';
import { PickerRow, CheckMark } from '@/components/pages/listview/menu-parts';
import { useCustomFieldActions } from '@/store/workspace/custom-fields-hooks';
import type {
  CustomFieldDef,
  CustomFieldOption,
} from '@/store/workspace/custom-fields';
import { LV } from '@/components/pages/listview/tokens';

function Chip({
  option,
  onRemove,
}: {
  option: CustomFieldOption;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 18,
        padding: '0 7px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1,
        color: '#fff',
        background: option.color,
        maxWidth: '100%',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {option.label}
      </span>
      {onRemove && (
        <button
          aria-label={`Remove ${option.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            opacity: 0.85,
            padding: 0,
          }}
        >
          <svg width={9} height={9} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ── Dropdown (single select) ─────────────────────────────────────────────────

export function DropdownCell({ taskId, field, value }: OptionCellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const options = field.options ?? [];
  const selected = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  return (
    <Menu
      width={220}
      align="left"
      trigger={({ ref, onClick }) => (
        <TriggerButton btnRef={ref} onClick={onClick}>
          {selected ? <Chip option={selected} /> : <Placeholder />}
        </TriggerButton>
      )}
    >
      {options.length === 0 && <EmptyOptions />}
      {options.map((o) => (
        <PickerRow
          key={o.id}
          onClick={() => setCustomFieldValue(taskId, field.id, o.id)}
          active={o.id === value}
          trailing={o.id === value ? <CheckMark /> : undefined}
        >
          <Chip option={o} />
        </PickerRow>
      ))}
      {selected && (
        <PickerRow onClick={() => setCustomFieldValue(taskId, field.id, undefined)}>
          <span style={{ fontSize: 12, color: LV.textMuted }}>Clear</span>
        </PickerRow>
      )}
    </Menu>
  );
}

// ── Labels (multi select) ────────────────────────────────────────────────────

export function LabelsCell({ taskId, field, value }: OptionCellProps) {
  const { setCustomFieldValue } = useCustomFieldActions();
  const options = field.options ?? [];
  const selectedIds = useMemo(
    () => (Array.isArray(value) ? (value as string[]) : []),
    [value],
  );
  const selected = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds],
  );

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((v) => v !== id)
      : [...selectedIds, id];
    setCustomFieldValue(taskId, field.id, next);
  };

  return (
    <Menu
      width={220}
      align="left"
      trigger={({ ref, onClick }) => (
        <TriggerButton btnRef={ref} onClick={onClick}>
          {selected.length === 0 ? (
            <Placeholder />
          ) : (
            <span style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden' }}>
              {selected.map((o) => (
                <Chip key={o.id} option={o} onRemove={() => toggle(o.id)} />
              ))}
            </span>
          )}
        </TriggerButton>
      )}
    >
      {options.length === 0 && <EmptyOptions />}
      {options.map((o) => {
        const on = selectedIds.includes(o.id);
        return (
          <PickerRow
            key={o.id}
            onClick={() => toggle(o.id)}
            active={on}
            trailing={on ? <CheckMark /> : undefined}
          >
            <Chip option={o} />
          </PickerRow>
        );
      })}
    </Menu>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

export interface OptionCellProps {
  taskId: string;
  field: CustomFieldDef;
  value: unknown;
}

function TriggerButton({
  btnRef,
  onClick,
  children,
}: {
  btnRef: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 30,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Placeholder() {
  return <span style={{ fontSize: 12, color: LV.textMuted }}>—</span>;
}

function EmptyOptions() {
  return (
    <div style={{ padding: '10px 14px', fontSize: 12, color: LV.textMuted }}>
      No options yet
    </div>
  );
}
