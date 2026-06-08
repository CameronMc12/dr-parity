'use client';

import { PageSurface, PageTitle, TEXT_MUTED } from '../page-primitives';

/**
 * Planner hub: /<wsId>/planner. Icon-rail Planner navigates here.
 */
export function PlannerPage() {
  return (
    <PageSurface>
      <PageTitle>Planner</PageTitle>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {/* SKELETON: Phase 2 fills this in */}
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
          Plan your day and schedule tasks across the calendar.
        </p>
      </div>
    </PageSurface>
  );
}
