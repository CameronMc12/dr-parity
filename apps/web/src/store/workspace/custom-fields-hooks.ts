/**
 * Custom-field selector hooks. Thin wrappers around useWorkspaceStore.
 *
 * Collection selectors allocate a fresh array each call, so they MUST go through
 * `useShallow` (else useSyncExternalStore loops). A module-level frozen empty
 * array is the stable fallback for unconfigured lists so the reference never
 * changes between renders. The action accessor returns the live action fns,
 * which Zustand keeps referentially stable across renders.
 */

import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './index';
import type {
  CustomFieldDef,
  CustomFieldValue,
  CustomFieldsActions,
} from './custom-fields';

/** Stable empty array so lists with no fields don't churn references. */
const EMPTY_FIELDS: readonly CustomFieldDef[] = Object.freeze([]);

/** Field definitions for a list, stable ref. Empty -> shared frozen array. */
export function useCustomFields(listId: string): CustomFieldDef[] {
  return useWorkspaceStore(
    useShallow((s) => s.customFields[listId] ?? (EMPTY_FIELDS as CustomFieldDef[])),
  );
}

/**
 * A single field definition by id within one list. null if absent.
 *
 * The selector returns the stored def object reference directly (or null), so it
 * is already render-stable today. `useShallow` is applied for consistency with
 * the other collection hooks and to keep this safe if the selector is ever
 * extended to return a freshly-allocated/derived shape.
 */
export function useCustomFieldDef(
  listId: string,
  fieldId: string,
): CustomFieldDef | null {
  return useWorkspaceStore(
    useShallow(
      (s) => s.customFields[listId]?.find((d) => d.id === fieldId) ?? null,
    ),
  );
}

/** One task's value for one field. undefined when unset. */
export function useTaskCustomValue(
  taskId: string,
  fieldId: string,
): CustomFieldValue {
  return useWorkspaceStore((s) => s.customFieldValues[taskId]?.[fieldId]);
}

/** All custom values for a single task (fieldId -> value), stable ref. */
export function useTaskCustomValues(
  taskId: string,
): Record<string, CustomFieldValue> {
  return useWorkspaceStore(
    useShallow((s) => s.customFieldValues[taskId] ?? EMPTY_VALUES),
  );
}

const EMPTY_VALUES: Record<string, CustomFieldValue> = Object.freeze({});

/** Action accessor. Returns the live, referentially-stable action functions. */
export function useCustomFieldActions(): Pick<
  CustomFieldsActions,
  | 'createCustomField'
  | 'updateCustomField'
  | 'deleteCustomField'
  | 'setCustomFieldValue'
  | 'getCustomFieldValue'
> {
  return useWorkspaceStore(
    useShallow((s) => ({
      createCustomField: s.createCustomField,
      updateCustomField: s.updateCustomField,
      deleteCustomField: s.deleteCustomField,
      setCustomFieldValue: s.setCustomFieldValue,
      getCustomFieldValue: s.getCustomFieldValue,
    })),
  );
}
