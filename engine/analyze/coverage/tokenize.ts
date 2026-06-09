/**
 * Path tokenizers replicated from the surface-map extractors so that run URLs
 * are normalised the SAME way the surface map was built. The originals in
 * `engine/analyze/surface-map/{endpoints,routes}.ts` are not exported, so they
 * are mirrored here verbatim. Keep these in sync if the originals change.
 */

const HEX24_RE = /^[0-9a-f]{24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d{3,}$/;
const VIEW_ID_RE = /^[a-z0-9]+-\d+$/i;
const HEX_BLOB_RE = /^[0-9a-f]{12,}$/i;
const TASK_ID_RE = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{6,}$/i;
const ID_CONTEXT = new Set(['task', 'tasks', 'comments', 'comment', 'list', 'lists']);
const KEEP_WORDS = new Set([
  'tree', 'search', 'bulk', 'jobs', 'sidebar', 'workspaces', 'experience',
  'handshake', 'task', 'fields', 'field', 'project', 'comment', 'data',
  'inbox', 'plan', 'cards', 'notification', 'gateway', 'graphql', 'shard',
]);

function tokenizeEndpointSegment(seg: string, prev: string): string {
  if (!seg) return seg;
  if (KEEP_WORDS.has(seg.toLowerCase())) return seg;
  if (UUID_RE.test(seg)) return ':uuid';
  if (HEX24_RE.test(seg)) return ':id';
  if (VIEW_ID_RE.test(seg)) return ':viewId';
  if (TASK_ID_RE.test(seg)) return ':taskId';
  if (NUMERIC_RE.test(seg)) return ':id';
  if (HEX_BLOB_RE.test(seg)) return ':hash';
  if (ID_CONTEXT.has(prev.toLowerCase()) && /^\d+$/.test(seg)) return ':id';
  return seg;
}

/** Mirror of surface-map endpoints.ts buildTemplate. */
export function buildEndpointTemplate(pathname: string): string {
  const segs = pathname.split('/');
  return segs.map((seg, i) => tokenizeEndpointSegment(seg, segs[i - 1] ?? '')).join('/');
}

const WSID_RE = /^\d{8,}$/;

/** Mirror of surface-map routes.ts patternize. */
export function patternizeRoute(pathname: string): string {
  return pathname
    .split('/')
    .map((s) => (WSID_RE.test(s) ? ':wsid' : VIEW_ID_RE.test(s) ? ':viewId' : s))
    .join('/');
}
