/**
 * Static content for the Team Space Overview dashboard, transcribed 1:1 from the
 * ClickUp capture. This surface is a fixed Space landing page, so the rows are
 * real captured strings rather than store-derived data. Kept as plain typed
 * constants so the cards stay presentational.
 */

export interface RecentItem {
  name: string;
  location: string;
}

export interface DocItem {
  name: string;
  location: string;
}

export type ProgressLabel = `${number}/${number}`;

export interface ListRow {
  name: string;
  /** "0/3" style progress label; numerator/denominator drive the bar fill. */
  done: number;
  total: number;
}

export const RECENT_ITEMS: readonly RecentItem[] = [
  { name: 'Project 1', location: 'in Team Space' },
  { name: 'Get Started with ClickUp', location: 'in Team Space' },
  { name: 'TEST', location: 'in Team Space' },
];

export const DOC_ITEMS: readonly DocItem[] = [
  { name: 'Untitled', location: 'in Doc' },
  { name: 'Untitled', location: 'in Doc' },
  { name: 'Untitled', location: 'in Doc' },
  { name: 'Page 2', location: 'in Team Space' },
  { name: 'Page 1', location: 'in Team Space' },
];

export const LIST_ROWS: readonly ListRow[] = [
  { name: 'Project 1', done: 0, total: 3 },
  { name: 'Project 2', done: 0, total: 6 },
  { name: 'Get Started with ClickUp', done: 0, total: 0 },
  { name: 'TEST', done: 0, total: 0 },
];

export const LIST_COLUMNS = ['Name', 'Color', 'Progress', 'Start', 'End', 'Priority'] as const;

/** Workload-by-Status donut: matches the capture's "IN PROGRESS 1 / TO DO 11". */
export const WORKLOAD_STATUS = {
  inProgress: 1,
  toDo: 11,
} as const;
