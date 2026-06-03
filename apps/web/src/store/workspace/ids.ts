/**
 * Deterministic id helper. Pulls the next value off the store's persisted
 * incrementing counter so new ids are stable across reloads and free of
 * Math.random / Date.now at module scope.
 */

import type { WorkspaceState } from './types';

type Set = (
  partial:
    | Partial<WorkspaceState>
    | ((state: WorkspaceState) => Partial<WorkspaceState>),
) => void;
type Get = () => WorkspaceState;

export function nextId(prefix: string, set: Set, _get: Get): string {
  let minted = '';
  set((state) => {
    const n = state.idCounter + 1;
    minted = `${prefix}-${n}`;
    return { idCounter: n };
  });
  return minted;
}
