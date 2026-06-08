'use client';

/**
 * Dashboard view. Renders the shared view chrome (breadcrumb + tab strip) over
 * a real, functional dashboard: a toolbar above a 12-column grid of draggable,
 * resizable cards. Layout is persisted per viewId in the dashboard store; card
 * bodies read the underlying list's real tasks.
 *
 * Route: /<wsId>/v/dash/:viewId  ->  <DashboardView viewId=… />
 */

import { useState } from 'react';
import { ViewShell } from '@/components/views/ViewShell';
import { resolveViewListId } from '@/lib/view-data';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeListToken } from '@/lib/view-scope';
import { useEnsureDashboard } from '@/store/dashboard/hooks';
import { DashboardToolbar } from './DashboardToolbar';
import { DashboardGrid } from './DashboardGrid';
import { AddCardModal } from './AddCardModal';
import { DASH } from './tokens';

export function DashboardView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  const effectiveScope: ViewScope = scope ?? { kind: 'list', listId: resolveViewListId(viewId) };
  // Card bodies read a concrete list's tasks; layout persists per route viewId.
  const listId = resolveViewListId(useScopeListToken(effectiveScope, viewId));
  useEnsureDashboard(viewId);

  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <ViewShell code="dash" viewId={viewId} scope={scope}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: DASH.bg,
        }}
      >
        <DashboardToolbar
          viewId={viewId}
          listId={listId}
          editing={editing}
          onToggleEditing={() => setEditing((v) => !v)}
          onAddCard={() => setAddOpen(true)}
        />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <DashboardGrid
            viewId={viewId}
            listId={listId}
            editing={editing}
            onRequestEditing={() => setEditing(true)}
          />
        </div>
      </div>

      <AddCardModal
        viewId={viewId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
    </ViewShell>
  );
}
