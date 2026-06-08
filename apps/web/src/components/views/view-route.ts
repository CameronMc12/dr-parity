/**
 * URL builder for a view instance under any scope. A list scope keeps the legacy
 * `/<wsId>/v/<code>/<viewId>` path (byte-identical to before); a space/folder
 * scope nests under its scope segment: `/<wsId>/<kind>/<id>/v/<code>/<viewId>`.
 * Pure, framework-free — safe to call from event handlers.
 */

import type { ViewScope } from '@/lib/view-scope';

/** Path to a view instance for the given scope. */
export function viewRoutePath(
  wsId: string,
  scope: ViewScope,
  code: string,
  viewId: string,
): string {
  if (scope.kind === 'list') return `/${wsId}/v/${code}/${viewId}`;
  const id = scope.kind === 'space' ? scope.spaceId : scope.folderId;
  return `/${wsId}/${scope.kind}/${id}/v/${code}/${viewId}`;
}
