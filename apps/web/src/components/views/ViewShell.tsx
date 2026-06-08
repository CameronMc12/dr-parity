'use client';

/**
 * Shared view chrome wrapper. Renders the standard three-row stack every view
 * uses — Breadcrumb -> tab strip -> content slot — inside the same flex column
 * container (relative / column / full-height / overflow hidden). Filled views
 * pass their own toolbar + body as children; skeletons pass a placeholder.
 *
 * Two modes, one component:
 *  - No `scope` (legacy / list routes): behaves EXACTLY as before — `viewId`
 *    resolves to a listId for the crumbs/tabs and the per-list ViewTabsBar is
 *    rendered. Zero regression.
 *  - `scope` provided: crumbs/actions/tabs are scope-aware. EVERY scope (list,
 *    space, folder) renders the SAME customizable ViewTabsBar — same default
 *    view set, +View menu (full registry), right-click rename/duplicate/delete,
 *    and drag reorder — keyed by scopeKey so list routes stay byte-identical.
 *
 * Crumbs always come from the unified `useScopeCrumbs`, which does one store
 * read and branches on scope kind inside the selector (rules of hooks safe).
 */

import type { ReactNode } from 'react';
import { resolveViewSegment } from '@/store/views';
import { VIEW_TO_LIST } from '@/data/workspace-tree';
import { viewTypeByCode } from '@/lib/view-types';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeDefaultListId } from '@/lib/view-scope';
import { Breadcrumb } from './Breadcrumb';
import { ViewTabsBar } from './ViewTabsBar';
import { useScopeCrumbs } from './useViewCrumbs';
import { ProjectActions } from '@/components/shell/header/ProjectActions';

const APP_BG = 'var(--cu-bg-app)';
const TEXT_PRIMARY = 'var(--cu-text-primary)';

/**
 * Resolve a URL view-id segment to its underlying listId. Only reached on legacy
 * list routes (scope-aware routes pass an explicit scope), where the resolved
 * scopeKey IS the listId.
 */
function listIdFor(viewId: string): string {
  return resolveViewSegment(viewId)?.scopeKey ?? VIEW_TO_LIST[viewId] ?? viewId;
}

export function ViewShell({
  code,
  viewId,
  scope: scopeProp,
  showAddChannel = true,
  header,
  children,
}: {
  code: string;
  viewId: string;
  /** Optional scope. Omitted (list routes) keeps today's exact behaviour. */
  scope?: ViewScope;
  showAddChannel?: boolean;
  /** Replaces the default Breadcrumb + ProjectActions row (e.g. Channel header). */
  header?: ReactNode;
  children: ReactNode;
}) {
  // Without an explicit scope, synthesise a list scope from viewId — identical
  // crumb/tab inputs to the previous implementation.
  const listId = listIdFor(viewId);
  const scope: ViewScope = scopeProp ?? { kind: 'list', listId };

  const label = viewTypeByCode(code)?.label ?? code;
  const crumbs = useScopeCrumbs(scope, label);
  const defaultListId = useScopeDefaultListId(scope);
  const projectName = crumbs[crumbs.length - 1]?.label ?? label;
  const actionsListId = scope.kind === 'list' ? scope.listId : defaultListId;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: APP_BG,
        color: TEXT_PRIMARY,
        overflow: 'hidden',
      }}
    >
      {header ?? (
        <Breadcrumb
          crumbs={crumbs}
          actions={
            <ProjectActions listId={actionsListId} viewId={viewId} projectName={projectName} />
          }
        />
      )}
      <ViewTabsBar scope={scope} activeCode={code} showAddChannel={showAddChannel} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
    </div>
  );
}
