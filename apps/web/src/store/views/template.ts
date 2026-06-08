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
 * The default templated view set for a scope. The instance id of each default
 * view is the scopeKey itself so list URLs stay `/<ws>/v/<code>/<listId>` (the
 * scopeKey of a list IS its listId). Order matches `DEFAULT_VIEW_CODES` (List,
 * Board, Calendar, Gantt, Table). `listId` mirrors `scopeKey` for back-compat.
 */
export function templateViews(scopeKey: string): View[] {
  return DEFAULT_VIEW_CODES.map((code) => ({
    id: scopeKey,
    code,
    name: defaultViewName(code),
    scopeKey,
    listId: scopeKey,
  }));
}

/**
 * Derive a stable instance id for an extra (non-default) added view. `n` is the
 * 1-based ordinal of this code within the scope, so a second Board becomes
 * `<scopeKey>~b~2`. The scopeKey may itself contain no `~`, so splitting on the
 * LAST two separators recovers a multi-segment scopeKey unambiguously.
 */
export function deriveViewId(scopeKey: string, code: string, n: number): string {
  return `${scopeKey}${VIEW_ID_SEP}${code}${VIEW_ID_SEP}${n}`;
}

/**
 * Parse a derived extra-instance id back into its parts. Returns null when the
 * segment is not in the `<scopeKey>~<code>~<n>` shape (i.e. it is a raw scopeKey
 * for a default-template instance). A space/folder scopeKey contains a `:` but no
 * `~`, so the trailing two `~`-delimited fields are always `<code>~<n>`.
 */
export function parseDerivedViewId(
  seg: string,
): { scopeKey: string; code: string } | null {
  const last = seg.lastIndexOf(VIEW_ID_SEP);
  if (last <= 0) return null;
  const prev = seg.lastIndexOf(VIEW_ID_SEP, last - 1);
  if (prev <= 0) return null;
  const scopeKey = seg.slice(0, prev);
  const code = seg.slice(prev + 1, last);
  const ordinal = seg.slice(last + 1);
  if (!scopeKey || !code || !/^\d+$/.test(ordinal)) return null;
  return { scopeKey, code };
}
