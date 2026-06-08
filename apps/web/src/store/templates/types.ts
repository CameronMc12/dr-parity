/**
 * Task-template type contract. A template captures the default field values used
 * to pre-fill the Create-Task form, plus an optional checklist that seeds the
 * task's body. Persisted (per workspace) to localStorage via the templates store.
 */

export type TemplateStatus = 'to do' | 'in progress' | 'complete';

export interface TaskTemplate {
  id: string;
  name: string;
  /** Default status value matching the Create-Task modal's STATUSES. */
  status: TemplateStatus;
  /** Default priority key ('urgent' | 'high' | 'normal' | 'low') or null. */
  priority: string | null;
  /** Pre-filled task body / description. */
  description: string;
  /** Tag labels applied to the new task. */
  tags: string[];
  /** Checklist line items folded into the description on apply. */
  checklist: string[];
  /** True for the seeded starter templates (cannot be deleted). */
  builtin?: boolean;
}

/** Fields a user supplies when saving the current form as a template. */
export interface NewTemplateInput {
  name: string;
  status: TemplateStatus;
  priority: string | null;
  description: string;
  tags: string[];
  checklist: string[];
}

export interface TemplatesState {
  templates: TaskTemplate[];
  addTemplate: (input: NewTemplateInput) => TaskTemplate;
  removeTemplate: (id: string) => void;
  getTemplate: (id: string) => TaskTemplate | undefined;
}
