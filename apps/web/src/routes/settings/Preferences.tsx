import * as Switch from '@radix-ui/react-switch';

const PREFERENCE_GROUPS = [
  {
    title: 'Task defaults',
    items: [
      { id: 'auto-assign',    label: 'Auto-assign tasks to me',             defaultChecked: true },
      { id: 'show-closed',    label: 'Show closed tasks by default',        defaultChecked: false },
      { id: 'time-tracking',  label: 'Enable time tracking',                defaultChecked: true },
    ],
  },
  {
    title: 'Display',
    items: [
      { id: 'show-avatars',   label: 'Show user avatars in lists',          defaultChecked: true },
      { id: 'animations',     label: 'Enable animations',                   defaultChecked: true },
    ],
  },
];

export function Preferences() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Preferences
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Personalise your ClickUp experience.
      </p>

      <div className="flex flex-col gap-5">
        {PREFERENCE_GROUPS.map((group) => (
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
                  <label htmlFor={item.id} className="text-sm text-[var(--cu-text-primary)] cursor-pointer">
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
