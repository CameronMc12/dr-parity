/**
 * Emit the LAYOUT component for the shell/content split.
 *
 * The layout renders the persistent app shell ONCE via
 * dangerouslySetInnerHTML (same verbatim approach as the per-route stateful
 * components, so every captured attribute and scoped-CSS hook is preserved),
 * then portals a React Router <Outlet/> into the `[data-dr-parity-outlet]`
 * marker node that `buildShellHtml` stamped where the route content belongs.
 *
 * Because the shell is verbatim DOM React does not own, the Outlet cannot be
 * placed declaratively. After mount we querySelector the marker and
 * createPortal the <Outlet/> into it. The shell is rendered once and never
 * re-rendered when the route changes — only the Outlet subtree swaps — so the
 * sidebar/topbar/global nav stay mounted across navigations.
 *
 * The layout also hosts the generic interaction layer (tabs / search modal /
 * sidebar active-state) and the sidebar SPA-nav interception, both bound to the
 * same shell ref.
 */

import { emitInteractionEffect } from '../emit-stateful/interaction-layer';
import { emitSidebarNavEffect } from './sidebar-nav';
import type { SidebarNavRoute } from './sidebar-nav';

// U+2028 / U+2029 are valid in HTML but terminate a JS string literal.
const LINE_SEP_RE = new RegExp('\\u2028', 'g');
const PARA_SEP_RE = new RegExp('\\u2029', 'g');

function jsString(value: string): string {
  return (
    "'" +
    value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(LINE_SEP_RE, '\\u2028')
      .replace(PARA_SEP_RE, '\\u2029') +
    "'"
  );
}

export interface EmitLayoutArgs {
  componentName: string;
  shellHtml: string;
  routes: SidebarNavRoute[];
}

export function emitLayoutComponent(args: EmitLayoutArgs): string {
  const { componentName, shellHtml, routes } = args;

  // The interaction layer emits lines that reference `bodyRef`; we alias the
  // shell ref to `bodyRef` so those lines splice in unchanged.
  const interaction = emitInteractionEffect();
  const sidebarNav = emitSidebarNavEffect(routes);

  const head = [
    "import { useEffect, useRef, useState } from 'react';",
    "import { createPortal } from 'react-dom';",
    "import { Outlet, useNavigate } from 'react-router-dom';",
    '',
    `const __SHELL_HTML = ${jsString(shellHtml)};`,
    '',
    "const OUTLET_MARKER = '[data-dr-parity-outlet]';",
    '',
  ];

  const body: string[] = [];
  body.push(`export function ${componentName}() {`);
  body.push('  const navigate = useNavigate();');
  body.push('  const shellRef = useRef<HTMLDivElement | null>(null);');
  body.push('  const bodyRef = shellRef;');
  body.push('  const [outletNode, setOutletNode] = useState<Element | null>(null);');
  body.push('');
  // Locate the outlet marker once the verbatim shell has mounted.
  body.push('  useEffect(() => {');
  body.push('    const root = shellRef.current;');
  body.push('    if (!root) return;');
  body.push('    const node = root.querySelector(OUTLET_MARKER);');
  body.push('    setOutletNode(node);');
  body.push('  }, []);');
  body.push('');
  body.push(...interaction.lines);
  body.push('');
  body.push(...sidebarNav);
  body.push('');
  body.push('  return (');
  body.push('    <>');
  body.push(
    '      <div ref={shellRef} dangerouslySetInnerHTML={{ __html: __SHELL_HTML }} />',
  );
  body.push('      {outletNode && createPortal(<Outlet />, outletNode)}');
  body.push('    </>');
  body.push('  );');
  body.push('}');
  body.push('');
  body.push(`export default ${componentName};`);
  body.push('');

  // `bodyRef` is consumed by the spliced interaction-layer lines; reference it
  // explicitly is unnecessary since those lines use it. Keep the alias.
  return [...head, ...body].join('\n');
}
