'use client';

import { useEffect } from 'react';
import { MyTasksListView } from '@/components/pages/ListView';
import { useUiStore } from '@/store/ui-store';

/**
 * Direct-navigation handler for `/<wsId>/t/<taskId>`. Opens the global task
 * modal for the given id and renders My Tasks behind it, so a deep link still
 * shows the task as a centered popover over a real page (not a full-screen
 * takeover). In-app clicks from a list use `openTask` directly and keep their
 * own list mounted behind the modal.
 */
export function TaskRoute({ taskId }: { taskId: string }) {
  const openTask = useUiStore((s) => s.openTask);

  useEffect(() => {
    openTask(taskId);
  }, [taskId, openTask]);

  return <MyTasksListView />;
}
