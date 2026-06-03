import * as Switch from '@radix-ui/react-switch';

const NOTIFICATION_GROUPS = [
  {
    title: 'Task updates',
    items: [
      { id: 'task-assigned',    label: 'Task assigned to me',        defaultChecked: true },
      { id: 'task-comments',    label: 'Comments on my tasks',       defaultChecked: true },
      { id: 'task-status',      label: 'Task status changes',        defaultChecked: false },
      { id: 'task-due',         label: 'Due date reminders',         defaultChecked: true },
    ],
  },
  {
    title: 'Mentions',
    items: [
      { id: 'mention-tasks',    label: 'Mentioned in tasks',         defaultChecked: true },
      { id: 'mention-comments', label: 'Mentioned in comments',      defaultChecked: true },
      { id: 'mention-docs',     label: 'Mentioned in docs',          defaultChecked: false },
    ],
  },
  {
    title: 'Email',
    items: [
      { id: 'email-digest',     label: 'Daily digest email',         defaultChecked: false },
      { id: 'email-mentions',   label: 'Email for direct mentions',  defaultChecked: true },
    ],
  },
];

export function Notifications() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Notifications
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Control what notifications you receive and how.
      </p>

      <div className="flex flex-col gap-4">
        {NOTIFICATION_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
              {group.title}
            </h2>
            <div
              className="
                rounded-[var(--cu-radius-lg)] overflow-hidden
                bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
              "
            >
              {group.items.map((item, i) => (
                <div
                  key={item.id}
                  className={`
                    flex items-center justify-between px-4 py-3
                    ${i < group.items.length - 1 ? 'border-b border-[var(--cu-border-divider)]' : ''}
                  `}
                >
                  <label
                    htmlFor={item.id}
                    className="text-sm text-[var(--cu-text-primary)] cursor-pointer"
                  >
                    {item.label}
                  </label>
                  <Switch.Root
                    id={item.id}
                    defaultChecked={item.defaultChecked}
                    className="
                      w-9 h-5 rounded-full relative cursor-pointer
                      bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border)]
                      transition-colors
                    "
                  >
                    <Switch.Thumb
                      className="
                        block w-4 h-4 rounded-full bg-white shadow-sm
                        translate-x-0.5 data-[state=checked]:translate-x-[18px]
                        transition-transform
                      "
                    />
                  </Switch.Root>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
