'use client';

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';

const PRIMARY = [
  { key: 'task', label: 'Task' },
  { key: 'milestone', label: 'Milestone' },
];

const SECONDARY = [
  { key: 'doc', label: 'Doc' },
  { key: 'reminder', label: 'Reminder' },
  { key: 'whiteboard', label: 'Whiteboard' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'fromTemplate', label: 'From template' },
];

/**
 * Add-task split-button caret menu. "Task" creates a task; the remaining create
 * options have no backing model yet so they are visual no-ops (parity), kept so
 * the dropdown matches ClickUp's create set.
 */
export function AddTaskMenu({
  onCreateTask,
  trigger,
}: {
  onCreateTask: () => void;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  return (
    <Menu width={210} align="right" trigger={trigger}>
      <SectionLabel>Create new</SectionLabel>
      {PRIMARY.map((it) => (
        <PickerRow key={it.key} onClick={() => it.key === 'task' && onCreateTask()}>
          <span style={{ fontSize: 13, color: LV.textPrimary }}>{it.label}</span>
        </PickerRow>
      ))}
      <MenuDivider />
      {SECONDARY.map((it) => (
        <PickerRow key={it.key} onClick={() => undefined}>
          <span style={{ fontSize: 13, color: LV.textSecondary }}>{it.label}</span>
        </PickerRow>
      ))}
    </Menu>
  );
}
