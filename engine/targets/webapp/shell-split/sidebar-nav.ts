/**
 * SPA navigation interception for sidebar / global-nav / view-tab links in the
 * verbatim shell.
 *
 * The shell renders captured chrome via dangerouslySetInnerHTML, so its <a>
 * elements carry absolute production hrefs (e.g.
 * `https://app.clickup.com/90152566819/inbox`). Letting those clicks fall
 * through triggers a full-page navigation to the production host. Instead this
 * effect intercepts clicks on any anchor whose href PATHNAME maps to a captured
 * route and calls React Router `navigate(pathname)` — client-side, no reload.
 *
 * Match precedence (closest captured route wins):
 *   1. Exact pathname match against a captured route.
 *   2. Prefix match (deep links into a captured route still resolve).
 *   3. View-type fallback — for `/{ws}/v/{type}/...` view-bar tabs whose exact
 *      id was never captured (e.g. the "Board" tab targeting a sublist board),
 *      navigate to the captured route of the SAME view-type. This makes every
 *      List/Board/Timeline/Table tab live even when only one route per type was
 *      captured.
 *   4. Otherwise no-op (preventDefault, no navigation) so the clone never
 *      hard-navigates off to production.
 *
 * The route table and view-type map are embedded as literals so the effect
 * needs no imports beyond `navigate`, which the layout component already holds.
 */

import { buildViewTypeMap } from './view-type-map';

export interface SidebarNavRoute {
  /** React Router path, e.g. `/90152566819/inbox`. */
  path: string;
}

/**
 * Captured-app hostname (e.g. `app.clickup.com`). Same-origin detection treats
 * any link to this host as a captured-app link the interceptor governs, even
 * when the captured DOM hard-codes the absolute production href. Empty string
 * falls back to window-origin-only same-origin detection.
 */
function emitCaptureHost(captureHost: string): string {
  return JSON.stringify(captureHost);
}

/**
 * Emit the sidebar-nav interception effect lines. Bound against the shell ref
 * (`shellRef`) so it only governs anchors inside the rendered shell, and uses
 * the `navigate` function from `useNavigate()`.
 */
export function emitSidebarNavEffect(
  routes: SidebarNavRoute[],
  captureHost: string,
): string[] {
  const routePaths = routes.map((r) => r.path);
  const routeLiteral = JSON.stringify(routePaths);
  const viewTypeLiteral = JSON.stringify(buildViewTypeMap(routePaths));
  return [
    '  useEffect(() => {',
    '    const root = shellRef.current;',
    '    if (!root) return;',
    `    const captureHost = ${emitCaptureHost(captureHost)};`,
    `    const routePaths: string[] = ${routeLiteral};`,
    `    const viewTypeRoutes: Record<string, string> = ${viewTypeLiteral};`,
    '    const aliases: Record<string, string> = {',
    "      l: 'list', li: 'timeline', tl: 'timeline', b: 'board', t: 'table',",
    "      c: 'calendar', g: 'gantt', dc: 'doc', cn: 'channel', s: 'space', f: 'folder',",
    '    };',
    '    const viewTypeOf = (pathname: string): string | null => {',
    '      const m = /\\/v\\/([a-z]+)(?:\\/|$)/.exec(pathname);',
    '      if (!m) return null;',
    '      return aliases[m[1]] ?? m[1];',
    '    };',
    '    const matchRoute = (pathname: string): string | null => {',
    '      // 1. Exact match. 2. Prefix match (deep links). 3. Same view-type',
    '      // fallback so uncaptured view tabs land on the captured route of the',
    '      // same kind. 4. null => safe no-op.',
    '      if (routePaths.includes(pathname)) return pathname;',
    '      const prefix = routePaths.find((p) => pathname.startsWith(p));',
    '      if (prefix) return prefix;',
    '      const type = viewTypeOf(pathname);',
    '      if (type && viewTypeRoutes[type]) return viewTypeRoutes[type];',
    '      return null;',
    '    };',
    '    const onClick = (e: MouseEvent) => {',
    '      const target = e.target as Element | null;',
    "      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;",
    '      if (!anchor) return;',
    '      let url: URL;',
    '      try {',
    '        url = new URL(anchor.href, window.location.origin);',
    '      } catch {',
    '        return;',
    '      }',
    '      // Leave genuinely external links (other origins) alone so they still',
    '      // open. Only same-origin captured-app links are governed here.',
    '      const sameOrigin =',
    '        url.origin === window.location.origin ||',
    '        url.hostname === captureHost;',
    '      if (!sameOrigin) return;',
    '      const matched = matchRoute(url.pathname);',
    '      // Always stop the browser from hard-navigating to the captured',
    '      // production href. Mapped links navigate client-side; unmapped links',
    '      // simply no-op so the clone stays on the current route.',
    '      e.preventDefault();',
    '      if (matched) navigate(matched);',
    '    };',
    "    root.addEventListener('click', onClick, true);",
    "    return () => root.removeEventListener('click', onClick, true);",
    '    // eslint-disable-next-line react-hooks/exhaustive-deps',
    '  }, []);',
  ];
}
