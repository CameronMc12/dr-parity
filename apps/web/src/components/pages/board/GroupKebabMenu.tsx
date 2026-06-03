'use client';

/**
 * Board group-header "..." menu. Real, working items map to board behaviour:
 * add a task to this group, collapse this group, collapse all groups, and (for
 * user-added empty groups) delete the group. Mirrors the Menu/PickerRow
 * primitives the List view uses so it stays visually 1:1 with ClickUp.
 */

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { PickerRow } from '../listview/menu-parts';
import { DeleteIcon } from '../list-view-icons';
import { BOARD } from './tokens';

function PlusGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollapseGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 9l4 4 4-4M8 15h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GroupKebabMenu({
  status,
  canDelete,
  onAddTask,
  onCollapse,
  onCollapseAll,
  onDelete,
  trigger,
}: {
  status: string;
  canDelete: boolean;
  onAddTask?: () => void;
  onCollapse: () => void;
  onCollapseAll?: () => void;
  onDelete?: () => void;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  return (
    <Menu width={220} align="right" trigger={trigger}>
      {onAddTask && (
        <PickerRow onClick={onAddTask}>
          <PlusGlyph />
          <span style={{ fontSize: 13, color: BOARD.textPrimary }}>Add Task</span>
        </PickerRow>
      )}
      <PickerRow onClick={onCollapse}>
        <CollapseGlyph />
        <span style={{ fontSize: 13, color: BOARD.textPrimary }}>Collapse group</span>
      </PickerRow>
      {onCollapseAll && (
        <PickerRow onClick={onCollapseAll}>
          <CollapseGlyph />
          <span style={{ fontSize: 13, color: BOARD.textPrimary }}>Collapse all groups</span>
        </PickerRow>
      )}
      {canDelete && onDelete && (
        <>
          <MenuDivider />
          <PickerRow onClick={onDelete}>
            <DeleteIcon />
            <span style={{ fontSize: 13, color: '#e25241' }}>Delete group</span>
          </PickerRow>
        </>
      )}
    </Menu>
  );
}
