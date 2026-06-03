/**
 * Form template catalog. ClickUp's "Create a Form" screen offers a set of
 * starter templates plus a "Start from scratch" option. Picking a template
 * pre-fills the builder with a sensible title, description, and field set;
 * scratch opens a blank builder.
 *
 * Pure module — no React, no store. Each template only declares WHICH fields
 * are active; the field catalog + draft contract still live in `form-fields.ts`.
 */

import type { FieldKey } from './form-fields';

/** Stable identifiers for each starter template + the scratch sentinel. */
export type TemplateId =
  | 'feedback'
  | 'intake'
  | 'order'
  | 'application'
  | 'it-request'
  | 'scratch';

export interface FormTemplate {
  id: TemplateId;
  /** Card heading. */
  name: string;
  /** One-line card subtitle. */
  blurb: string;
  /** Icon accent colour (background tint + glyph). */
  color: string;
  /** Pre-filled builder title. */
  title: string;
  /** Pre-filled builder description. */
  description: string;
  /** Fields active when this template is chosen, in render order. */
  fields: FieldKey[];
  /** Seed dropdown choices when the field set includes `dropdown`. */
  dropdownChoices?: string[];
}

/**
 * The five starter templates, in card-grid order. `scratch` is intentionally
 * NOT in this list — it renders as a distinct "+" card after the grid.
 */
export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'feedback',
    name: 'Feedback Form',
    blurb: 'Survey and collect feedback',
    color: 'rgb(54, 120, 111)',
    title: 'Feedback Form',
    description: 'Tell us what you think. Your feedback helps us improve.',
    fields: ['name', 'email', 'description', 'dropdown'],
    dropdownChoices: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
  },
  {
    id: 'intake',
    name: 'Project Intake',
    blurb: 'Streamline new project requests',
    color: 'rgb(215, 76, 129)',
    title: 'Project Intake',
    description: 'Submit a new project request and we will route it to the right team.',
    fields: ['name', 'description', 'assignee', 'priority', 'dueDate', 'status'],
  },
  {
    id: 'order',
    name: 'Order Form',
    blurb: 'Capture and process client orders',
    color: 'rgb(98, 73, 231)',
    title: 'Order Form',
    description: 'Place a new order. We will confirm details before processing.',
    fields: ['name', 'email', 'dropdown', 'description', 'dueDate'],
    dropdownChoices: ['Standard', 'Express', 'Bulk order', 'Custom'],
  },
  {
    id: 'application',
    name: 'Job Application',
    blurb: 'Accept and review applications for open roles',
    color: 'rgb(220, 104, 42)',
    title: 'Job Application',
    description: 'Apply for an open role. Tell us about your experience.',
    fields: ['name', 'email', 'dropdown', 'description'],
    dropdownChoices: ['Engineering', 'Design', 'Product', 'Marketing', 'Operations'],
  },
  {
    id: 'it-request',
    name: 'IT Requests',
    blurb: 'Triage and prioritize IT service requests',
    color: 'rgb(71, 98, 214)',
    title: 'IT Requests',
    description: 'Report an IT issue or request access. We will triage by priority.',
    fields: ['name', 'email', 'priority', 'dropdown', 'description'],
    dropdownChoices: ['Hardware', 'Software', 'Access / permissions', 'Network', 'Other'],
  },
];

/** Lookup a single template by id (excludes the scratch sentinel). */
export function findTemplate(id: TemplateId): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}
