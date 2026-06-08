/**
 * Workspace store. Local-first ClickUp data layer: tasks, tree, chat, docs,
 * members, favorites, and persisted UI state. Backed by localStorage via the
 * persist middleware. SSR-safe — hydration is deferred to the client (see
 * skipHydration + WorkspaceHydrator).
 *
 * Public API:
 *   useWorkspaceStore           — raw Zustand hook (state + actions)
 *   useWorkspaceStore.persist   — persist controls (rehydrate, hasHydrated)
 *   selectors (./selectors)     — pure derived-data helpers
 *   typed hooks (./hooks)       — convenience selector hooks
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, WorkspaceState } from './types';
import { createTaskSlice } from './tasks.slice';
import { createTreeSlice } from './tree.slice';
import { createChatSlice } from './chat.slice';
import { createDmSlice } from './dm.slice';
import { createFavoritesSlice } from './favorites.slice';
import { createViewConfigSlice } from './view-config.slice';
import { createCustomFieldsSlice } from './custom-fields';
import type { CustomFieldDef, CustomFieldValue } from './custom-fields';
import type { ViewConfig } from './view-config.types';
import {
  seedChannels,
  seedCurrentMemberId,
  seedDmMessages,
  seedDms,
  seedDocs,
  seedExpanded,
  seedMembers,
  seedRecents,
  seedTasks,
  seedTree,
} from './seed';

export const WORKSPACE_STORAGE_KEY = 'parity-workspace-v1';

function seededState() {
  return {
    tasks: seedTasks(),
    tree: seedTree(),
    channels: seedChannels(),
    messages: {} as Record<string, Message[]>,
    dms: seedDms(),
    dmMessages: seedDmMessages(),
    docs: seedDocs(),
    members: seedMembers(),
    recents: seedRecents(),
    favorites: [] as string[],
    expanded: seedExpanded(),
    currentMemberId: seedCurrentMemberId(),
    idCounter: 0,
    viewConfigs: {} as Record<string, ViewConfig>,
    customFields: {} as Record<string, CustomFieldDef[]>,
    customFieldValues: {} as Record<string, Record<string, CustomFieldValue>>,
  };
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get, store) => ({
      ...seededState(),
      ...createTaskSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createChatSlice(set, get, store),
      ...createDmSlice(set, get, store),
      ...createFavoritesSlice(set, get, store),
      ...createViewConfigSlice(set, get, store),
      ...createCustomFieldsSlice(set, get, store),
      resetWorkspace: () => set(() => seededState()),
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      version: 2,
      skipHydration: true,
      // v1 → v2: re-seed the chat-related slices so the corrected structure
      // always wins (Project 1 channel first + listId on the 4 list-backed
      // channels, Onboarding Assistant + self-DM). Other slices are preserved
      // from the persisted payload when present, else fall back to seed.
      migrate: (persisted) => {
        const prev = (persisted ?? {}) as Partial<WorkspaceState>;
        const seed = seededState();
        return {
          ...seed,
          tasks: prev.tasks ?? seed.tasks,
          tree: prev.tree ?? seed.tree,
          docs: prev.docs ?? seed.docs,
          members: prev.members ?? seed.members,
          recents: prev.recents ?? seed.recents,
          favorites: prev.favorites ?? seed.favorites,
          expanded: prev.expanded ?? seed.expanded,
          currentMemberId: prev.currentMemberId ?? seed.currentMemberId,
          viewConfigs: prev.viewConfigs ?? seed.viewConfigs,
          customFields: prev.customFields ?? seed.customFields,
          customFieldValues: prev.customFieldValues ?? seed.customFieldValues,
          idCounter: prev.idCounter ?? seed.idCounter,
          // Forced re-seed: drop stale channels/dms/messages entirely.
          channels: seed.channels,
          messages: seed.messages,
          dms: seed.dms,
          dmMessages: seed.dmMessages,
        };
      },
      // Persist data + UI state only; actions are never serialised.
      partialize: (state) => ({
        tasks: state.tasks,
        tree: state.tree,
        channels: state.channels,
        messages: state.messages,
        dms: state.dms,
        dmMessages: state.dmMessages,
        docs: state.docs,
        members: state.members,
        recents: state.recents,
        favorites: state.favorites,
        expanded: state.expanded,
        currentMemberId: state.currentMemberId,
        idCounter: state.idCounter,
        viewConfigs: state.viewConfigs,
        customFields: state.customFields,
        customFieldValues: state.customFieldValues,
      }),
    },
  ),
);

export type { WorkspaceState } from './types';
export * from './types';
export * as workspaceSelectors from './selectors';
export type {
  CustomFieldType,
  CustomFieldOption,
  CustomFieldDef,
  CustomFieldPatch,
  CreateCustomFieldInput,
  CustomFieldValue,
  CustomFieldsActions,
} from './custom-fields';
export {
  useCustomFields,
  useCustomFieldDef,
  useTaskCustomValue,
  useTaskCustomValues,
  useCustomFieldActions,
} from './custom-fields-hooks';
export {
  CUSTOM_FIELD_CATALOG,
  SUGGESTED_FIELDS,
  AI_FIELDS,
  ALL_FIELD_ENTRIES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_ORDER,
} from './custom-fields-catalog';
export type {
  FieldIconToken,
  CatalogEntry,
  CustomFieldCatalog,
} from './custom-fields-catalog';
