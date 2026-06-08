'use client';

/**
 * Client hydration helper for the templates store. The store uses
 * `persist({ skipHydration: true })` so SSR renders the deterministic seed set;
 * this hook triggers a one-time rehydrate on the client to merge in any persisted
 * user templates. Called from the Create-Task modal so no global hydrator mount
 * (owned by other agents) is required.
 */

import { useEffect } from 'react';
import { useTemplatesStore } from './index';

let rehydrated = false;

export function useTemplatesHydration(): void {
  useEffect(() => {
    if (rehydrated) return;
    rehydrated = true;
    void Promise.resolve(useTemplatesStore.persist.rehydrate());
  }, []);
}
