'use client';

import { useState } from 'react';
import {
  PaneTitle,
  SettingsSection,
  FieldLabel,
  ToggleRow,
} from './primitives';

const LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', 'Português', '日本語'];
const TIME_FORMATS = ['12-hour', '24-hour'];
const START_DAYS = ['Sunday', 'Monday'];

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="
        h-10 px-3 rounded-[var(--cu-radius-md)] text-sm w-56
        bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
        border border-[var(--cu-border)]
        focus:outline-none focus:border-[var(--cu-accent)] transition-colors
      "
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/**
 * "Settings" pane (My Settings → Settings): 2FA quick toggle, language,
 * regional time format and week-start preferences.
 */
export function PreferencesPane() {
  const [twoFa, setTwoFa] = useState(false);
  const [language, setLanguage] = useState('English');
  const [timeFormat, setTimeFormat] = useState('12-hour');
  const [startDay, setStartDay] = useState('Monday');

  return (
    <div>
      <PaneTitle>Settings</PaneTitle>

      <SettingsSection
        label="Two-factor authentication (2FA)"
        description="Require a one-time passcode when you log in."
      >
        <ToggleRow
          title="Enable 2FA"
          description="Adds an extra layer of security to your account."
          checked={twoFa}
          onChange={setTwoFa}
        />
      </SettingsSection>

      <SettingsSection
        label="Language & region"
        description="Set your display language and regional formats."
      >
        <div>
          <FieldLabel>Language</FieldLabel>
          <Select value={language} options={LANGUAGES} onChange={setLanguage} />
        </div>
        <div>
          <FieldLabel>Time format</FieldLabel>
          <Select value={timeFormat} options={TIME_FORMATS} onChange={setTimeFormat} />
        </div>
        <div>
          <FieldLabel>Start of the week</FieldLabel>
          <Select value={startDay} options={START_DAYS} onChange={setStartDay} />
        </div>
      </SettingsSection>
    </div>
  );
}
