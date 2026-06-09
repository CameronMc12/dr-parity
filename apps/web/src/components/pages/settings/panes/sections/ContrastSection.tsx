'use client';

import { useState } from 'react';
import { SettingsSection, ToggleRow } from '../primitives';

export function ContrastSection() {
  const [highContrast, setHighContrast] = useState(false);

  return (
    <SettingsSection
      label="Contrast"
      description="Turn on or off high contrast text and borders."
    >
      <ToggleRow
        title="High Contrast for increased accessibility"
        checked={highContrast}
        onChange={setHighContrast}
      />
    </SettingsSection>
  );
}
