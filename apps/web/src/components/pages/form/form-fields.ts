/**
 * Field catalog + form-state contract for the Form view. The left rail lists
 * every addable ClickUp field type; the preview renders the ones currently in
 * `activeFields`. Submitting maps the draft onto a real `createTask` input.
 *
 * Pure module — no React, no store. Keeps the view body small and testable.
 */

import type { Assignee } from '@/store/workspace/types';

/** Stable identifiers for each ClickUp form field type. */
export type FieldKey =
  | 'name'
  | 'description'
  | 'assignee'
  | 'priority'
  | 'dueDate'
  | 'status'
  | 'email'
  | 'dropdown';

export interface FieldDef {
  key: FieldKey;
  label: string;
  /** One-line hint shown under the rail label. */
  hint: string;
  /** Required fields can't be removed and always validate as non-empty. */
  locked: boolean;
}

/** The full ClickUp form field palette, in rail order. */
export const FIELD_CATALOG: FieldDef[] = [
  { key: 'name', label: 'Task name', hint: 'Short answer', locked: true },
  { key: 'description', label: 'Description', hint: 'Long answer', locked: false },
  { key: 'assignee', label: 'Assignee', hint: 'People picker', locked: false },
  { key: 'priority', label: 'Priority', hint: 'Single select', locked: false },
  { key: 'dueDate', label: 'Due date', hint: 'Date picker', locked: false },
  { key: 'status', label: 'Status', hint: 'Single select', locked: false },
  { key: 'email', label: 'Email', hint: 'Email address', locked: false },
  { key: 'dropdown', label: 'Dropdown', hint: 'Single select', locked: false },
];

/** Fields present in a brand-new ClickUp form, in render order. */
export const DEFAULT_ACTIVE_FIELDS: FieldKey[] = [
  'name',
  'description',
  'assignee',
  'priority',
  'dueDate',
  'status',
];

/**
 * Seed choices for a brand-new "Dropdown" field (mirrors ClickUp's sample).
 * These are the initial state only — the builder edits them at runtime via the
 * ChoicesEditor, so this returns a fresh mutable array each call.
 */
export function defaultDropdownChoices(): string[] {
  return ['Option 1', 'Option 2', 'Option 3'];
}

/** Mutable working copy of the responder's answers. */
export interface FormDraft {
  name: string;
  description: string;
  assignees: Assignee[];
  priority: string | null;
  dueDate: number | null;
  status: { status: string; statusColor: string; statusType: string } | null;
  email: string;
  dropdown: string | null;
}

export function emptyDraft(): FormDraft {
  return {
    name: '',
    description: '',
    assignees: [],
    priority: null,
    dueDate: null,
    status: null,
    email: '',
    dropdown: null,
  };
}

export function fieldDef(key: FieldKey): FieldDef {
  const def = FIELD_CATALOG.find((f) => f.key === key);
  if (!def) throw new Error(`Unknown form field: ${key}`);
  return def;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate a draft against the active fields. Only `name` is hard-required;
 * `email` (if active and filled) must be a valid address. An empty email is
 * accepted on purpose: in V1 every non-name field is optional and the builder
 * has no per-field "required" toggle yet. Returns a map of field -> error
 * message for every field that fails.
 *
 * TODO(form-required): add a per-field `required` flag to FieldDef and enforce
 * it here once the builder rail exposes a required toggle.
 */
export function validateDraft(
  draft: FormDraft,
  active: FieldKey[],
): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (active.includes('name') && draft.name.trim().length === 0) {
    errors.name = 'This field is required';
  }
  if (active.includes('email') && draft.email.trim().length > 0 && !EMAIL_RE.test(draft.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
}
