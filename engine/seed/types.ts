/**
 * Declarative seed fixture types for the DR-PARITY-SEED ClickUp workspace.
 *
 * The fixture is a pure data structure (no imperative API calls). The seed
 * runner walks it to plan + apply. Every entity carries a stable `key` used as
 * the manifest map key, so re-runs are idempotent and the crawler can build
 * deterministic seed-scoped routes from `seed-manifest.json`.
 */

export const SEED_MARKER = 'DR-PARITY-SEED';

/** ClickUp priority ids. null = "none" (no priority set). */
export type SeedPriority = 'urgent' | 'high' | 'normal' | 'low' | null;

/** Numeric ClickUp priority value sent to the API (1=urgent ... 4=low). */
export const PRIORITY_VALUE: Record<Exclude<SeedPriority, null>, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

/**
 * Relative due-date anchors. Resolved to epoch-ms at apply time so the calendar
 * and gantt always populate around "today" regardless of when the seed runs.
 */
export type DueAnchor =
  | { offsetDays: number } // negative = past, 0 = today, positive = future
  | null;

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'drop_down'
  | 'date'
  | 'checkbox';

/**
 * A custom-field value to set on a task. `name` is matched against existing
 * fields on the list (public API cannot create fields). `dropdownOptionName`
 * is matched against the field's configured options.
 */
export interface SeedCustomFieldValue {
  name: string;
  type: CustomFieldType;
  value?: string | number | boolean;
  dropdownOptionName?: string;
  dateAnchor?: DueAnchor;
}

export interface SeedChecklistItem {
  name: string;
  resolved?: boolean;
}

export interface SeedChecklist {
  name: string;
  items: SeedChecklistItem[];
}

export interface SeedComment {
  text: string;
}

export interface SeedSubtask {
  key: string;
  name: string;
  priority?: SeedPriority;
  status?: string;
  dueAnchor?: DueAnchor;
}

export interface SeedTask {
  key: string;
  name: string;
  description?: string;
  status?: string;
  priority?: SeedPriority;
  /** assign the seed token's own user when true. */
  assignSelf?: boolean;
  startAnchor?: DueAnchor;
  dueAnchor?: DueAnchor;
  tags?: string[];
  subtasks?: SeedSubtask[];
  checklists?: SeedChecklist[];
  comments?: SeedComment[];
  customFields?: SeedCustomFieldValue[];
  /** key of another SeedTask this task depends on (gantt link). */
  dependsOnKey?: string;
}

export interface SeedTag {
  name: string;
  fg: string;
  bg: string;
}

export interface SeedList {
  key: string;
  name: string;
  content?: string;
  tasks: SeedTask[];
}

export interface SeedFolder {
  key: string;
  name: string;
  lists: SeedList[];
}

export interface SeedDocPage {
  key: string;
  name: string;
  /** markdown content. */
  content: string;
}

export interface SeedDoc {
  key: string;
  name: string;
  pages: SeedDocPage[];
}

export interface SeedGoal {
  key: string;
  name: string;
  description: string;
  dueAnchor: DueAnchor;
}

export interface SeedSpace {
  key: string;
  /** always prefixed with SEED_MARKER for the safety guard. */
  name: string;
  tags: SeedTag[];
  folders: SeedFolder[];
  /** folderless lists live directly under the space. */
  folderlessLists: SeedList[];
  docs: SeedDoc[];
  goals: SeedGoal[];
}

export interface SeedFixture {
  space: SeedSpace;
}
