'use client';

import { useGeneralPrefs, useSetGeneral } from '@/store/preferences/hooks';
import { SettingsRow, SelectInput } from './controls';
import type {
  StartOfWeek,
  TimeFormat,
  DefaultHomeView,
} from '@/store/preferences/types';

const WEEK_OPTIONS: { value: StartOfWeek; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

const TIME_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' },
];

const HOME_OPTIONS: { value: DefaultHomeView; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'dashboard', label: 'Dashboards' },
  { value: 'docs', label: 'Docs' },
];

export function Preferences() {
  const general = useGeneralPrefs();
  const setGeneral = useSetGeneral();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-1">
        Preferences
      </h1>
      <p className="text-[var(--cu-text-muted)] text-xs mb-6">
        Personalise your ClickUp experience.
      </p>

      <section>
        <h2 className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
          General
        </h2>
        <div
          className="
            rounded-[var(--cu-radius-lg)] p-4
            bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
          "
        >
          <SettingsRow
            label="Start of week"
            description="The first day shown in calendar views."
          >
            <SelectInput<StartOfWeek>
              value={general.startOfWeek}
              options={WEEK_OPTIONS}
              widthClass="w-36"
              onChange={(startOfWeek) => setGeneral({ startOfWeek })}
            />
          </SettingsRow>

          <SettingsRow
            label="Time format"
            description="How times are displayed across the app."
          >
            <SelectInput<TimeFormat>
              value={general.timeFormat}
              options={TIME_OPTIONS}
              widthClass="w-36"
              onChange={(timeFormat) => setGeneral({ timeFormat })}
            />
          </SettingsRow>

          <SettingsRow
            label="Default home view"
            description="Where ClickUp lands when you open the workspace."
          >
            <SelectInput<DefaultHomeView>
              value={general.defaultHomeView}
              options={HOME_OPTIONS}
              widthClass="w-36"
              onChange={(defaultHomeView) => setGeneral({ defaultHomeView })}
            />
          </SettingsRow>
        </div>
      </section>
    </div>
  );
}
