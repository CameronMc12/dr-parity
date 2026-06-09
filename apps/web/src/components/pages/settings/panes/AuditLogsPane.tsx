'use client';

import { useState } from 'react';
import { EnterpriseBadge } from './sections/general-primitives';
import { SelectField, PrimaryButton, GhostButton } from './controls';
import {
  PlainCard,
  DataTable,
  TableRow,
  TableCell,
} from './sections/security-primitives';

/**
 * Audit Logs pane (Enterprise) — a filterable, exportable log of Workspace
 * activity, matching the ClickUp audit log table.
 */

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  event: string;
  ip: string;
}

const ENTRIES: AuditEntry[] = [
  {
    id: '1',
    timestamp: '2026-06-09 09:14',
    user: 'Cameron Mc',
    event: 'Logged in',
    ip: '102.65.x.x',
  },
  {
    id: '2',
    timestamp: '2026-06-09 09:21',
    user: 'Cameron Mc',
    event: "Created Space 'Team Space'",
    ip: '102.65.x.x',
  },
  {
    id: '3',
    timestamp: '2026-06-08 16:02',
    user: 'Sarah Lane',
    event: 'Updated permissions',
    ip: '41.203.x.x',
  },
  {
    id: '4',
    timestamp: '2026-06-08 11:47',
    user: 'Devon Park',
    event: 'Invited 2 members',
    ip: '197.85.x.x',
  },
];

export function AuditLogsPane() {
  const [userFilter, setUserFilter] = useState('All users');
  const [eventFilter, setEventFilter] = useState('All events');

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-[28px] font-bold text-white">Audit Logs</h1>
        <EnterpriseBadge />
      </div>
      <p className="text-[13px] leading-[18px] text-[#7b7b7b] mb-6 max-w-[560px]">
        Track activity across your Workspace. Review who did what and when, and
        export logs for compliance and security reviews.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SelectField
          value={userFilter}
          options={['All users', 'Cameron Mc', 'Sarah Lane', 'Devon Park']}
          onChange={setUserFilter}
        />
        <SelectField
          value={eventFilter}
          options={[
            'All events',
            'Logged in',
            'Created Space',
            'Updated permissions',
            'Invited members',
          ]}
          onChange={setEventFilter}
        />
        <GhostButton>Last 30 days</GhostButton>
        <div className="ml-auto">
          <PrimaryButton>Export</PrimaryButton>
        </div>
      </div>

      <PlainCard>
        <DataTable columns={['Timestamp', 'User', 'Event', 'IP address']}>
          {ENTRIES.map((e) => (
            <TableRow key={e.id}>
              <TableCell muted>{e.timestamp}</TableCell>
              <TableCell>{e.user}</TableCell>
              <TableCell>{e.event}</TableCell>
              <TableCell muted>{e.ip}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </PlainCard>
    </div>
  );
}
