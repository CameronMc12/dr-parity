'use client';

import { useState } from 'react';
import { SelectField, GhostButton, DangerButton } from './controls';
import {
  PlainCard,
  DataTable,
  TableRow,
  TableCell,
  SearchInput,
} from './sections/security-primitives';

/**
 * Trash pane — recently deleted Workspace items with restore / permanent-delete
 * actions, matching the ClickUp Trash settings.
 */

interface TrashItem {
  id: string;
  name: string;
  type: 'List' | 'Task' | 'Doc';
  deletedBy: string;
  deletedOn: string;
}

const ITEMS: TrashItem[] = [
  {
    id: '1',
    name: 'Q2 Campaign Backlog',
    type: 'List',
    deletedBy: 'Cameron Mc',
    deletedOn: '2026-06-07',
  },
  {
    id: '2',
    name: 'Draft homepage copy',
    type: 'Task',
    deletedBy: 'Sarah Lane',
    deletedOn: '2026-06-05',
  },
  {
    id: '3',
    name: 'Onboarding Runbook',
    type: 'Doc',
    deletedBy: 'Devon Park',
    deletedOn: '2026-06-02',
  },
];

export function TrashPane() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All item types');

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <h1 className="text-[28px] font-bold text-white mb-2">Trash</h1>
      <p className="text-[13px] leading-[18px] text-[#7b7b7b] mb-6 max-w-[560px]">
        Items you delete are kept in Trash for 30 days, then permanently removed.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput
          value={query}
          placeholder="Search Trash"
          onChange={setQuery}
        />
        <SelectField
          value={typeFilter}
          options={['All item types', 'List', 'Task', 'Doc']}
          onChange={setTypeFilter}
        />
      </div>

      <PlainCard>
        <DataTable
          columns={['Name', 'Type', 'Deleted by', 'Deleted on', 'Actions']}
        >
          {ITEMS.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell muted>{item.type}</TableCell>
              <TableCell muted>{item.deletedBy}</TableCell>
              <TableCell muted>{item.deletedOn}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <GhostButton>Restore</GhostButton>
                  <DangerButton>Delete</DangerButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </PlainCard>
    </div>
  );
}
