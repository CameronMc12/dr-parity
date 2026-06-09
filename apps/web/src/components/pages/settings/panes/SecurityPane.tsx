'use client';

import { useState } from 'react';
import {
  Card,
  CardRow,
  SectionLabel,
  EnterpriseBadge,
} from './sections/general-primitives';
import { CheckboxRow, GhostButton } from './controls';
import { Toggle } from './sections/security-primitives';

/**
 * Security & Permissions pane — 2FA, SSO (Enterprise), login methods, and
 * workspace-level permission toggles, matching the ClickUp Security settings.
 */

const LOGIN_METHODS: { id: string; label: string; on: boolean }[] = [
  { id: 'google', label: 'Google', on: true },
  { id: 'microsoft', label: 'Microsoft', on: false },
  { id: 'apple', label: 'Apple', on: false },
  { id: 'email', label: 'Email & password', on: true },
];

const PERMISSIONS = [
  'Allow members to create Spaces',
  'Allow guests to share items',
  'Allow public sharing of items',
];

export function SecurityPane() {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    'Allow members to create Spaces': true,
    'Allow guests to share items': false,
    'Allow public sharing of items': false,
  });

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <h1 className="text-[28px] font-bold text-white mb-8">
        Security &amp; Permissions
      </h1>

      <SectionLabel>Two-factor authentication</SectionLabel>
      <Card>
        <CardRow
          label="Require 2FA for all members"
          description="When enabled, every member must set up two-factor authentication before they can access the Workspace."
        >
          <Toggle defaultOn={false} />
        </CardRow>
      </Card>

      <SectionLabel badge={<EnterpriseBadge />}>
        Single sign-on (SSO)
      </SectionLabel>
      <Card>
        <CardRow
          label="SAML SSO"
          description="Let members sign in through your identity provider using SAML 2.0."
        >
          <div className="flex items-center gap-3">
            <Toggle defaultOn={false} />
            <GhostButton>Configure</GhostButton>
          </div>
        </CardRow>
      </Card>

      <SectionLabel>Login methods</SectionLabel>
      <Card>
        {LOGIN_METHODS.map((m) => (
          <CardRow key={m.id} label={m.label}>
            <Toggle defaultOn={m.on} />
          </CardRow>
        ))}
      </Card>

      <SectionLabel>Workspace permissions</SectionLabel>
      <Card>
        {PERMISSIONS.map((label) => (
          <div
            key={label}
            className="flex items-center px-6 py-5 border-b border-[#2a2a2a] last:border-b-0"
          >
            <CheckboxRow
              label={label}
              checked={permissions[label] ?? false}
              onChange={(v) =>
                setPermissions((prev) => ({ ...prev, [label]: v }))
              }
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
