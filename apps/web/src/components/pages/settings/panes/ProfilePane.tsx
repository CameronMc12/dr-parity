'use client';

import { useState } from 'react';
import {
  PaneTitle,
  SettingsSection,
  FieldLabel,
  TextField,
  ToggleRow,
} from './primitives';
import { ThemeColorRow, AppearanceRow } from './AppearancePane';

const UserGlyph = (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </svg>
);
const MailGlyph = (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);
const LockGlyph = (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/**
 * Profile pane — the richest oracle My Settings surface
 * (deep-settings/state-0001): avatar block, Full Name / Email / Password
 * fields, Two-factor authentication (SMS + TOTP toggles), Theme color swatch
 * row, Appearance light/dark/auto picker. Header reads "My Settings".
 */
export function ProfilePane() {
  const [fullName, setFullName] = useState('Cameron Mc');
  const [email, setEmail] = useState('cameron12mcallister@gmail.com');
  const [password, setPassword] = useState('');
  const [sms, setSms] = useState(false);
  const [totp, setTotp] = useState(false);

  return (
    <div>
      <PaneTitle>My Settings</PaneTitle>

      <SettingsSection
        label="Profile"
        description="Your personal information and account security settings."
      >
        <div>
          <FieldLabel>Avatar</FieldLabel>
          <div className="flex items-center gap-3">
            <span className="w-16 h-16 rounded-full bg-[var(--cu-grey-700)] text-white flex items-center justify-center text-xl font-semibold select-none">
              CM
            </span>
          </div>
          <p className="text-sm font-medium text-[var(--cu-text-primary)] mt-2">
            {fullName}
          </p>
        </div>

        <div>
          <FieldLabel>Full Name</FieldLabel>
          <TextField icon={UserGlyph} value={fullName} onChange={setFullName} />
        </div>

        <div>
          <FieldLabel>Email</FieldLabel>
          <TextField icon={MailGlyph} value={email} onChange={setEmail} type="email" />
        </div>

        <div>
          <FieldLabel>Password</FieldLabel>
          <TextField
            icon={LockGlyph}
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Enter New Password"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        label="Two-factor authentication (2FA)"
        description="Keep your account secure by enabling 2FA via SMS or using a temporary one-time passcode (TOTP) from an authenticator app."
      >
        <ToggleRow
          title="Text Message (SMS)"
          description="Receive a one-time passcode via SMS each time you log in."
          checked={sms}
          onChange={setSms}
        />
        <ToggleRow
          title="Authenticator App (TOTP)"
          description="Use an app to receive a temporary one-time passcode each time you log in."
          checked={totp}
          onChange={setTotp}
        />
      </SettingsSection>

      <SettingsSection
        label="Theme color"
        description="Choose a preferred theme for the app."
      >
        <ThemeColorRow />
      </SettingsSection>

      <SettingsSection
        label="Appearance"
        description="Choose light or dark mode, or switch your mode automatically based on your system settings."
      >
        <AppearanceRow />
      </SettingsSection>
    </div>
  );
}
