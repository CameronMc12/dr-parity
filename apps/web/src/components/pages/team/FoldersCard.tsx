'use client';

import { OverviewCard } from './OverviewCard';
import { OverviewButton } from './OverviewButton';
import { FolderIcon } from './overview-icons';
import { OVERVIEW } from './overview-tokens';

export function FoldersCard() {
  return (
    <OverviewCard title="Folders" span={3} center minHeight={172}>
      <span style={{ color: OVERVIEW.textFaint, marginBottom: 12 }}>
        <FolderIcon />
      </span>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: OVERVIEW.textFaint }}>
        Add new Folder to your Space
      </p>
      <OverviewButton>Add Folder</OverviewButton>
    </OverviewCard>
  );
}
