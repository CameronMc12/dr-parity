'use client';

import { SectionLabel } from './sections/general-primitives';
import { GhostButton, PrimaryButton } from './controls';
import {
  PaneShell,
  PlainCard,
  EmptyState,
  MutedLink,
} from './sections/appcenter-helpers';

const MASKED_TOKEN = 'pk_••••••••••••';

function TokenCard() {
  return (
    <PlainCard>
      <p className="text-[15px] text-white leading-tight">Personal API token</p>
      <p className="mt-1 mb-4 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[480px]">
        Use this token to authenticate requests to the ClickUp API. Keep it
        secret. Regenerating it will immediately revoke the previous token.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex h-9 min-w-[200px] flex-1 items-center rounded-[6px] bg-[#2a2a2a] px-3 font-mono text-[13px] tracking-wide text-[#b4b4b4]">
          {MASKED_TOKEN}
        </code>
        <GhostButton>Copy</GhostButton>
        <GhostButton>Regenerate</GhostButton>
      </div>
    </PlainCard>
  );
}

function AppsCard() {
  return (
    <PlainCard>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] text-white leading-tight">Apps</p>
          <p className="mt-1 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[440px]">
            Create OAuth apps to let third parties access ClickUp on behalf of
            users.
          </p>
        </div>
        <div className="shrink-0">
          <PrimaryButton>Create an App</PrimaryButton>
        </div>
      </div>
      <EmptyState>No apps yet</EmptyState>
    </PlainCard>
  );
}

function WebhooksCard() {
  return (
    <PlainCard>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] text-white leading-tight">Webhooks</p>
          <p className="mt-1 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[440px]">
            Get notified at a URL of your choice when events happen in your
            Workspace.
          </p>
        </div>
        <div className="shrink-0">
          <GhostButton>Create Webhook</GhostButton>
        </div>
      </div>
      <EmptyState>No webhooks yet</EmptyState>
    </PlainCard>
  );
}

export function ClickUpApiPane() {
  return (
    <PaneShell title="ClickUp API">
      <SectionLabel>Authentication</SectionLabel>
      <TokenCard />
      <AppsCard />
      <WebhooksCard />
      <div className="flex items-center">
        <MutedLink>View API documentation</MutedLink>
      </div>
    </PaneShell>
  );
}
