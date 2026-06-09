'use client';

import { useState } from 'react';
import { SettingsSection } from '../primitives';
import { OptionCard } from '../controls';

type Method = 'sms' | 'totp' | null;

export function TwoFactorSection() {
  const [method, setMethod] = useState<Method>(null);

  return (
    <SettingsSection
      label="Two-factor authentication (2FA)"
      description="Keep your account secure by enabling 2FA via SMS or a temporary one-time passcode from an authenticator app."
    >
      <OptionCard
        title="Text Message (SMS)"
        description="There is a one-time password via SMS each time you log in."
        selected={method === 'sms'}
        onSelect={() => setMethod('sms')}
      />
      <OptionCard
        title="Authenticator App (TOTP)"
        description="Use an app to receive a temporary one-time passcode each time you log in."
        selected={method === 'totp'}
        onSelect={() => setMethod('totp')}
      />
    </SettingsSection>
  );
}
