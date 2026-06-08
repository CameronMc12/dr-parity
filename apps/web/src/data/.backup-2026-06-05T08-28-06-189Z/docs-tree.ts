import docsJson from './docs-tree.json';

/**
 * A single doc as it appears in the Docs sidebar tree. Sourced from the real
 * ClickUp export (`docs/research/clickup-export/.../docs.json`) and trimmed to
 * the fields the sidebar renders. Rows are pre-sorted by `updated` descending
 * so the list matches ClickUp's "Recent" ordering.
 */
export interface DocNode {
  id: string;
  name: string;
  /** Resolved space/folder name shown as the row subtitle (the doc's Location). */
  location: string;
  /** Emoji avatar from the export, or null when the doc uses the default icon. */
  emoji: string | null;
  /** Number of pages the doc contains. */
  pageCount: number;
  /** Last-updated epoch ms, used for the recency sort. */
  updated: number;
}

export const DOCS_TREE = docsJson as DocNode[];
