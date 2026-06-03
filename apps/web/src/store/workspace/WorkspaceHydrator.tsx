'use client';

/**
 * Client-only hydrator. The workspace store uses persist({ skipHydration: true })
 * so the server render always uses the deterministic seed (no localStorage read,
 * no hydration mismatch). This component triggers rehydration once on the client
 * after mount, swapping in the user's persisted data. Mount it high in the tree
 * (e.g. inside the workspace shell).
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from './index';

export function WorkspaceHydrator() {
  useEffect(() => {
    void useWorkspaceStore.persist.rehydrate();
  }, []);
  return null;
}
