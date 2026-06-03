'use client';

/**
 * Column header for a custom field: a coloured type icon, the field name, and a
 * "..." kebab that opens Rename / Edit field / Delete field. Rename and Edit
 * open an inline name editor (Edit also lets dropdown/labels options be managed
 * in a future pass; today it reuses the rename editor). Delete drops the field
 * via the store, which also strips its column + every task value.
 *
 * Uses the shared Menu primitive for the kebab so the popover matches every
 * other ClickUp menu byte-for-byte.
 */

import { useState } from 'react';
import { Menu, MenuItem, MenuDivider } from '@/components/ui/Menu';
import { useCustomFieldActions } from '@/store/workspace/custom-fields-hooks';
import type { CustomFieldDef } from '@/store/workspace/custom-fields';
import { FieldTypeIcon, typeLabel } from './field-catalog';
import { LV } from '@/components/pages/listview/tokens';

interface CustomFieldHeaderProps {
  field: CustomFieldDef;
  listId: string;
}

export function CustomFieldHeader({ field, listId }: CustomFieldHeaderProps) {
  const { updateCustomField, deleteCustomField } = useCustomFieldActions();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(field.name);

  const commit = () => {
    const name = draft.trim();
    if (name && name !== field.name) updateCustomField(field.id, { name });
    setRenaming(false);
  };

  const beginRename = () => {
    setDraft(field.name);
    setRenaming(true);
  };

  if (renaming) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          height: '100%',
          padding: '0 6px',
        }}
      >
        <FieldTypeIcon type={field.type} size={18} />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setRenaming(false);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            height: 24,
            padding: '0 6px',
            fontSize: 12,
            fontWeight: 600,
            color: LV.textPrimary,
            background: LV.input,
            border: `1px solid ${LV.accent}`,
            borderRadius: 4,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return (
    <div
      title={`${field.name} · ${typeLabel(field.type)}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        height: '100%',
        padding: '0 6px',
        overflow: 'hidden',
      }}
    >
      <FieldTypeIcon type={field.type} size={18} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12,
          fontWeight: 600,
          color: LV.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {field.name}
      </span>
      <Menu
        width={184}
        align="right"
        trigger={({ ref, onClick }) => (
          <KebabButton btnRef={ref} onClick={onClick} />
        )}
      >
        <MenuItem icon={<EditIcon />} label="Rename" onSelect={beginRename} />
        <MenuItem icon={<SettingsIcon />} label="Edit field" onSelect={beginRename} />
        <MenuDivider />
        <MenuItem
          icon={
            <span style={{ color: 'rgb(226,67,41)' }}>
              <TrashIcon />
            </span>
          }
          label={<span style={{ color: 'rgb(226,67,41)' }}>Delete field</span>}
          onSelect={() => deleteCustomField(listId, field.id)}
        />
      </Menu>
    </div>
  );
}

function KebabButton({
  btnRef,
  onClick,
}: {
  btnRef: React.Ref<HTMLButtonElement>;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={btnRef}
      aria-label="Field options"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 20,
        height: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? LV.hover : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: LV.textMuted,
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>
  );
}

function EditIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.2 7.3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
