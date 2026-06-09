'use client';

import { useState } from 'react';
import { SettingsSection, FieldLabel } from '../primitives';
import { SelectField, CheckboxRow } from '../controls';

const LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', 'Português', '日本語'];
const TIMEZONES = [
  'Africa/Johannesburg',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function LanguageRegionSection() {
  const [language, setLanguage] = useState('English');
  const [timezone, setTimezone] = useState('Africa/Johannesburg');
  const [notifyTzChange, setNotifyTzChange] = useState(true);

  return (
    <SettingsSection
      label="Language & Region"
      description="Customize your language and region."
    >
      <div>
        <FieldLabel>Language</FieldLabel>
        <SelectField value={language} options={LANGUAGES} onChange={setLanguage} />
      </div>
      <div>
        <FieldLabel>Timezone</FieldLabel>
        <SelectField value={timezone} options={TIMEZONES} onChange={setTimezone} />
      </div>
      <CheckboxRow
        label="Notify me of timezone changes"
        checked={notifyTzChange}
        onChange={setNotifyTzChange}
      />
    </SettingsSection>
  );
}
