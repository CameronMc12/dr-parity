'use client';

import { useMemo, useState } from 'react';
import { PrimaryButton } from './controls';
import {
  KebabButton,
  MemberCount,
  PaneHeader,
  PrivacyBadge,
  SearchInput,
  SettingsCard,
  SquareAvatar,
  Toolbar,
} from './sections/spaces-primitives';

interface SpaceRow {
  id: string;
  name: string;
  color: string;
  members: number;
  privacy: 'Public' | 'Private';
}

const SEED_SPACES: SpaceRow[] = [
  { id: 'team', name: 'Team Space', color: '#3e63dd', members: 1, privacy: 'Private' },
  { id: 'krevio', name: 'KREVIO', color: '#5842C8', members: 1, privacy: 'Private' },
  { id: 'ikonik', name: 'Ikonik', color: '#12A594', members: 1, privacy: 'Private' },
  { id: 'software', name: 'Software Development', color: '#30a46c', members: 1, privacy: 'Public' },
  { id: 'dr-parity', name: 'DR-PARITY-SEED Space', color: '#8b5cf6', members: 1, privacy: 'Private' },
];

const COL = 'grid grid-cols-[1fr_180px_120px_40px] items-center gap-6 px-6';

export function SpacesPane() {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEED_SPACES;
    return SEED_SPACES.filter((s) => s.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader title="Spaces" description="Manage the Spaces in your Workspace." />

      <Toolbar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search Spaces" />
        <div className="ml-auto">
          <PrimaryButton>Create Space</PrimaryButton>
        </div>
      </Toolbar>

      <SettingsCard>
        <div
          className={`${COL} h-10 border-b border-[#2a2a2a] text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]`}
        >
          <span>Space</span>
          <span>Members</span>
          <span>Privacy</span>
          <span />
        </div>

        {rows.map((space) => (
          <div
            key={space.id}
            className={`${COL} py-3.5 border-b border-[#2a2a2a] last:border-b-0 hover:bg-[#202020] transition-colors`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <SquareAvatar label={space.name} color={space.color} />
              <span className="text-[15px] text-white truncate">{space.name}</span>
            </div>
            <MemberCount count={space.members} />
            <PrivacyBadge privacy={space.privacy} />
            <KebabButton />
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-6 py-8 text-center text-[13px] text-[#7b7b7b]">
            No Spaces match your search.
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
