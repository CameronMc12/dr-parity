'use client';

import { PageSurface, PageTitle, TEXT_MUTED } from '../page-primitives';

/**
 * Teams hub: /<wsId>/teams. Icon-rail Teams navigates here.
 */
export function TeamsPage() {
  return (
    <PageSurface>
      <PageTitle>Teams</PageTitle>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {/* SKELETON: Phase 2 fills this in */}
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
          Manage teams and the members assigned to each one.
        </p>
      </div>
    </PageSurface>
  );
}
