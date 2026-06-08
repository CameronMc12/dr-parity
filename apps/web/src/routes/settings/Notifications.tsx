'use client';

import { useNotificationPrefs, useSetNotifications } from '@/store/preferences/hooks';
import type { NotificationPrefs } from '@/store/preferences/types';
import { ToggleSwitch as Switch } from './controls';

const NOTIFICATION_ITEMS: {
  id: keyof NotificationPrefs;
  label: string;
  description: string;
}[] = [
  {
    id: 'assignments',
    label: 'Task assignments',
    description: 'Notify me when a task is assigned to me.',
  },
  {
    id: 'mentions',
    label: 'Mentions',
    description: 'Notify me when I am mentioned in tasks, comments, or docs.',
  },
  {
    id: 'emailDigest',
    label: 'Daily email digest',
    description: 'Send a summary of activity to my inbox each morning.',
  },
];

export function Notifications() {
  const notifications = useNotificationPrefs();
  const setNotifications = useSetNotifications();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Notifications
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Control what notifications you receive and how.
      </p>

      <div
        className="
          rounded-[var(--cu-radius-lg)] overflow-hidden
          bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
        "
      >
        {NOTIFICATION_ITEMS.map((item, i) => (
          <div
            key={item.id}
            className={`
              flex items-center justify-between gap-4 px-4 py-3
              ${i < NOTIFICATION_ITEMS.length - 1 ? 'border-b border-[var(--cu-border-divider)]' : ''}
            `}
          >
            <label htmlFor={item.id} className="cursor-pointer min-w-0">
              <span className="block text-sm text-[var(--cu-text-primary)]">
                {item.label}
              </span>
              <span className="block text-xs text-[var(--cu-text-muted)] mt-0.5">
                {item.description}
              </span>
            </label>
            <Switch
              id={item.id}
              checked={notifications[item.id]}
              onCheckedChange={(checked) => setNotifications({ [item.id]: checked })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
