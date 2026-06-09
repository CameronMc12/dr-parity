'use client';

import { useState } from 'react';
import { PrimaryButton } from './controls';
import {
  KebabButton,
  PaneHeader,
  Panel,
  SearchInput,
} from './sections/fields-primitives';

/**
 * Custom Field Manager — workspace-level custom field inventory. A search +
 * "New Field" toolbar above a single card-table of every field: name, type,
 * where it is used, and creation date. Matches ClickUp's Custom Fields settings.
 */

interface CustomField {
  name: string;
  type: string;
  locations: number;
  created: string;
}

const SEED_FIELDS: readonly CustomField[] = [
  { name: 'Priority', type: 'Dropdown', locations: 3, created: 'Apr 2, 2026' },
  { name: 'Story Points', type: 'Number', locations: 1, created: 'Mar 18, 2026' },
  { name: 'Sprint', type: 'Labels', locations: 2, created: 'Feb 27, 2026' },
];

const COLS = 'grid grid-cols-[1.6fr_1fr_1fr_1fr_44px] items-center gap-4';

function locationLabel(count: number): string {
  return count === 1 ? '1 location' : `${count} locations`;
}

export function CustomFieldsPane() {
  const [query, setQuery] = useState('');

  const fields = SEED_FIELDS.filter((f) =>
    f.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pt-8 pb-16">
      <PaneHeader
        title="Custom Field Manager"
        description="Create and manage the custom fields available across your Workspace. Reuse a field in multiple Lists to keep data consistent everywhere."
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <SearchInput
          value={query}
          placeholder="Search fields"
          onChange={setQuery}
        />
        <PrimaryButton>New Field</PrimaryButton>
      </div>

      <Panel>
        <div
          className={`${COLS} border-b border-[#2a2a2a] px-5 py-3 text-[12px] font-medium uppercase tracking-wide text-[#7b7b7b]`}
        >
          <span>Field name</span>
          <span>Type</span>
          <span>Used in</span>
          <span>Date created</span>
          <span />
        </div>

        {fields.map((field) => (
          <div
            key={field.name}
            className={`${COLS} border-b border-[#2a2a2a] px-5 py-4 last:border-b-0`}
          >
            <span className="truncate text-[15px] text-white">{field.name}</span>
            <span className="text-[14px] text-[#b4b4b4]">{field.type}</span>
            <span className="text-[14px] text-[#b4b4b4]">
              {locationLabel(field.locations)}
            </span>
            <span className="text-[14px] text-[#b4b4b4]">{field.created}</span>
            <KebabButton />
          </div>
        ))}

        {fields.length === 0 && (
          <div className="px-5 py-8 text-center text-[14px] text-[#7b7b7b]">
            No fields match your search.
          </div>
        )}
      </Panel>
    </div>
  );
}
