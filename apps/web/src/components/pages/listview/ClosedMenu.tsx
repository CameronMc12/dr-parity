'use client';

import { useState, type ReactNode } from 'react';
import { Menu, MenuToggle } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';

/**
 * "Closed" dropdown — two toggles (Tasks / Subtasks) controlling whether closed
 * items are shown. Tasks is wired to `showClosed`; Subtasks has no backing model
 * yet so it is a local visual toggle (parity), kept so the menu matches ClickUp.
 */
export function ClosedMenu({
  listId,
  showClosed,
  trigger,
}: {
  listId: string;
  showClosed: boolean;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const setViewToggle = useWorkspaceStore((s) => s.setViewToggle);
  const [subtasksClosed, setSubtasksClosed] = useState(false);

  return (
    <Menu width={200} align="right" trigger={trigger}>
      <MenuToggle
        label="Tasks"
        checked={showClosed}
        onChange={(v) => setViewToggle(listId, 'showClosed', v)}
      />
      <MenuToggle
        label="Subtasks"
        checked={subtasksClosed}
        onChange={setSubtasksClosed}
      />
    </Menu>
  );
}
