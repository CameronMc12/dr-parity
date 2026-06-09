'use client';

import { useState } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { SectionLabel } from './sections/general-primitives';
import { GhostButton, PrimaryButton, SelectField } from './controls';
import { PaneShell, PlainCard, BrandTile } from './sections/appcenter-helpers';

const CONNECTED_EMAIL = 'cameron12mcallister@gmail.com';
const DEFAULT_ACCOUNT = `Gmail — ${CONNECTED_EMAIL}`;
const ACCOUNT_OPTIONS = [DEFAULT_ACCOUNT, 'No default account'];

function ConnectedAccountsCard() {
  return (
    <PlainCard>
      <p className="text-[15px] text-white leading-tight">Connected accounts</p>
      <p className="mt-1 mb-4 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[480px]">
        Send and receive email from within tasks.
      </p>
      <div className="mb-4 flex items-center gap-3 rounded-[8px] bg-[#2a2a2a] px-4 py-3">
        <BrandTile bg="#ea4335" size={36}>
          G
        </BrandTile>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-white leading-tight">Gmail</p>
          <p className="text-[13px] text-[#7b7b7b] truncate">{CONNECTED_EMAIL}</p>
        </div>
        <GhostButton>Disconnect</GhostButton>
      </div>
      <PrimaryButton>Add account</PrimaryButton>
    </PlainCard>
  );
}

function DefaultAccountCard() {
  const [account, setAccount] = useState(DEFAULT_ACCOUNT);
  return (
    <PlainCard>
      <div className="flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-white leading-tight">Default account</p>
          <p className="mt-1 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[440px]">
            New emails created from tasks are sent from this account.
          </p>
        </div>
        <div className="shrink-0">
          <SelectField
            value={account}
            options={ACCOUNT_OPTIONS}
            onChange={setAccount}
          />
        </div>
      </div>
    </PlainCard>
  );
}

function SignatureCard() {
  const [signature, setSignature] = useState(
    'Cameron McAllister\nClickUp Workspace',
  );
  const [append, setAppend] = useState(true);

  return (
    <PlainCard>
      <p className="text-[15px] text-white leading-tight">Signature</p>
      <p className="mt-1 mb-3 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[480px]">
        Added to the bottom of every email you send from a task.
      </p>
      <textarea
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        rows={3}
        className="w-full resize-y rounded-[6px] bg-[#2a2a2a] px-3 py-2 text-[13px] leading-[20px] text-white placeholder:text-[#7b7b7b] border border-[#2a2a2a] focus:outline-none focus:border-[#3e63dd] transition-colors"
      />
      <div className="mt-4 flex items-center justify-between gap-6">
        <p className="text-[14px] text-white leading-tight">
          Append signature to outgoing email
        </p>
        <Switch.Root
          checked={append}
          onCheckedChange={setAppend}
          className="w-9 h-5 rounded-full relative cursor-pointer shrink-0 transition-colors bg-[#3e63dd] data-[state=unchecked]:bg-[#2a2a2a]"
        >
          <Switch.Thumb className="block w-4 h-4 rounded-full bg-white shadow-sm translate-x-0.5 data-[state=checked]:translate-x-[18px] transition-transform" />
        </Switch.Root>
      </div>
    </PlainCard>
  );
}

export function EmailIntegrationPane() {
  return (
    <PaneShell title="Email Integration">
      <SectionLabel>Accounts</SectionLabel>
      <ConnectedAccountsCard />
      <DefaultAccountCard />
      <SignatureCard />
    </PaneShell>
  );
}
