'use client';

/**
 * Team view. Renders the shared view chrome (breadcrumb + tab strip) over a
 * roster of per-assignee cards plus a Workload card, sourced from the same real
 * tasks the List/Board views use.
 *
 * The "Separate" toggle flips between separated per-assignee cards and a single
 * combined card. Sort + assignee filter (from the toolbar) are applied to the
 * memoised buckets before render. Tasks open the detail modal on click and the
 * shared context menu on right-click.
 *
 * Route: /<wsId>/v/team/:viewId  ->  <TeamView viewId=… />
 */

import { useMemo, useState } from 'react';
import { ViewShell } from '@/components/views/ViewShell';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { resolveViewListId } from '@/lib/view-data';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeListToken } from '@/lib/view-scope';
import type { Task } from '@/store/workspace/types';
import type { TeamBucket, TeamStatusGroup } from './team-data';
import { isTaskDone, refilterBucket, useTeamBuckets } from './team-data';
import {
  TeamToolbar,
  EMPTY_TEAM_FILTERS,
  type SortKey,
  type TeamFilters,
} from './TeamToolbar';
import { CustomizePanel, DEFAULT_TEAM_DISPLAY, type TeamDisplay } from './CustomizePanel';
import { AssigneeCard } from './AssigneeCard';
import { CombinedCard } from './CombinedCard';
import { WorkloadCard } from './WorkloadCard';
import { TEAM, TEAM_CARD } from './tokens';

/** urgent/high rank as "high priority" for the Filter popover. */
const HIGH_PRIORITY = new Set(['urgent', 'high']);
/** Lower rank renders first when sorting by priority. Unknown = normal (2). */
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const PRIORITY_RANK_DEFAULT = 2;

export function TeamView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  const effectiveScope: ViewScope = scope ?? { kind: 'list', listId: resolveViewListId(viewId) };
  const dataToken = useScopeListToken(effectiveScope, viewId);
  const listId = resolveViewListId(dataToken);
  const buckets = useTeamBuckets(dataToken);
  const { onContextMenu, menu } = useTaskContextMenu();

  const [separate, setSeparate] = useState(true);
  const [sort, setSort] = useState<SortKey>('name');
  const [filters, setFilters] = useState<TeamFilters>(EMPTY_TEAM_FILTERS);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [display, setDisplay] = useState<TeamDisplay>(DEFAULT_TEAM_DISPLAY);

  const toggleFilter = (key: keyof TeamFilters) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  const toggleDisplay = (key: keyof TeamDisplay) =>
    setDisplay((d) => ({ ...d, [key]: !d[key] }));

  const shown = useMemo(
    () => transformBuckets(buckets, assigneeFilter, filters, sort, display.hideEmpty),
    [buckets, assigneeFilter, filters, sort, display.hideEmpty],
  );

  return (
    <ViewShell code="team" viewId={viewId} scope={scope}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: TEAM.bg,
        }}
      >
        <TeamToolbar
          listId={listId}
          separate={separate}
          onToggleSeparate={() => setSeparate((v) => !v)}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onToggleFilter={toggleFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilter={setAssigneeFilter}
          customizing={customizing}
          onToggleCustomize={() => setCustomizing((v) => !v)}
        />

        {customizing && (
          <CustomizePanel
            display={display}
            onToggle={toggleDisplay}
            onClose={() => setCustomizing(false)}
          />
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {shown.length === 0 ? (
            <Empty />
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                padding: TEAM_CARD.pad,
                paddingBottom: TEAM_CARD.pad - TEAM_CARD.gutter,
                minHeight: '100%',
              }}
            >
              {display.showWorkload && <WorkloadCard buckets={shown} />}
              {separate ? (
                shown.map((b) => (
                  <AssigneeCard
                    key={b.key}
                    bucket={b}
                    listId={listId}
                    onContextMenu={onContextMenu}
                  />
                ))
              ) : (
                <CombinedCard buckets={shown} listId={listId} onContextMenu={onContextMenu} />
              )}
            </div>
          )}
        </div>
      </div>
      {menu}
    </ViewShell>
  );
}

/** True when a task survives every active Filter-popover predicate. */
function makePredicate(filters: TeamFilters): (task: Task) => boolean {
  return (task) => {
    if (filters.activeOnly && isTaskDone(task)) return false;
    if (filters.hasDueDate && task.dueDate === null) return false;
    if (filters.highPriorityOnly && !HIGH_PRIORITY.has(task.priority ?? '')) return false;
    return true;
  };
}

/** Comparator for the active sort key. Buckets sort their own group tasks. */
function makeComparator(sort: SortKey): (a: Task, b: Task) => number {
  switch (sort) {
    case 'name':
      return (a, b) => a.name.localeCompare(b.name);
    case 'name-desc':
      return (a, b) => b.name.localeCompare(a.name);
    case 'due-date':
      return (a, b) => dueValue(a) - dueValue(b);
    case 'due-date-desc':
      return (a, b) => dueValue(b) - dueValue(a);
    case 'priority':
      return (a, b) => priorityRank(a) - priorityRank(b);
    default:
      return () => 0;
  }
}

/** Missing due dates sort last in ascending order. */
function dueValue(task: Task): number {
  return task.dueDate ?? Number.POSITIVE_INFINITY;
}

function priorityRank(task: Task): number {
  return PRIORITY_RANK[task.priority ?? ''] ?? PRIORITY_RANK_DEFAULT;
}

/**
 * Apply the assignee filter and Filter-popover predicates, drop empty buckets
 * when "Hide empty assignees" is on, then sort each bucket's group tasks by the
 * active sort key. Bucket summaries are recomputed against the filtered tasks so
 * the done / not-done counts stay truthful.
 */
function transformBuckets(
  buckets: TeamBucket[],
  assigneeFilter: string | null,
  filters: TeamFilters,
  sort: SortKey,
  hideEmpty: boolean,
): TeamBucket[] {
  const keep = makePredicate(filters);
  const compare = makeComparator(sort);

  let result =
    assigneeFilter === null ? buckets : buckets.filter((b) => b.key === assigneeFilter);

  result = result
    .map((b) => refilterBucket(b, keep))
    .map((b) => ({
      ...b,
      groups: b.groups.map(
        (g): TeamStatusGroup => ({ ...g, tasks: [...g.tasks].sort(compare) }),
      ),
    }));

  if (hideEmpty) result = result.filter((b) => b.tasks.length > 0);
  return result;
}

function Empty() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: 14,
        color: TEAM.textMuted,
      }}
    >
      No tasks to show for this team yet.
    </div>
  );
}
