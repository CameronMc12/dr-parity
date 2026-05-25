/**
 * SPA navigation interception for sidebar / global-nav links in the verbatim
 * shell.
 *
 * The shell renders captured chrome via dangerouslySetInnerHTML, so its <a>
 * elements carry absolute production hrefs (e.g.
 * `https://app.clickup.com/90152566819/inbox`). Letting those clicks fall
 * through triggers a full-page navigation to the production host. Instead this
 * effect intercepts clicks on any anchor whose href PATHNAME maps to a captured
 * route and calls React Router `navigate(pathname)` — client-side, no reload.
 * Unmapped links are left to no-op (preventDefault, no navigation) so the clone
 * never hard-navigates off to production.
 *
 * The route table is embedded as a literal so the effect needs no imports
 * beyond `navigate`, which the layout component already holds.
 */

export interface SidebarNavRoute {
  /** React Router path, e.g. `/90152566819/inbox`. */
  path: string;
}

/**
 * Emit the sidebar-nav interception effect lines. Bound against the shell ref
 * (`shellRef`) so it only governs anchors inside the rendered shell, and uses
 * the `navigate` function from `useNavigate()`.
 */
export function emitSidebarNavEffect(routes: SidebarNavRoute[]): string[] {
  const routeLiteral = JSON.stringify(routes.map((r) => r.path));
  return [
    '  useEffect(() => {',
    '    const root = shellRef.current;',
    '    if (!root) return;',
    `    const routePaths: string[] = ${routeLiteral};`,
    '    const matchRoute = (pathname: string): string | null => {',
    '      // Exact match first, then a prefix match so deep links still resolve.',
    '      if (routePaths.includes(pathname)) return pathname;',
    '      const prefix = routePaths.find((p) => pathname.startsWith(p));',
    '      return prefix ?? null;',
    '    };',
    '    const onClick = (e: MouseEvent) => {',
    '      const target = e.target as Element | null;',
    "      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;",
    '      if (!anchor) return;',
    '      let pathname: string;',
    '      try {',
    '        pathname = new URL(anchor.href, window.location.origin).pathname;',
    '      } catch {',
    '        return;',
    '      }',
    '      const matched = matchRoute(pathname);',
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
