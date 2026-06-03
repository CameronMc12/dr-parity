'use client';

import type { ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { Assignee, Task } from '@/store/workspace/types';
import { CheckMark, MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';
import { useState } from 'react';

function AvatarBubble({ assignee, size = 22 }: { assignee: Assignee; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: assignee.color || '#7b68ee',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {assignee.initials}
    </span>
  );
}

/** Member picker for the Assignee cell. Toggles a member on/off the task. */
export function AssigneeCellEditor({
  task,
  trigger,
}: {
  task: Task;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const members = useWorkspaceStore((s) => s.members);
  const currentMemberId = useWorkspaceStore((s) => s.currentMemberId);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [query, setQuery] = useState('');

  const filtered = query
    ? members.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : members;

  const toggle = (m: Assignee) => {
    const has = task.assignees.some((a) => a.id === m.id);
    const next: Assignee[] = has
      ? task.assignees.filter((a) => a.id !== m.id)
      : [...task.assignees, { id: m.id, name: m.name, initials: m.initials, color: m.color }];
    updateTask(task.id, { assignees: next });
  };

  return (
    <Menu width={260} align="left" trigger={trigger}>
      <MenuSearch value={query} onChange={setQuery} placeholder="Search people..." />
      <SectionLabel>People</SectionLabel>
      {filtered.map((m) => {
        const assigned = task.assignees.some((a) => a.id === m.id);
        return (
          <PickerRow
            key={m.id}
            onClick={() => toggle(m)}
            active={assigned}
            trailing={assigned ? <CheckMark /> : undefined}
          >
            <AvatarBubble assignee={m} />
            <span style={{ fontSize: 13, color: LV.textPrimary }}>
              {m.id === currentMemberId ? `${m.name} (Me)` : m.name}
            </span>
          </PickerRow>
        );
      })}
      <MenuDivider />
      <PickerRow onClick={() => undefined}>
        <span style={{ fontSize: 13, color: LV.textMuted }}>Invite people via email</span>
      </PickerRow>
    </Menu>
  );
}
