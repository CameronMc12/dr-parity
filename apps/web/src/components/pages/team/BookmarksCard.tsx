'use client';

import { OverviewCard } from './OverviewCard';
import { OverviewButton } from './OverviewButton';
import { BookmarkIcon } from './overview-icons';
import { OVERVIEW } from './overview-tokens';

export function BookmarksCard() {
  return (
    <OverviewCard title="Bookmarks" center minHeight={196}>
      <span style={{ color: OVERVIEW.textFaint, marginBottom: 12 }}>
        <BookmarkIcon />
      </span>
      <p
        style={{
          margin: '0 0 16px',
          maxWidth: 240,
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 1.5,
          color: OVERVIEW.textFaint,
        }}
      >
        Bookmarks make it easy to save ClickUp items or any URL from around the web.
      </p>
      <OverviewButton>Add Bookmark</OverviewButton>
    </OverviewCard>
  );
}
