'use client';

/**
 * Activity view. Mirrors ClickUp's task-Activity view 1:1 (structure, toolbar,
 * empty state) in our dark theme. The body is a reverse-chronological feed of
 * task changes derived from the real task corpus (created / updated / completed
 * / moved / commented events), bucketed under day headers with a subtle left
 * timeline rail. When nothing is derivable, it renders ClickUp's exact empty
 * state ("Nothing to see here"). Owns `activity/`.
 *
 * Route: /<wsId>/v/act/:viewId  ->  <ActivityView viewId=… />
 *
 * Toolbar is the shared ViewToolbar with the SAME controls real ClickUp shows on
 * this view, in order: Subtasks · (spacer) · Filter · Assignee · search ·
 * Customize · Add Task. Every control is the working List-view menu wired to the
 * zustand store — no dead buttons. Search narrows the feed by task name; Filter /
 * Assignee narrow it via the stored view-config. Rows open the task modal on
 * click; right-click opens the shared task context menu.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  resolveViewListId,
  useViewConfigForView,
  useViewTasks,
} from '@/lib/view-data';
import { useMembers } from '@/store/workspace/hooks';
import { useUiStore } from '@/store/ui-store';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar, type ViewToolbarControl } from '@/components/views/ViewToolbar';
import { buildFeed, type FeedEntry } from './activity-feed';
import { DayGroup } from './DayGroup';
import { ActivityEmpty } from './ActivityEmpty';
import { ACT } from './tokens';

/** Exact control set ClickUp shows on the Activity view, in render order. */
const ACTIVITY_CONTROLS: ViewToolbarControl[] = [
  'subtasks',
  'filter',
  'assignee',
  'search',
  'customize',
  'addTask',
];

export function ActivityView({ viewId }: { viewId: string }) {
  const listId = resolveViewListId(viewId);
  const tasks = useViewTasks(viewId);
  const members = useMembers();
  const config = useViewConfigForView(viewId);
  const openTask = useUiStore((s) => s.openTask);
  const { onContextMenu, menu } = useTaskContextMenu();

  const [query, setQuery] = useState('');

  const days = useMemo(
    () => buildFeed(tasks, members, query, config.filters),
    [tasks, members, query, config.filters],
  );

  // The single newest entry across the whole feed reads "just now".
  const latestId = days[0]?.entries[0]?.id ?? null;

  const onEntryContextMenu = useCallback(
    (e: React.MouseEvent, entry: FeedEntry) => onContextMenu(e, entry.task),
    [onContextMenu],
  );

  return (
    <ViewShell code="act" viewId={viewId}>
      <ViewToolbar
        listId={listId}
        viewId={viewId}
        controls={ACTIVITY_CONTROLS}
        searchValue={query}
        onSearchChange={setQuery}
      />

      {days.length === 0 ? (
        <ActivityEmpty searching={query.trim().length > 0} />
      ) : (
        <div
          data-testid="activity-feed"
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: '8px 16px 48px',
            color: ACT.textPrimary,
          }}
        >
          {days.map((group) => (
            <DayGroup
              key={group.day}
              group={group}
              latestId={latestId}
              onOpen={openTask}
              onEntryContextMenu={onEntryContextMenu}
            />
          ))}
        </div>
      )}

      {menu}
    </ViewShell>
  );
}
