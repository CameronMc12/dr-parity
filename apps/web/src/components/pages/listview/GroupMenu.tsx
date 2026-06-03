'use client';

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';

/**
 * Group-header context menu. Collapse group + Collapse all groups are wired;
 * the rest are visual (Rename / New status / Edit statuses / Hide status / ...).
 */
export function GroupMenu({
  onCollapseGroup,
  onCollapseAll,
  trigger,
}: {
  onCollapseGroup: () => void;
  onCollapseAll: () => void;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const visual = ['Rename', 'New status', 'Edit statuses', 'Hide status', 'Select all', 'Automate status'];

  return (
    <Menu width={220} align="left" trigger={trigger}>
      <SectionLabel>Group options</SectionLabel>
      <PickerRow onClick={onCollapseGroup}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Collapse group</span>
      </PickerRow>
      <PickerRow onClick={onCollapseAll}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Collapse all groups</span>
      </PickerRow>
      <MenuDivider />
      {visual.map((label) => (
        <PickerRow key={label} onClick={() => undefined}>
          <span style={{ fontSize: 13, color: LV.textSecondary }}>{label}</span>
        </PickerRow>
      ))}
    </Menu>
  );
}
