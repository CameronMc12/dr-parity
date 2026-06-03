/**
 * Templating + id helpers for the per-list views store. Pure, framework-free, so
 * they can be unit-tested and called outside React (e.g. the route resolver).
 */

import { DEFAULT_VIEW_CODES, viewTypeByCode } from '@/lib/view-types';
import type { View } from './types';

/** Separator for derived extra-instance ids: `<listId>~<code>~<n>`. */
export const VIEW_ID_SEP = '~';

/** Display name for a code, falling back to the code itself. */
export function defaultViewName(code: string): string {
  return viewTypeByCode(code)?.label ?? code;
}

/**
 * The default templated view set for a list. The instance id of each default
 * view is the listId itself so URLs stay `/<ws>/v/<code>/<listId>`. Order matches
 * `DEFAULT_VIEW_CODES` (List, Board, Calendar, Gantt, Table).
 */
export function templateViews(listId: string): View[] {
  return DEFAULT_VIEW_CODES.map((code) => ({
    id: listId,
    code,
    name: defaultViewName(code),
    listId,
  }));
}

/**
 * Derive a stable instance id for an extra (non-default) added view. `n` is the
 * 1-based ordinal of this code within the list, so a second Board becomes
 * `<listId>~b~2`.
 */
export function deriveViewId(listId: string, code: string, n: number): string {
  return `${listId}${VIEW_ID_SEP}${code}${VIEW_ID_SEP}${n}`;
}

/**
 * Parse a derived extra-instance id back into its parts. Returns null when the
 * segment is not in the `<listId>~<code>~<n>` shape (i.e. it is a raw listId for
 * a default-template instance).
 */
export function parseDerivedViewId(
  seg: string,
): { listId: string; code: string } | null {
  const parts = seg.split(VIEW_ID_SEP);
  if (parts.length !== 3) return null;
  const [listId, code] = parts;
  if (!listId || !code) return null;
  return { listId, code };
}
