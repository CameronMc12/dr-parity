/**
 * Build a view-type → captured-route fallback map for SPA nav interception.
 *
 * ClickUp (and similar SPAs) expose a view bar whose tabs are anchors of the
 * form `/{workspace}/v/{type}/{id...}` where `{type}` is the view kind:
 *   l  = List      b  = Board     t  = Table
 *   li = Timeline  tl = Timeline  c  = Calendar   dc = Doc   g = Gantt ...
 *
 * The crawler only captures a handful of these view ids as real routes. A tab
 * pointing at an UNCAPTURED view id (e.g. the visible "Board" tab targeting a
 * sublist board) has no exact route to navigate to, so a plain
 * `routePaths.includes(pathname)` match returns null and the click dies.
 *
 * To make every view tab live, we map each captured route to its view-type and
 * emit a `{ viewType -> capturedRoutePath }` table. An unmatched view link then
 * falls back to the captured route of the SAME view-type — clicking any
 * board-type tab lands on the captured Board route, any timeline tab on the
 * captured Timeline route, and so on. This is the "closest captured route"
 * behaviour the nav layer needs: same kind of view, real captured content.
 */

/**
 * Canonical view-type buckets. Different ClickUp segment codes that render the
 * same kind of view are folded into one bucket so a Timeline tab (`tl`) and a
 * subtask-timeline (`li`) both resolve to the captured Timeline route.
 */
const VIEW_TYPE_ALIASES: Record<string, string> = {
  l: 'list',
  li: 'timeline',
  tl: 'timeline',
  b: 'board',
  t: 'table',
  c: 'calendar',
  g: 'gantt',
  dc: 'doc',
  cn: 'channel',
  s: 'space',
  f: 'folder',
};

/**
 * Extract the canonical view-type bucket from a route/href pathname. Returns
 * null when the path is not a `/v/{type}/...` view URL.
 */
export function viewTypeOf(pathname: string): string | null {
  const match = /\/v\/([a-z]+)(?:\/|$)/.exec(pathname);
  if (!match) return null;
  const code = match[1];
  return VIEW_TYPE_ALIASES[code] ?? code;
}

/**
 * Build the `{ viewType -> capturedRoutePath }` fallback map from the captured
 * route paths. The FIRST captured route of each view-type wins (routes are
 * emitted in capture order, so this is the earliest/most-canonical one).
 */
export function buildViewTypeMap(routePaths: readonly string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const path of routePaths) {
    const type = viewTypeOf(path);
    if (type && !(type in map)) map[type] = path;
  }
  return map;
}
