'use client';

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { PickerRow } from './menu-parts';
import { LV } from './tokens';
import { DeleteIcon, RenameIcon } from '../list-view-icons';

/**
 * Full row context menu. Items with store actions are wired (Copy link, New tab,
 * Rename, Duplicate, Favorite, Delete); the rest are visual and just close.
 */
export function RowKebabMenu({
  task,
  onRename,
  onOpenTask,
  trigger,
}: {
  task: Task;
  onRename: () => void;
  onOpenTask: () => void;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const deleteTask = useWorkspaceStore((s) => s.deleteTask);
  const createTask = useWorkspaceStore((s) => s.createTask);

  const copyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(`${location.origin}/90152566819/t/${task.id}`);
    }
  };

  const duplicate = () =>
    createTask({
      name: `${task.name} (copy)`,
      listId: task.listId,
      status: task.status,
      statusColor: task.statusColor,
      statusType: task.statusType,
      priority: task.priority,
      priorityColor: task.priorityColor,
      dueDate: task.dueDate,
      startDate: task.startDate,
      assignees: task.assignees,
    });

  // Placeholder items — render only, not yet wired to store actions.
  const visual = ['Copy ID', 'Follow task', 'Remind me in Inbox', 'Move to', 'Add to', 'Merge', 'Convert to', 'Archive', 'Sharing & Permissions'];

  return (
    <Menu width={220} align="right" trigger={trigger}>
      <PickerRow onClick={copyLink}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Copy link</span>
      </PickerRow>
      <PickerRow onClick={onOpenTask}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Open in new tab</span>
      </PickerRow>
      <MenuDivider />
      <PickerRow onClick={onRename}>
        <span style={{ display: 'inline-flex', color: LV.textMuted }}><RenameIcon /></span>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Rename</span>
      </PickerRow>
      <PickerRow onClick={duplicate}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Duplicate</span>
      </PickerRow>
      <PickerRow onClick={() => toggleFavorite(task.id)}>
        <span style={{ fontSize: 13, color: LV.textPrimary }}>Favorite</span>
      </PickerRow>
      <MenuDivider />
      {visual.map((label) => (
        <PickerRow key={label} onClick={() => undefined}>
          <span style={{ fontSize: 13, color: LV.textSecondary }}>{label}</span>
        </PickerRow>
      ))}
      <MenuDivider />
      <PickerRow onClick={() => deleteTask(task.id)}>
        <span style={{ display: 'inline-flex', color: LV.overdue }}><DeleteIcon /></span>
        <span style={{ fontSize: 13, color: LV.overdue }}>Delete</span>
      </PickerRow>
    </Menu>
  );
}
