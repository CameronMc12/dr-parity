'use client';

import { useState } from 'react';
import { SettingsSection } from '../primitives';
import { RadioRow } from '../controls';

const OPTIONS = [
  'Disabled',
  'Login and testing permissions granted',
  'Login, testing, video, and screenshot permissions granted',
];

export function LoginPermissionSection() {
  const [granted, setGranted] = useState('Disabled');

  return (
    <SettingsSection
      label="Login Permission for ClickUp Support"
      description="If login permissions are granted, our Internal Support Specialists can access your account to help resolve issues."
    >
      <div className="flex flex-col gap-2.5">
        {OPTIONS.map((o) => (
          <RadioRow
            key={o}
            label={o}
            checked={granted === o}
            onSelect={() => setGranted(o)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
