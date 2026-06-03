/**
 * Per-viewId form-template choice, persisted to localStorage. A Form view shows
 * the "Create a Form" template chooser until the user picks a template (or
 * "Start from scratch"); the choice is remembered per viewId so the builder
 * re-opens directly next time. Lives in the `form/` folder by design — the Form
 * view owns its own onboarding state and must not write to the shared stores.
 *
 * Mirrors the shared stores' persist conventions: curried create<State>()(
 * persist(...)), versioned key, immutable Record keyed by viewId.
 */

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TemplateId } from './form-templates';

export const FORM_CHOICE_STORAGE_KEY = 'parity-form-choice-v1';

interface FormChoiceState {
  /** Map of viewId -> chosen template id (or 'scratch'). Absent = not yet chosen. */
  choices: Record<string, TemplateId>;
  /** Persist a template choice for a view (idempotent on equal value). */
  setChoice: (viewId: string, template: TemplateId) => void;
  /** Forget a view's choice so the chooser shows again ("change template"). */
  clearChoice: (viewId: string) => void;
}

export const useFormChoiceStore = create<FormChoiceState>()(
  persist(
    (set) => ({
      choices: {},
      setChoice: (viewId, template) =>
        set((s) =>
          s.choices[viewId] === template
            ? s
            : { choices: { ...s.choices, [viewId]: template } },
        ),
      clearChoice: (viewId) =>
        set((s) => {
          if (!(viewId in s.choices)) return s;
          const next = { ...s.choices };
          delete next[viewId];
          return { choices: next };
        }),
    }),
    {
      name: FORM_CHOICE_STORAGE_KEY,
      // SSR-safe: the server render and first client render both see empty
      // `choices` (the chooser), then we rehydrate from localStorage on mount.
      skipHydration: true,
    },
  ),
);

/**
 * Rehydrate the choice store from localStorage once, on the client, after mount.
 * Returns true after rehydration so callers can hold the deterministic
 * (chooser) render until the persisted choice is available — avoiding a flash
 * of the chooser when a choice already exists, and any SSR hydration mismatch.
 */
function useHydratedChoices(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void Promise.resolve(useFormChoiceStore.persist.rehydrate()).then(() => setHydrated(true));
  }, []);
  return hydrated;
}

/**
 * The chosen template id for a view, or null if the chooser should show. Reads
 * a primitive (string | undefined), so it is referentially stable and safe to
 * use directly without useShallow/useMemo. Returns null until rehydration
 * completes so the server/client first paint stays deterministic.
 */
export function useFormChoice(viewId: string): TemplateId | null {
  const hydrated = useHydratedChoices();
  const choice = useFormChoiceStore((s) => s.choices[viewId]);
  return hydrated ? choice ?? null : null;
}
