'use client';

import { Card } from './sections/general-primitives';
import { PrimaryButton, GhostButton } from './controls';
import { PaneShell, CardHeader, TableHead, EmptyRow } from './sections/people-shared';

const PLAN_LIMITS = [
  'Unlimited tasks and members',
  '100MB storage',
  'Two-week Sprints and unlimited Spaces',
];

export function BillingPane() {
  return (
    <PaneShell title="Billing">
      <Card>
        <CardHeader
          title="Current plan"
          action={<PrimaryButton>Upgrade</PrimaryButton>}
        />
        <div className="px-6 py-5 border-b border-[#2a2a2a]">
          <p className="text-[15px] text-white font-medium">Free Forever</p>
          <p className="text-[13px] text-[#7b7b7b] mt-1">
            Best for personal use and getting started.
          </p>
        </div>
        <ul className="px-6 py-4 space-y-2">
          {PLAN_LIMITS.map((l) => (
            <li key={l} className="flex items-center gap-2.5 text-[13px] text-[#b4b4b4]">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#3e63dd" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
              {l}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Payment method" />
        <div className="flex items-center gap-4 px-6 py-5">
          <p className="text-[13px] text-[#7b7b7b] flex-1">No payment method on file</p>
          <GhostButton>Add payment method</GhostButton>
        </div>
      </Card>

      <Card>
        <CardHeader title="Billing history" />
        <TableHead columns={['Date', 'Description', 'Amount', 'Invoice']} />
        <EmptyRow>No invoices yet. Your billing history will appear here.</EmptyRow>
      </Card>
    </PaneShell>
  );
}
