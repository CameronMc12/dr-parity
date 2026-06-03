import { useState } from 'react';
import { TaskRow } from '@/components/create/TaskRow';
import { CheckSelectIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { MY_WORK_BUCKETS, MY_WORK_TABS } from '@/data/home-dashboard';
import { useMyTasks, useOpenMyTasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import { WidgetCard } from '../WidgetCard';

function isDone(t: Task): boolean {
  return t.statusType === 'closed' || t.statusType === 'done';
}

export function MyWorkWidget() {
  const [active, setActive] = useState(0);
  // Live store reads. "To Do" lists open tasks; "Done" lists completed ones.
  const openTasks = useOpenMyTasks();
  const allMine = useMyTasks();
  const doneTasks = allMine.filter(isDone);

  const rows = active === 1 ? doneTasks : openTasks;
  const buckets = MY_WORK_BUCKETS.map((b) =>
    b.id === 'unscheduled' ? { ...b, count: openTasks.length } : b,
  );

  return (
    <WidgetCard title="My Work" icon={<CheckSelectIcon size={15} />}>
      <div className="flex items-center gap-4 border-b border-[var(--cu-border-divider)] -mt-1 mb-2">
        {MY_WORK_TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(i)}
            className={`h-8 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              active === i
                ? 'text-[var(--cu-text-primary)] border-[var(--cu-status-purple)]'
                : 'text-[var(--cu-text-muted)] border-transparent hover:text-[var(--cu-text-secondary)]'
            }`}
          >
            {tab}
            {tab === 'To Do' && openTasks.length > 0 ? (
              <span className="ml-1.5 text-[var(--cu-text-muted)] text-[11px]">{openTasks.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {rows.length > 0 ? (
        <div data-testid="mywork-tasks" className="flex flex-col -mx-2">
          {rows.map((t) => (
            <TaskRow key={t.id} task={t} dense />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {buckets.map((b) => (
            <div
              key={b.id}
              className="w-full flex items-center gap-1.5 h-[30px] px-2 -mx-2 rounded-[var(--cu-radius-sm)] text-left"
            >
              <ChevronRightIcon size={14} className="text-[var(--cu-text-muted)]" />
              <span className="text-[var(--cu-text-secondary)] text-[12px] font-medium">{b.label}</span>
              <span className="text-[var(--cu-text-muted)] text-[11px]">{b.count}</span>
            </div>
          ))}
          <p className="text-[var(--cu-text-muted)] text-[12px] pl-5 py-1.5">
            Tasks and reminders assigned to you will show here.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
