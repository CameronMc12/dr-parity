/**
 * Deterministic task-date formatter.
 *
 * `Date#toLocaleDateString(undefined, …)` resolves the locale from the host:
 * Node (server) defaults to en-US ("May 29") while a browser may be en-GB
 * ("29 May"). That divergence throws a React hydration mismatch on every load.
 * Pinning the locale to a fixed value makes server and client render identical
 * text. The options mirror the prior UI output ("Mon D", e.g. "May 29").
 */

const TASK_DATE_LOCALE = 'en-US';
const TASK_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
};

export function formatTaskDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString(TASK_DATE_LOCALE, TASK_DATE_OPTIONS);
}
