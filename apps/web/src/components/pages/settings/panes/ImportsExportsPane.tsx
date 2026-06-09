'use client';

import { SectionLabel } from './sections/general-primitives';
import { GhostButton, PrimaryButton } from './controls';
import { PaneShell, PlainCard, BrandTile } from './sections/appcenter-helpers';

interface ImportSource {
  name: string;
  tile: { bg: string; glyph: string };
}

const IMPORT_SOURCES: readonly ImportSource[] = [
  { name: 'Asana', tile: { bg: '#f06a6a', glyph: 'A' } },
  { name: 'Trello', tile: { bg: '#0079bf', glyph: 'Tr' } },
  { name: 'Jira', tile: { bg: '#2684ff', glyph: 'J' } },
  { name: 'Monday.com', tile: { bg: '#ff3d57', glyph: 'M' } },
  { name: 'Wrike', tile: { bg: '#08cf65', glyph: 'W' } },
  { name: 'Todoist', tile: { bg: '#e44332', glyph: 'Td' } },
  { name: 'CSV', tile: { bg: '#3e63dd', glyph: 'CSV' } },
];

function ImportCard({ source }: { source: ImportSource }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-[#1a1a1a] border border-[#2a2a2a] p-4">
      <BrandTile bg={source.tile.bg}>{source.tile.glyph}</BrandTile>
      <p className="min-w-0 flex-1 text-[15px] text-white leading-tight truncate">
        {source.name}
      </p>
      <GhostButton>Import</GhostButton>
    </div>
  );
}

export function ImportsExportsPane() {
  return (
    <PaneShell title="Imports / Exports">
      <SectionLabel>Import</SectionLabel>
      <p className="-mt-1 mb-4 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[520px]">
        Bring your work into ClickUp from another tool. Pick a source to map its
        projects, tasks and comments into your Workspace.
      </p>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {IMPORT_SOURCES.map((source) => (
          <ImportCard key={source.name} source={source} />
        ))}
      </div>

      <SectionLabel>Export</SectionLabel>
      <PlainCard>
        <div className="flex items-center gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-white leading-tight">
              Export Workspace data
            </p>
            <p className="mt-1 text-[13px] leading-[18px] text-[#7b7b7b] max-w-[440px]">
              Download a full copy of your Workspace, including tasks, comments
              and attachments. We will email you when the export is ready.
            </p>
          </div>
          <div className="shrink-0">
            <PrimaryButton>Request export</PrimaryButton>
          </div>
        </div>
      </PlainCard>
    </PaneShell>
  );
}
