'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { ColumnId, ViewConfig } from '@/store/workspace/view-config.types';
import { COLUMN_DEFS, HIDDEN_FIELD_LABELS, isBuiltinColumn } from './columns';
import { MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';

function EyeToggle({ shown }: { shown: boolean }) {
  return (
    <span style={{ fontSize: 12, color: shown ? LV.accent : LV.textMuted }}>
      {shown ? 'Hide' : 'Show'}
    </span>
  );
}

/** Field manager — Shown vs Hidden columns; toggling flips table visibility. */
export function ColumnsMenu({
  listId,
  config,
  trigger,
}: {
  listId: string;
  config: ViewConfig;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const toggleColumn = useWorkspaceStore((s) => s.toggleColumn);
  const [query, setQuery] = useState('');

  // Custom-field `cf:*` columns are owned by the Table view; the List manager
  // only lists built-in columns, so filter them out before indexing COLUMN_DEFS.
  const shown: ColumnId[] = ['name', ...config.visibleColumns.filter(isBuiltinColumn)];
  const q = query.toLowerCase();
  const matchShown = shown.filter((c) => COLUMN_DEFS[c].label.toLowerCase().includes(q));

  return (
    <Menu width={280} align="left" trigger={trigger}>
      <MenuSearch value={query} onChange={setQuery} placeholder="Search fields..." />

      <SectionLabel>Shown</SectionLabel>
      {matchShown.map((c) => (
        <PickerRow
          key={c}
          onClick={() => toggleColumn(listId, c)}
          trailing={c === 'name' ? undefined : <EyeToggle shown />}
        >
          <span style={{ fontSize: 13, color: LV.textPrimary }}>{COLUMN_DEFS[c].label}</span>
        </PickerRow>
      ))}

      <SectionLabel>Hidden</SectionLabel>
      {config.hiddenColumns
        .filter(isBuiltinColumn)
        .filter((c) => COLUMN_DEFS[c].label.toLowerCase().includes(q))
        .map((c) => (
          <PickerRow
            key={c}
            onClick={() => toggleColumn(listId, c)}
            trailing={<EyeToggle shown={false} />}
          >
            <span style={{ fontSize: 13, color: LV.textSecondary }}>{COLUMN_DEFS[c].label}</span>
          </PickerRow>
        ))}
      {/* Remaining ClickUp fields that aren't wired to data (visual parity). */}
      {HIDDEN_FIELD_LABELS.filter((l) => l.toLowerCase().includes(q)).map((label) => (
        <PickerRow key={label} onClick={() => undefined} trailing={<EyeToggle shown={false} />}>
          <span style={{ fontSize: 13, color: LV.textMuted }}>{label}</span>
        </PickerRow>
      ))}
    </Menu>
  );
}
