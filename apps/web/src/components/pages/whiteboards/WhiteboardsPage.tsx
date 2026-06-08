'use client';

import { PageSurface, PageTitle, TEXT_MUTED } from '../page-primitives';

/**
 * Whiteboards hub: /<wsId>/whiteboards. Icon-rail Whiteboards navigates here.
 */
export function WhiteboardsPage() {
  return (
    <PageSurface>
      <PageTitle>Whiteboards</PageTitle>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24 }}>
        {/* SKELETON: Phase 2 fills this in */}
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
          Brainstorm visually across every whiteboard in your workspace.
        </p>
      </div>
    </PageSurface>
  );
}
