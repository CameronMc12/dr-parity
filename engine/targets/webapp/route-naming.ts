/**
 * Derive a page component name from a route path.
 *
 * The returned value is used three ways that MUST agree: the page file
 * basename (`<name>.tsx`), the exported component identifier, and the
 * import binding in `router.tsx`. Route paths can contain numeric segments
 * (e.g. ClickUp workspace ids: `/90152566819/inbox`), which would yield an
 * identifier starting with a digit — illegal JS. We prefix such names with
 * `Page` so every emitted identifier is a valid JS identifier.
 *
 * The route PATH string itself is never changed here; only the identifier.
 */

import { pascalCase } from '../shared';

export function deriveComponentName(routePath: string): string {
  if (routePath === '/' || routePath.length === 0) return 'HomePage';
  const slug = routePath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  const name = `${pascalCase(slug)}Page`;
  return /^[0-9]/.test(name) ? `Page${name}` : name;
}
