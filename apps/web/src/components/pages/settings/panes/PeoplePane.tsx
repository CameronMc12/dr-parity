'use client';

import { useState } from 'react';
import { Card } from './sections/general-primitives';
import { SelectField, PrimaryButton } from './controls';
import {
  PaneShell,
  SearchInput,
  SegmentedTabs,
  Avatar,
  KebabButton,
  TableHead,
  EmptyRow,
} from './sections/people-shared';

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
  shape: 'circle' | 'square';
}

const SEED_MEMBERS: MemberRow[] = [
  {
    id: 'm1',
    name: 'Cameron Mc',
    email: 'cameron12mcallister@gmail.com',
    role: 'Owner',
    lastActive: 'Active now',
    shape: 'square',
  },
];

const ROLES = ['Owner', 'Admin', 'Member'];
const TABS = ['Members', 'Guests', 'Teams'];

export function PeoplePane() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Members');
  const [members, setMembers] = useState<MemberRow[]>(SEED_MEMBERS);

  const setRole = (id: string, role: string) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));

  const visible = members.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.email.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <PaneShell title="People">
      <div className="flex items-center gap-3 mb-6">
        <SearchInput value={query} placeholder="Search people" onChange={setQuery} />
        <div className="ml-auto">
          <PrimaryButton>Invite people</PrimaryButton>
        </div>
      </div>

      <div className="mb-6">
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === 'Members' && (
        <>
          <Card>
            <TableHead columns={['Member', 'Role', 'Last active', '']} />
            {visible.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 px-6 py-4 border-b border-[#2a2a2a] last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar name={m.name} shape={m.shape} />
                  <div className="min-w-0">
                    <p className="text-[15px] text-white leading-tight truncate">{m.name}</p>
                    <p className="text-[13px] text-[#7b7b7b] truncate">{m.email}</p>
                  </div>
                </div>
                <div className="shrink-0" style={{ width: 200 }}>
                  <SelectField
                    value={m.role}
                    options={ROLES}
                    onChange={(v) => setRole(m.id, v)}
                  />
                </div>
                <span className="shrink-0 text-[13px] text-[#b4b4b4]" style={{ width: 110 }}>
                  {m.lastActive}
                </span>
                <KebabButton />
              </div>
            ))}
            {visible.length === 0 && <EmptyRow>No people match your search.</EmptyRow>}
          </Card>
          <p className="text-[13px] text-[#b4b4b4]">
            {members.length} member{members.length === 1 ? '' : 's'} · unlimited seats on Free Forever
          </p>
        </>
      )}

      {tab === 'Guests' && (
        <Card>
          <EmptyRow>You haven&apos;t invited any guests yet.</EmptyRow>
        </Card>
      )}

      {tab === 'Teams' && (
        <Card>
          <EmptyRow>Teams you belong to will appear here.</EmptyRow>
        </Card>
      )}
    </PaneShell>
  );
}
