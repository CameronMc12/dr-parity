/**
 * Standalone task-templates store. Holds the list of reusable task templates the
 * Create-Task modal can apply. Built-in starter templates are always merged in
 * ahead of any user-created ones; only user templates persist to localStorage.
 *
 * Mirrors the workspace/views persist conventions: curried `create<State>()(...)`,
 * versioned localStorage key, `skipHydration` with a client hydrator, and a
 * `partialize` that stores only user-created templates (built-ins re-merge from
 * SEED_TEMPLATES on every hydrate, so seed edits ship without a migration).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NewTemplateInput, TaskTemplate, TemplatesState } from './types';
import { SEED_TEMPLATES } from './seed';

export const TEMPLATES_STORAGE_KEY = 'parity-templates-v1';

/** Merge built-ins (always first) with persisted user templates, deduped by id. */
function withSeed(userTemplates: TaskTemplate[]): TaskTemplate[] {
  const seedIds = new Set(SEED_TEMPLATES.map((t) => t.id));
  const user = userTemplates.filter((t) => !t.builtin && !seedIds.has(t.id));
  return [...SEED_TEMPLATES, ...user];
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: SEED_TEMPLATES,

      addTemplate: (input: NewTemplateInput) => {
        const template: TaskTemplate = {
          id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          name: input.name.trim() || 'Untitled template',
          status: input.status,
          priority: input.priority,
          description: input.description,
          tags: input.tags,
          checklist: input.checklist,
        };
        set((state) => ({ templates: [...state.templates, template] }));
        return template;
      },

      removeTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id || t.builtin),
        })),

      getTemplate: (id) => get().templates.find((t) => t.id === id),
    }),
    {
      name: TEMPLATES_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      // Persist only user-created templates; re-merge built-ins on hydrate.
      partialize: (state) => ({
        templates: state.templates.filter((t) => !t.builtin),
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<TemplatesState>;
        return { ...current, templates: withSeed(stored.templates ?? []) };
      },
    },
  ),
);

export type { TaskTemplate, NewTemplateInput, TemplatesState } from './types';
