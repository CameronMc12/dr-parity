'use client';

/**
 * Field-type catalog. Maps every CustomFieldType to its colored icon, label, and
 * a short description, plus the three FieldsPanel sections (Suggested / AI / All)
 * that ClickUp's "Create new" tab renders. Icons are inline SVG glyphs tinted by
 * a per-type accent so the panel reads like ClickUp's field picker.
 *
 * Suggested entries are preset field templates (a name + a base type + seeded
 * options) rather than bare types, matching ClickUp's "Project Milestone /
 * Client Feedback / Budget Allocation / Completion Criteria" shortcuts.
 */

import type { ReactNode } from 'react';
import type {
  CustomFieldOption,
  CustomFieldType,
} from '@/store/workspace/custom-fields';

// ── Type accent colours (ClickUp field icons are each lightly tinted) ────────

export const TYPE_COLORS: Record<CustomFieldType, string> = {
  text: '#7c93b3',
  textarea: '#5b8def',
  number: '#49a8e8',
  date: '#e8675a',
  dropdown: '#9b6cf0',
  labels: '#f0a23c',
  checkbox: '#3fb27f',
  money: '#3fb27f',
  website: '#4ecdc4',
  email: '#e85a9b',
  phone: '#6c8ff0',
  rating: '#f0c23c',
  progress: '#49b6e8',
};

// ── Inline glyphs ────────────────────────────────────────────────────────────

function Glyph({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

const GLYPHS: Record<CustomFieldType, ReactNode> = {
  text: <Glyph d="M5 7h14M5 7V5h14v2M12 5v14M9 19h6" />,
  textarea: <Glyph d="M4 6h16M4 10h16M4 14h12M4 18h8" />,
  number: <Glyph d="M6 4l-1 16M14 4l-1 16M4 9h16M3 15h16" />,
  date: <Glyph d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 9h16M8 3v4M16 3v4" />,
  dropdown: <Glyph d="M5 6h14M5 12h14M5 18h14M16 4l2 2-2 2" />,
  labels: <Glyph d="M3 7a2 2 0 0 1 2-2h7l8 8-7 7-8-8V7zM7.5 9.5h.01" fill />,
  checkbox: <Glyph d="M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12l3 3 5-6" />,
  money: <Glyph d="M12 3v18M16 7.5C16 6 14.2 5 12 5S8 6 8 8s2 3 4 3.5 4 1.5 4 3.5-1.8 3-4 3-4-1-4-2.5" />,
  website: <Glyph d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z" />,
  email: <Glyph d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7l8.5 6 8.5-6" />,
  phone: <Glyph d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill />,
  rating: <Glyph d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4z" />,
  progress: <Glyph d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0zM3 12h9" />,
};

// ── Catalog entries ──────────────────────────────────────────────────────────

/** A selectable field type in the "All" section. */
export interface FieldTypeEntry {
  type: CustomFieldType;
  label: string;
  desc: string;
}

/** A one-click preset (a named field on a base type with seeded options). */
export interface FieldPreset {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: Omit<CustomFieldOption, 'id'>[];
}

export const ALL_TYPES: FieldTypeEntry[] = [
  { type: 'dropdown', label: 'Dropdown', desc: 'Single-select from set options' },
  { type: 'text', label: 'Text', desc: 'A single line of text' },
  { type: 'date', label: 'Date', desc: 'A date to show on the Calendar' },
  { type: 'textarea', label: 'Text area (Long Text)', desc: 'Multi-line rich detail' },
  { type: 'number', label: 'Number', desc: 'Any numeric value' },
  { type: 'labels', label: 'Labels', desc: 'Multi-select coloured labels' },
  { type: 'checkbox', label: 'Checkbox', desc: 'A simple yes / no toggle' },
  { type: 'money', label: 'Money', desc: 'Budget, price, or cost' },
  { type: 'website', label: 'Website', desc: 'A link to a resource' },
  { type: 'email', label: 'Email', desc: 'An email address' },
  { type: 'phone', label: 'Phone', desc: 'A phone number' },
];

export const AI_TYPES: FieldTypeEntry[] = [
  { type: 'textarea', label: 'Summary', desc: 'AI-generated summary text' },
  { type: 'text', label: 'Custom Text', desc: 'AI-filled text field' },
  { type: 'dropdown', label: 'Custom Dropdown', desc: 'AI-filled single select' },
];

export const SUGGESTED_PRESETS: FieldPreset[] = [
  {
    id: 'project-milestone',
    label: 'Project Milestone',
    type: 'dropdown',
    options: [
      { label: 'Planning', color: '#9b6cf0' },
      { label: 'In Progress', color: '#49a8e8' },
      { label: 'Launched', color: '#3fb27f' },
    ],
  },
  {
    id: 'client-feedback',
    label: 'Client Feedback',
    type: 'textarea',
  },
  {
    id: 'budget-allocation',
    label: 'Budget Allocation',
    type: 'money',
  },
  {
    id: 'completion-criteria',
    label: 'Completion Criteria',
    type: 'checkbox',
  },
];

/** Coloured type icon used in every field row + column header. */
export function FieldTypeIcon({
  type,
  size = 22,
}: {
  type: CustomFieldType;
  size?: number;
}) {
  const color = TYPE_COLORS[type];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
      }}
    >
      {GLYPHS[type]}
    </span>
  );
}

/** Human label for a field type (used by headers + rename defaults). */
export function typeLabel(type: CustomFieldType): string {
  return ALL_TYPES.find((t) => t.type === type)?.label ?? type;
}
