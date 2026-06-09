'use client';

import { useMemo, useState } from 'react';
import {
  PaneShell,
  BrandTile,
  SearchInput,
  CategoryChip,
  ConnectButton,
} from './sections/appcenter-helpers';

type Category = 'All' | 'Featured' | 'Communication' | 'Development' | 'Files';

interface Integration {
  name: string;
  desc: string;
  tile: { bg: string; glyph: string };
  category: Exclude<Category, 'All'>;
  connected?: boolean;
}

const CATEGORIES: readonly Category[] = [
  'All',
  'Featured',
  'Communication',
  'Development',
  'Files',
];

const INTEGRATIONS: readonly Integration[] = [
  {
    name: 'Slack',
    desc: 'Turn messages into tasks and get notifications.',
    tile: { bg: '#4a154b', glyph: 'S' },
    category: 'Communication',
    connected: true,
  },
  {
    name: 'GitHub',
    desc: 'Link commits, branches and pull requests to tasks.',
    tile: { bg: '#1f2328', glyph: 'GH' },
    category: 'Development',
  },
  {
    name: 'Google Drive',
    desc: 'Attach and preview Drive files inside tasks.',
    tile: { bg: '#1a73e8', glyph: 'D' },
    category: 'Files',
  },
  {
    name: 'Figma',
    desc: 'Embed live Figma frames in tasks and docs.',
    tile: { bg: '#0d0d0d', glyph: 'F' },
    category: 'Development',
  },
  {
    name: 'Zoom',
    desc: 'Start and join meetings without leaving a task.',
    tile: { bg: '#2d8cff', glyph: 'Z' },
    category: 'Communication',
  },
  {
    name: 'Microsoft Teams',
    desc: 'Sync conversations and notifications with Teams.',
    tile: { bg: '#5059c9', glyph: 'T' },
    category: 'Communication',
  },
  {
    name: 'Dropbox',
    desc: 'Attach Dropbox files and keep them in sync.',
    tile: { bg: '#0061ff', glyph: 'Db' },
    category: 'Files',
  },
  {
    name: 'GitLab',
    desc: 'Connect merge requests and pipelines to tasks.',
    tile: { bg: '#fc6d26', glyph: 'GL' },
    category: 'Development',
  },
];

const FEATURED = new Set(['Slack', 'GitHub', 'Google Drive', 'Figma']);

function matchesCategory(item: Integration, category: Category): boolean {
  if (category === 'All') return true;
  if (category === 'Featured') return FEATURED.has(item.name);
  return item.category === category;
}

function IntegrationCard({ item }: { item: Integration }) {
  return (
    <div className="flex flex-col rounded-[12px] bg-[#1a1a1a] border border-[#2a2a2a] p-4">
      <div className="flex items-start justify-between gap-3">
        <BrandTile bg={item.tile.bg}>{item.tile.glyph}</BrandTile>
        <ConnectButton connected={Boolean(item.connected)} onClick={() => undefined} />
      </div>
      <p className="mt-3 text-[15px] text-white leading-tight">{item.name}</p>
      <p className="mt-1 text-[13px] leading-[18px] text-[#7b7b7b]">{item.desc}</p>
    </div>
  );
}

export function AppCenterPane() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter(
      (item) =>
        matchesCategory(item, category) &&
        (q === '' ||
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q)),
    );
  }, [query, category]);

  return (
    <PaneShell title="App Center">
      <div className="mb-5 flex flex-col gap-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search integrations"
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              active={c === category}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <IntegrationCard key={item.name} item={item} />
        ))}
      </div>
    </PaneShell>
  );
}
