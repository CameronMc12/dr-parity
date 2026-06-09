'use client';

import { useState } from 'react';
import { SettingsSection, FieldLabel, TextField } from '../primitives';
import { PrimaryButton } from '../controls';

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

export function ProfileSection() {
  const [fullName, setFullName] = useState('Cameron Mc');
  const [email, setEmail] = useState('cameron12mcallister@gmail.com');
  const [password, setPassword] = useState('');

  return (
    <SettingsSection
      label="Profile"
      description="Your personal information and account security settings."
    >
      <div className="flex items-center gap-3">
        <span className="w-16 h-16 rounded-full bg-[#3e63dd] text-white flex items-center justify-center text-xl font-semibold select-none">
          CM
        </span>
        <p className="text-sm font-medium text-[var(--cu-text-primary)]">{fullName}</p>
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

      <div className="flex justify-end">
        <PrimaryButton>Save changes</PrimaryButton>
      </div>
    </SettingsSection>
  );
}
