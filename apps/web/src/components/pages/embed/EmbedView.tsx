'use client';

/**
 * Embed view — 1:1 with ClickUp's "Any website" / embed view.
 *
 * Two states held in local component state:
 *   - no source yet → centered empty state (illustration, "No embed displayed",
 *                     "Connect a URL or source to view content", "Edit source"
 *                     button) exactly mirroring the capture. "Edit source" opens
 *                     the source-config popover (Website URL / Embed code).
 *   - source set    → slim URL bar (Reload / Open in new tab / Edit source) above
 *                     a sandboxed iframe. URL sources use `src`; embed-code
 *                     sources use `srcDoc`. Framing-blocked sites get a graceful
 *                     open-in-new-tab fallback.
 *
 * Shared chrome (breadcrumb + view tabs) comes from `ViewShell`; the shared
 * `ViewToolbar` renders directly beneath the tab strip. This view embeds a
 * single opaque source with no filterable content, so the toolbar surfaces only
 * the customize control (no search box, which would be a dead affordance).
 *
 * Route: /<wsId>/v/embed/:viewId  ->  <EmbedView viewId=… />
 * Owns the whole `embed/` folder.
 */

import { useState } from 'react';
import { resolveViewListId } from '@/lib/view-data';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeListToken } from '@/lib/view-scope';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { EmbedEmptyState } from './EmbedEmptyState';
import { EmbedFrame } from './EmbedFrame';
import type { EmbedSource } from './EmbedSourceConfig';

export function EmbedView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  const effectiveScope: ViewScope = scope ?? { kind: 'list', listId: resolveViewListId(viewId) };
  const listId = resolveViewListId(useScopeListToken(effectiveScope, viewId));

  // The connected source (null = empty state). `editing` reopens the empty
  // state (and its source-config popover) while keeping the last source prefilled.
  const [source, setSource] = useState<EmbedSource | null>(null);
  const [editing, setEditing] = useState(false);

  const showFrame = source != null && !editing;

  return (
    <ViewShell code="embed" viewId={viewId} scope={scope}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <ViewToolbar listId={listId} viewId={viewId} controls={['customize']} />

        <div style={{ flex: 1, minHeight: 0 }}>
          {showFrame && source != null ? (
            <EmbedFrame source={source} onEdit={() => setEditing(true)} />
          ) : (
            <EmbedEmptyState
              source={source}
              onApply={(next) => {
                setSource(next);
                setEditing(false);
              }}
            />
          )}
        </div>
      </div>
    </ViewShell>
  );
}
