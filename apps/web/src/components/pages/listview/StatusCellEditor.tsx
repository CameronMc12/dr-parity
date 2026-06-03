'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Menu } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { groupStatusOptions, listStatusOptions, type StatusOption } from './statuses';
import { CheckMark, Dot, MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { LV } from './tokens';

/**
 * Status dropdown for a row's Status cell. Lists the list's real status set,
 * bucketed Not started / Active / Closed, and applies the pick via updateTask.
 */
export function StatusCellEditor({
  task,
  listTasks,
  trigger,
}: {
  task: Task;
  listTasks: Task[];
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const options = listStatusOptions(listTasks);
    const filtered = query
      ? options.filter((o) => o.status.toLowerCase().includes(query.toLowerCase()))
      : options;
    return groupStatusOptions(filtered);
  }, [listTasks, query]);

  const apply = (o: StatusOption) =>
    updateTask(task.id, {
      status: o.status,
      statusColor: o.statusColor,
      statusType: o.statusType,
    });

  return (
    <Menu width={240} align="left" trigger={trigger}>
      <MenuSearch value={query} onChange={setQuery} placeholder="Search..." />
      {groups.map((g) => (
        <div key={g.heading} data-testid="status-section">
          <SectionLabel>{g.heading}</SectionLabel>
          {g.options.map((o) => (
            <PickerRow
              key={o.status}
              onClick={() => apply(o)}
              active={o.status === task.status}
              trailing={o.status === task.status ? <CheckMark /> : undefined}
            >
              <Dot color={o.statusColor} dashed={g.heading === 'Not started'} />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  color: LV.textSecondary,
                }}
              >
                {o.status}
              </span>
            </PickerRow>
          ))}
        </div>
      ))}
    </Menu>
  );
}
