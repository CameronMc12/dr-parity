/**
 * Custom-field catalog. Static, UI-agnostic metadata the Table "Fields" panel
 * renders: a Suggested section, an AI section, and the full type list. Each
 * entry carries a stable `icon` token (not a component) so the data layer stays
 * JSX-free — the Table builder maps tokens to its own glyphs.
 */

import type { CustomFieldType } from './custom-fields';

/** Stable icon token. The Table panel resolves these to its own glyph set. */
export type FieldIconToken =
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
  | 'progress'
  | 'milestone'
  | 'feedback'
  | 'budget'
  | 'criteria'
  | 'ai-summary'
  | 'ai-text'
  | 'ai-dropdown';

/** One row in any catalog section. `prefill` seeds the create form. */
export interface CatalogEntry {
  /** Stable key for the entry (not a field id; fields get minted ids on create). */
  key: string;
  label: string;
  icon: FieldIconToken;
  /** The CustomFieldType created when this entry is picked. */
  type: CustomFieldType;
  description?: string;
  /** Marks AI-authored fields so the panel can badge them. */
  ai?: boolean;
}

/** Human-readable label per field type, for the "All fields" section. */
export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  textarea: 'Text (long)',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  labels: 'Labels',
  checkbox: 'Checkbox',
  money: 'Money',
  website: 'Website',
  email: 'Email',
  phone: 'Phone',
  rating: 'Rating',
  progress: 'Progress',
};

/** Order the type picker renders in. */
export const FIELD_TYPE_ORDER: CustomFieldType[] = [
  'text',
  'textarea',
  'number',
  'money',
  'date',
  'dropdown',
  'labels',
  'checkbox',
  'progress',
  'rating',
  'website',
  'email',
  'phone',
];

/** Suggested fields ClickUp surfaces at the top of the Fields panel. */
export const SUGGESTED_FIELDS: CatalogEntry[] = [
  {
    key: 'suggested-milestone',
    label: 'Project Milestone',
    icon: 'milestone',
    type: 'dropdown',
    description: 'Track a key delivery checkpoint.',
  },
  {
    key: 'suggested-feedback',
    label: 'Client Feedback',
    icon: 'feedback',
    type: 'textarea',
    description: 'Capture notes from the client.',
  },
  {
    key: 'suggested-budget',
    label: 'Budget Allocation',
    icon: 'budget',
    type: 'money',
    description: 'Money set aside for this work.',
  },
  {
    key: 'suggested-criteria',
    label: 'Completion Criteria',
    icon: 'criteria',
    type: 'checkbox',
    description: 'Mark when the bar for done is met.',
  },
];

/** AI-authored fields shown in their own section. */
export const AI_FIELDS: CatalogEntry[] = [
  {
    key: 'ai-summary',
    label: 'Summary',
    icon: 'ai-summary',
    type: 'textarea',
    description: 'AI-written recap of the task.',
    ai: true,
  },
  {
    key: 'ai-custom-text',
    label: 'Custom Text',
    icon: 'ai-text',
    type: 'text',
    description: 'AI fills a text value from a prompt.',
    ai: true,
  },
  {
    key: 'ai-custom-dropdown',
    label: 'Custom Dropdown',
    icon: 'ai-dropdown',
    type: 'dropdown',
    description: 'AI selects from a set of options.',
    ai: true,
  },
];

/** The full type list, mapped to catalog entries for the "All fields" section. */
export const ALL_FIELD_ENTRIES: CatalogEntry[] = FIELD_TYPE_ORDER.map((type) => ({
  key: `type-${type}`,
  label: FIELD_TYPE_LABELS[type],
  icon: type,
  type,
}));

/** One object the panel can consume directly. */
export const CUSTOM_FIELD_CATALOG = {
  suggested: SUGGESTED_FIELDS,
  ai: AI_FIELDS,
  all: ALL_FIELD_ENTRIES,
} as const;

export type CustomFieldCatalog = typeof CUSTOM_FIELD_CATALOG;
