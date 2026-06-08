'use client';

/**
 * Client-only hydrator for the per-list views store. The store uses
 * persist({ skipHydration: true }) so SSR renders the deterministic templated
 * defaults; this triggers rehydration once on the client to swap in any
 * persisted per-list view edits. Mount alongside the workspace hydrator.
 */

import { useEffect } from 'react';
import { useViewsStore } from './index';
import { seedChannelListViews } from './channel-list-seed';

export function ViewsHydrator() {
  useEffect(() => {
    void Promise.resolve(useViewsStore.persist.rehydrate()).then(() => {
      seedChannelListViews();
    });
  }, []);
  return null;
}
