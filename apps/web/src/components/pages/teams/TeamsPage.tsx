'use client';

import { useMemo, useState } from 'react';
import { useUiStore } from '@/store/ui-store';
import {
  PageSurface,
  PageTitle,
  TabStrip,
  PillButton,
  DarkButton,
  SearchIcon,
  PlusIcon,
} from '@/components/pages/page-primitives';
import { MEMBER_SEED, type MemberRole, type MemberSeed } from '@/data/teams-seed';
import { PeopleRow, PEOPLE_COLUMNS } from './PeopleRow';
import { TeamsGrid } from './TeamsGrid';
import { RoleFilter } from './RoleFilter';
import { T } from './teams-tokens';

type TabId = 'people' | 'teams' | 'guests';

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'teams', label: 'Teams' },
  { id: 'guests', label: 'Guests' },
];

/**
 * Teams hub: /<wsId>/teams. ClickUp-style "Manage your team" surface with
 * People / Teams / Guests tabs, a member table with editable roles, and a
 * team-card grid. All mutations are local state — no backend.
 */
export function TeamsPage() {
  const openInvite = useUiStore((s) => s.openInvite);
  const [tab, setTab] = useState<TabId>('people');
  const [members, setMembers] = useState<MemberSeed[]>(MEMBER_SEED);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRole | null>(null);

  const setRole = (id: string, role: MemberRole) =>
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, role } : m)));
  const removeMember = (id: string) => setMembers((list) => list.filter((m) => m.id !== id));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const guestsTab = tab === 'guests';
    return members.filter((m) => {
      if (guestsTab && m.role !== 'guest') return false;
      if (!guestsTab && roleFilter && m.role !== roleFilter) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, query, roleFilter, tab]);

  return (
    <PageSurface>
      <PageTitle
        right={<DarkButton icon={<PlusIcon size={15} />}>Invite people</DarkButton>}
      >
        Manage your team
      </PageTitle>

      <TabStrip
        tabs={TABS}
        activeId={tab}
        onSelect={(id) => setTab(id as TabId)}
        variant="text"
      />

      <Toolbar
        tab={tab}
        query={query}
        onQuery={setQuery}
        roleFilter={roleFilter}
        onRoleFilter={setRoleFilter}
        onInvite={openInvite}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'teams' ? (
          <TeamsGrid />
        ) : (
          <PeopleTable members={visible} onRole={setRole} onRemove={removeMember} />
        )}
      </div>
    </PageSurface>
  );
}

function Toolbar({
  tab,
  query,
  onQuery,
  roleFilter,
  onRoleFilter,
  onInvite,
}: {
  tab: TabId;
  query: string;
  onQuery: (v: string) => void;
  roleFilter: MemberRole | null;
  onRoleFilter: (r: MemberRole | null) => void;
  onInvite: () => void;
}) {
  if (tab === 'teams') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
        <span style={{ flex: 1 }} />
        <DarkButton icon={<PlusIcon size={15} />}>New team</DarkButton>
      </div>
    );
  }

  const placeholder = tab === 'guests' ? 'Search guests' : 'Search people';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
      <SearchInput value={query} onChange={onQuery} placeholder={placeholder} />
      {tab === 'people' && <RoleFilter value={roleFilter} onChange={onRoleFilter} />}
      <span style={{ flex: 1 }} />
      <PillButton onClick={onInvite}>Invite people</PillButton>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        height: 30,
        width: 260,
        padding: '0 10px',
        background: T.appBg,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
      }}
    >
      <span style={{ display: 'flex', color: T.textMuted, flexShrink: 0 }}>
        <SearchIcon size={14} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: T.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

function PeopleTable({
  members,
  onRole,
  onRemove,
}: {
  members: MemberSeed[];
  onRole: (id: string, role: MemberRole) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <HeaderRow />
      {members.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13.5, color: T.textMuted }}>
          No people match your filters.
        </div>
      ) : (
        members.map((m) => (
          <PeopleRow
            key={m.id}
            member={m}
            onRoleChange={(role) => onRole(m.id, role)}
            onRemove={() => onRemove(m.id)}
          />
        ))
      )}
    </div>
  );
}

function HeaderRow() {
  const cell: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: T.textMuted,
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: PEOPLE_COLUMNS,
        gap: 12,
        alignItems: 'center',
        height: 36,
        paddingLeft: 24,
        paddingRight: 24,
        borderBottom: `1px solid ${T.border}`,
        background: T.appBg,
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <span style={cell}>Name</span>
      <span style={cell}>Email</span>
      <span style={cell}>Role</span>
      <span style={cell}>Teams</span>
      <span style={cell}>Last active</span>
      <span />
    </div>
  );
}
