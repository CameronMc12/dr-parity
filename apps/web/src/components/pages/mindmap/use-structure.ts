/**
 * Per-view Mind Map structure choice ("tasks" | "freeform"), persisted to
 * localStorage keyed by viewId so the chooser only appears on first open. The
 * `null` structure means "not chosen yet" and triggers the chooser screen.
 *
 * Parity note: the captured ClickUp view opens straight into the Tasks tree
 * (the structure gate has already been passed for a populated list), so a view
 * with no stored choice defaults to "tasks" rather than the chooser screen. The
 * chooser is still reachable via `reset()` and on a genuinely empty list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type MindStructure = 'tasks' | 'freeform';

const KEY_PREFIX = 'cu-mindmap-structure:';

function storageKey(viewId: string): string {
  return `${KEY_PREFIX}${viewId}`;
}

function readStored(viewId: string): MindStructure | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(viewId));
    return raw === 'tasks' || raw === 'freeform' ? raw : null;
  } catch {
    return null;
  }
}

export interface StructureChoice {
  /** The chosen structure, or null while the chooser should be shown. */
  structure: MindStructure | null;
  choose: (next: MindStructure) => void;
  /** Re-open the chooser (clears the stored choice for this view). */
  reset: () => void;
}

export function useStructureChoice(viewId: string): StructureChoice {
  // Lazy-initialise from localStorage so returning users skip the one-paint
  // flash of the StructureChooser. readStored is SSR-safe (returns null on the
  // server), so hydration matches and there is no drift.
  const [structure, setStructure] = useState<MindStructure | null>(() =>
    readStored(viewId),
  );

  // Re-read only when the hook is reused for a different viewId. This does not
  // fire on first mount (lazy init already covered it), so it adds no flash.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setStructure(readStored(viewId));
  }, [viewId]);

  const choose = useCallback(
    (next: MindStructure) => {
      setStructure(next);
      try {
        window.localStorage.setItem(storageKey(viewId), next);
      } catch {
        // Storage unavailable (private mode / quota); keep the in-memory choice.
      }
    },
    [viewId],
  );

  const reset = useCallback(() => {
    setStructure(null);
    try {
      window.localStorage.removeItem(storageKey(viewId));
    } catch {
      // ignore
    }
  }, [viewId]);

  return { structure, choose, reset };
}
