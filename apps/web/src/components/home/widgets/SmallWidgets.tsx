import { TaskRow } from '@/components/create/TaskRow';
import { useAssignedToMe } from '@/store/workspace/hooks';
import { WidgetCard, WidgetEmpty } from '../WidgetCard';

export function AssignedToMeWidget() {
  // Live: every non-archived task assigned to the current member.
  const tasks = useAssignedToMe();
  return (
    <WidgetCard title="Assigned to me" icon={<span className="text-[13px]">👤</span>}>
      {tasks.length > 0 ? (
        <div data-testid="assigned-tasks" className="flex flex-col -mx-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} dense />
          ))}
        </div>
      ) : (
        <WidgetEmpty message="Tasks and reminders assigned to you will show here." />
      )}
    </WidgetCard>
  );
}

export function PersonalListWidget() {
  return (
    <WidgetCard title="Personal List" icon={<span className="text-[13px]">📋</span>}>
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[var(--cu-text-muted)] text-[12px] max-w-[220px] leading-[1.45]">
          Personal List is a home for your tasks.{' '}
          <button type="button" className="text-[var(--cu-status-blue)] hover:underline">
            Learn more
          </button>
        </p>
        <button
          type="button"
          className="mt-1 text-[var(--cu-text-secondary)] text-[12px] font-medium px-3 h-7 rounded-[var(--cu-radius-sm)] border border-[var(--cu-border-divider)] hover:bg-[var(--cu-bg-hover)]"
        >
          + Create a task
        </button>
      </div>
    </WidgetCard>
  );
}

export function AssignedCommentsWidget() {
  return (
    <WidgetCard title="Assigned comments" icon={<span className="text-[13px]">💬</span>}>
      <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 py-6">
        <p className="text-[var(--cu-text-muted)] text-[12px]">
          You don&apos;t have any assigned comments.
        </p>
        <button type="button" className="text-[var(--cu-status-blue)] text-[12px] hover:underline">
          Learn more
        </button>
      </div>
    </WidgetCard>
  );
}

export function PrioritiesWidget() {
  return (
    <WidgetCard title="Priorities" icon={<span className="text-[13px]">🚩</span>}>
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[var(--cu-text-muted)] text-[12px] max-w-[220px] leading-[1.45]">
          Priorities keep your most important tasks in one list.
        </p>
        <button
          type="button"
          className="text-[var(--cu-text-secondary)] text-[12px] font-medium px-3 h-7 rounded-[var(--cu-radius-sm)] border border-[var(--cu-border-divider)] hover:bg-[var(--cu-bg-hover)]"
        >
          + Create a task
        </button>
      </div>
    </WidgetCard>
  );
}

export function AiStandupWidget() {
  return (
    <WidgetCard title="AI StandUp" icon={<span className="text-[13px]">✨</span>}>
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[var(--cu-text-muted)] text-[12px] max-w-[230px] leading-[1.45]">
          Use ClickUp AI to create a recurring summary of recent activity.
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-white text-[12px] font-medium px-3 h-8 rounded-[var(--cu-radius-md)] bg-[var(--cu-status-purple)] hover:opacity-90"
        >
          ✨ Write StandUp
        </button>
      </div>
    </WidgetCard>
  );
}
