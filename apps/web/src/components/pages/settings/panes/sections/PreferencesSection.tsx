'use client';

import { useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { SettingsSection } from '../primitives';

interface PrefItem {
  key: string;
  title: string;
  description: string;
  defaultOn: boolean;
  info?: boolean;
}

const PREFS: PrefItem[] = [
  {
    key: 'pyoutToast',
    title: 'Pyout Toast Message',
    description:
      'When performing actions, brief messages may appear in the bottom-left of your screen. You can disable that here.',
    defaultOn: true,
    info: true,
  },
  {
    key: 'returnComments',
    title: 'Don’t post comments with "Return"',
    description: 'Use Cmd + Return to send comments instead of just Return.',
    defaultOn: false,
  },
  {
    key: 'keyboardShortcuts',
    title: 'Keyboard Shortcuts',
    description:
      'Use keyboard shortcuts to quickly navigate and take action through ClickUp without using your mouse.',
    defaultOn: true,
  },
  {
    key: 'markdown',
    title: 'Markdown',
    description: 'You can disable Markdown if you prefer typing as normal.',
    defaultOn: false,
  },
  {
    key: 'showQuotes',
    title: 'Show quotes',
    description:
      'Show motivational quotes when you close all your notifications or load certain pages.',
    defaultOn: true,
  },
  {
    key: 'showCelebrations',
    title: 'Show Celebrations',
    description:
      "Show confetti celebrations when you check 'My Work', clear all notifications, or complete a Goal Target.",
    defaultOn: true,
  },
  {
    key: 'clickupVerified',
    title: 'ClickUp Verified',
    description: 'You can disable your ClickUp Verified checkmark.',
    defaultOn: true,
  },
  {
    key: 'plainTextLinks',
    title: 'Plain text links',
    description:
      'Pasted URLs will appear as plain text hyperlinks. This will disable auto-activating hyperlinks such as emails or bookmarks.',
    defaultOn: true,
  },
  {
    key: 'performanceMode',
    title: 'Performance mode',
    description:
      'Enhance performance by turning off non-essential features like product guides and complex visuals.',
    defaultOn: false,
  },
  {
    key: 'detectDesktopApp',
    title: 'Detect Desktop App',
    description: "Automatically open links in the desktop app when it's running.",
    defaultOn: false,
  },
  {
    key: 'blockSelectAll',
    title: 'Block Select All',
    description:
      'Press Cmd + A to select all text. In the current block, press again to select all.',
    defaultOn: true,
  },
  {
    key: 'browserTabLimits',
    title: 'Browser Tab Limits',
    description: 'Limit how many ClickUp tabs can be active at the same time.',
    defaultOn: false,
  },
  {
    key: 'askAddPriorities',
    title: 'Ask to add task to priorities after assigning',
    description:
      "Show a confirm dialog if you'd like to add the task to assigned member's star/box.",
    defaultOn: true,
  },
];

const InfoGlyph = (
  <svg
    width={14}
    height={14}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

function PreferenceToggle({
  item,
  checked,
  onChange,
}: {
  item: PrefItem;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="
          mt-0.5 w-9 h-5 rounded-full relative cursor-pointer shrink-0
          bg-[var(--cu-accent)] data-[state=unchecked]:bg-[var(--cu-border-strong)]
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
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--cu-text-primary)]">
          {item.title}
          {item.info && (
            <span className="text-[var(--cu-text-muted)]">{InfoGlyph}</span>
          )}
        </p>
        <p className="text-[13px] leading-snug text-[var(--cu-text-muted)] mt-0.5">
          {item.description}
        </p>
      </div>
    </div>
  );
}

export function PreferencesSection() {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PREFS.map((p) => [p.key, p.defaultOn])),
  );

  const set = (key: string) => (v: boolean) =>
    setState((s) => ({ ...s, [key]: v }));

  return (
    <SettingsSection
      label="Preferences"
      description="Manage your in-app preferences."
    >
      {PREFS.map((item) => (
        <PreferenceToggle
          key={item.key}
          item={item}
          checked={state[item.key] ?? item.defaultOn}
          onChange={set(item.key)}
        />
      ))}
    </SettingsSection>
  );
}
