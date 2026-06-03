'use client';

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { PRIORITY_OPTIONS } from './statuses';
import { CheckMark, PickerRow } from './menu-parts';
import { FlagIcon } from '../list-view-icons';
import { LV } from './tokens';

/** Priority picker: Urgent / High / Normal / Low + Clear. */
export function PriorityCellEditor({
  task,
  trigger,
}: {
  task: Task;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);

  return (
    <Menu width={200} align="left" trigger={trigger}>
      {PRIORITY_OPTIONS.map((p) => (
        <PickerRow
          key={p.key}
          onClick={() => updateTask(task.id, { priority: p.key, priorityColor: p.color })}
          active={task.priority === p.key}
          trailing={task.priority === p.key ? <CheckMark /> : undefined}
        >
          <FlagIcon color={p.color} />
          <span style={{ fontSize: 13, color: LV.textPrimary }}>{p.label}</span>
        </PickerRow>
      ))}
      <MenuDivider />
      <PickerRow onClick={() => updateTask(task.id, { priority: null, priorityColor: null })}>
        <span style={{ fontSize: 13, color: LV.textSecondary }}>Clear</span>
      </PickerRow>
    </Menu>
  );
}
