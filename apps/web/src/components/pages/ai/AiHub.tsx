'use client';

import { PageSurface, PageTitle, TEXT_MUTED } from '../page-primitives';

/**
 * AI hub: /<wsId>/ai. Icon-rail AI navigates here.
 */
export function AiHub() {
  return (
    <PageSurface>
      <PageTitle>AI</PageTitle>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {/* SKELETON: Phase 2 fills this in */}
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
          Ask AI to summarize work, draft updates, and generate tasks.
        </p>
      </div>
    </PageSurface>
  );
}
