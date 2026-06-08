'use client';

import { PageSurface, PageTitle, TEXT_MUTED } from '../page-primitives';

/**
 * Timesheets hub: /<wsId>/timesheets. Icon-rail Timesheets navigates here.
 */
export function TimesheetsPage() {
  return (
    <PageSurface>
      <PageTitle>Timesheets</PageTitle>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {/* SKELETON: Phase 2 fills this in */}
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
          Review tracked time across people and projects.
        </p>
      </div>
    </PageSurface>
  );
}
