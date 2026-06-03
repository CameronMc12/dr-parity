/**
 * Custom fields data model. Per-list field definitions plus per-task values,
 * persisted inside the workspace store. Additive: nothing here changes the
 * existing task/tree/chat slices. The Table "Fields" panel and the column
 * renderers consume the types, actions, hooks, and catalog exported here.
 *
 * Persistence: the slice's `customFields` + `customFieldValues` maps are added
 * to the workspace persist partialize (see ./index.ts). Ids are minted off the
 * shared deterministic `idCounter` inside the same atomic `set` that appends the
 * field, so `createdAt` matches the id suffix — never Date.now / Math.random.
 */

import type { StateCreator } from 'zustand';
import type { WorkspaceState } from './types';

// --- Field types --------------------------------------------------------

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'labels'
  | 'checkbox'
  | 'money'
  | 'website'
  | 'email'
  | 'phone'
  | 'rating'
  | 'progress';

/** A single choice for dropdown / labels fields. */
export interface CustomFieldOption {
  id: string;
  label: string;
  color: string;
}

export interface CustomFieldDef {
  id: string;
  listId: string;
  name: string;
  type: CustomFieldType;
  /** Present only for `dropdown` and `labels`. */
  options?: CustomFieldOption[];
  createdAt: number;
}

/** Patch shape for updateCustomField — id, listId, createdAt are fixed. */
export type CustomFieldPatch = Partial<
  Pick<CustomFieldDef, 'name' | 'type' | 'options'>
>;

/** Input for createCustomField. listId comes from the action arg. */
export interface CreateCustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: CustomFieldOption[];
}

/**
 * Stored value is type-dependent but kept as `unknown` at the boundary; the
 * renderers narrow per `type`. Conventions the Table builder relies on:
 *   text/textarea/website/email/phone -> string
 *   number/money/rating/progress      -> number
 *   date                              -> number (epoch ms)
 *   checkbox                          -> boolean
 *   dropdown                          -> string (option id)
 *   labels                            -> string[] (option ids)
 */
export type CustomFieldValue = unknown;

// --- State + actions ----------------------------------------------------

export interface CustomFieldsActions {
  /** Field definitions keyed by listId. Stable empty array per list via hook. */
  customFields: Record<string, CustomFieldDef[]>;
  /** Field values keyed by taskId then fieldId. */
  customFieldValues: Record<string, Record<string, CustomFieldValue>>;

  createCustomField: (
    listId: string,
    input: CreateCustomFieldInput,
  ) => CustomFieldDef;
  updateCustomField: (fieldId: string, patch: CustomFieldPatch) => void;
  deleteCustomField: (listId: string, fieldId: string) => void;
  setCustomFieldValue: (
    taskId: string,
    fieldId: string,
    value: CustomFieldValue,
  ) => void;
  getCustomFieldValue: (taskId: string, fieldId: string) => CustomFieldValue;
}

/** Locate the listId that owns a given field id, scanning the per-list map. */
function listIdOfField(
  fields: Record<string, CustomFieldDef[]>,
  fieldId: string,
): string | null {
  for (const [listId, defs] of Object.entries(fields)) {
    if (defs.some((d) => d.id === fieldId)) return listId;
  }
  return null;
}

export const createCustomFieldsSlice: StateCreator<
  WorkspaceState,
  [],
  [],
  CustomFieldsActions
> = (set, get) => ({
  customFields: {},
  customFieldValues: {},

  createCustomField: (listId, input) => {
    let def!: CustomFieldDef;
    set((state) => {
      const counter = state.idCounter + 1;
      def = {
        id: `cf-${counter}`,
        listId,
        name: input.name,
        type: input.type,
        createdAt: counter,
        ...(input.options ? { options: input.options } : {}),
      };
      return {
        idCounter: counter,
        customFields: {
          ...state.customFields,
          [listId]: [...(state.customFields[listId] ?? []), def],
        },
      };
    });
    return def;
  },

  updateCustomField: (fieldId, patch) => {
    const listId = listIdOfField(get().customFields, fieldId);
    if (!listId) return;
    set((state) => ({
      customFields: {
        ...state.customFields,
        [listId]: (state.customFields[listId] ?? []).map((d) =>
          d.id === fieldId ? { ...d, ...patch } : d,
        ),
      },
    }));
  },

  deleteCustomField: (listId, fieldId) => {
    set((state) => {
      const remaining = (state.customFields[listId] ?? []).filter(
        (d) => d.id !== fieldId,
      );
      // Strip the value off every task that carried it.
      const values: Record<string, Record<string, CustomFieldValue>> = {};
      for (const [taskId, byField] of Object.entries(state.customFieldValues)) {
        if (fieldId in byField) {
          const { [fieldId]: _drop, ...rest } = byField;
          values[taskId] = rest;
        } else {
          values[taskId] = byField;
        }
      }
      return {
        customFields: { ...state.customFields, [listId]: remaining },
        customFieldValues: values,
      };
    });
  },

  setCustomFieldValue: (taskId, fieldId, value) => {
    set((state) => ({
      customFieldValues: {
        ...state.customFieldValues,
        [taskId]: { ...(state.customFieldValues[taskId] ?? {}), [fieldId]: value },
      },
    }));
  },

  getCustomFieldValue: (taskId, fieldId) =>
    get().customFieldValues[taskId]?.[fieldId] ?? undefined,
});
