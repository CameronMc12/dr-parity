'use client';

import { useState } from 'react';
import { GhostButton, PrimaryButton } from './controls';
import {
  Chip,
  PaneHeader,
  Panel,
  SearchInput,
} from './sections/fields-primitives';

/**
 * Template Center — browse and reuse saved Workspace templates. Templates /
 * Archived tabs, a search + "Create Template" toolbar, a category chip row, and
 * a list of template cards each with a "Use template" action. Matches ClickUp's
 * Template Center.
 */

type TabId = 'templates' | 'archived';
type Category = 'All' | 'Task' | 'List' | 'Doc' | 'Space';

interface Template {
  name: string;
  type: Exclude<Category, 'All'>;
  uses: number;
}

const CATEGORIES: readonly Category[] = ['All', 'Task', 'List', 'Doc', 'Space'];

const SEED_TEMPLATES: readonly Template[] = [
  { name: 'Sprint Board', type: 'List', uses: 42 },
  { name: 'Meeting Notes', type: 'Doc', uses: 128 },
  { name: 'Client Onboarding', type: 'Space', uses: 17 },
  { name: 'Bug Report', type: 'Task', uses: 73 },
];

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-9 px-1 text-[14px] font-medium transition-colors"
      style={{ color: active ? '#fff' : '#7b7b7b' }}
    >
      {label}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#3e63dd]" />
      )}
    </button>
  );
}

function usesLabel(count: number): string {
  return count === 1 ? 'Used 1 time' : `Used ${count} times`;
}

export function TemplateCenterPane() {
  const [tab, setTab] = useState<TabId>('templates');
  const [category, setCategory] = useState<Category>('All');
  const [query, setQuery] = useState('');

  const templates = SEED_TEMPLATES.filter((t) => {
    const matchesCategory = category === 'All' || t.type === category;
    const matchesQuery = t.name
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader
        title="Template Center"
        description="Reusable blueprints for Spaces, Lists, Docs and Tasks. Apply a template to spin up a fully structured workspace in seconds."
      />

      <div className="mb-5 flex items-center gap-6 border-b border-[#2a2a2a]">
        <Tab
          label="Templates"
          active={tab === 'templates'}
          onClick={() => setTab('templates')}
        />
        <Tab
          label="Archived"
          active={tab === 'archived'}
          onClick={() => setTab('archived')}
        />
      </div>

      <div className="mb-5 flex items-center justify-between gap-4">
        <SearchInput
          value={query}
          placeholder="Search templates"
          onChange={setQuery}
        />
        <PrimaryButton>Create Template</PrimaryButton>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={cat}
            active={category === cat}
            onClick={() => setCategory(cat)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {templates.map((template) => (
          <Panel key={template.name}>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-white">
                  {template.name}
                </p>
                <p className="mt-1 text-[13px] text-[#7b7b7b]">
                  {template.type} · {usesLabel(template.uses)}
                </p>
              </div>
              <GhostButton>Use template</GhostButton>
            </div>
          </Panel>
        ))}

        {templates.length === 0 && (
          <Panel>
            <div className="px-5 py-8 text-center text-[14px] text-[#7b7b7b]">
              No templates match your filters.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
