/**
 * Convenience selector hooks. Thin wrappers around useWorkspaceStore that bind
 * the pure selectors. Use these in components instead of inlining selector
 * logic. Each returns reactive derived data and re-renders on relevant change.
 *
 * Collection-returning selectors allocate a fresh array/object on every call,
 * so they MUST be wrapped in `useShallow` — otherwise useSyncExternalStore sees
 * a new reference each render and loops ("getServerSnapshot should be cached" /
 * "Maximum update depth"). Primitive-returning hooks need no wrapper.
 */

import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './index';
import * as sel from './selectors';
import type { Channel, Message, SpaceNode, Task } from './types';
import type { StatusDef } from '@/data/status-set';
import { defaultViewConfig } from './view-config.slice';
import type { ViewConfig } from './view-config.types';

/** Stable default so unconfigured lists don't allocate a fresh object each render. */
const FALLBACK_VIEW_CONFIG = defaultViewConfig();

export function useViewConfig(listId: string): ViewConfig {
  return useWorkspaceStore(
    useShallow((s) => s.viewConfigs[listId] ?? FALLBACK_VIEW_CONFIG),
  );
}

/**
 * The ordered status definitions a list shows as board columns / list groups /
 * table bands, including empty statuses. The selector caches by listId and only
 * mints a new array when the list's status SET changes, so the reference is
 * stable across renders — no `useShallow` needed and no render loop.
 */
export function useListStatuses(listId: string): StatusDef[] {
  return useWorkspaceStore((s) => sel.listStatusDefs(s, listId));
}

export function useTasksByList(listId: string): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.tasksByList(s, listId)));
}

export function useTaskById(taskId: string): Task | null {
  return useWorkspaceStore((s) => sel.taskById(s, taskId));
}

export function useSubtasks(parentId: string): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.subtasksOf(s, parentId)));
}

/** Every task in a list (top-level + subtasks), for status-option derivation. */
export function useListTasksFlat(listId: string): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.listTasksFlat(s, listId)));
}

/** All non-archived tasks, flat, for the relationship picker. */
export function useAllTasksFlat(): Task[] {
  return useWorkspaceStore(useShallow(sel.allActiveTasks));
}

export function useMembers() {
  return useWorkspaceStore(useShallow((s) => s.members));
}

export function useMyTasks(memberId?: string): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.myTasks(s, memberId)));
}

export function useOpenMyTasks(memberId?: string): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.openMyTasks(s, memberId)));
}

export function useAssignedToMe(): Task[] {
  return useWorkspaceStore(useShallow(sel.assignedToMe));
}

export function useRecentTasks(limit?: number): Task[] {
  return useWorkspaceStore(useShallow((s) => sel.recents(s, limit)));
}

export function useSpaces(): SpaceNode[] {
  return useWorkspaceStore(useShallow(sel.spaces));
}

export function useIsExpanded(nodeId: string): boolean {
  return useWorkspaceStore((s) => sel.isExpanded(s, nodeId));
}

export function useChannels(): Channel[] {
  return useWorkspaceStore(useShallow(sel.channels));
}

export function useMessagesByChannel(channelId: string): Message[] {
  return useWorkspaceStore(useShallow((s) => sel.messagesByChannel(s, channelId)));
}

export function useFavorites(): string[] {
  return useWorkspaceStore(useShallow(sel.favorites));
}

export function useIsFavorite(nodeId: string): boolean {
  return useWorkspaceStore((s) => sel.isFavorite(s, nodeId));
}

export function useCurrentMemberId(): string {
  return useWorkspaceStore((s) => s.currentMemberId);
}
