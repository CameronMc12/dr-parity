/**
 * Task CRUD slice. All mutations are immutable record updates so persist
 * snapshots stay clean and React re-renders fire correctly.
 */

import type { StateCreator } from 'zustand';
import { nextId } from './ids';
import type {
  ActivityEntry,
  ActivityKind,
  CreateTaskInput,
  Task,
  TaskComment,
  TaskPatch,
  TaskTag,
  TimeEntry,
  WorkspaceState,
} from './types';
import { fmtDuration } from './time';

const DONE_STATUS = 'closed';
const DONE_COLOR = '#6bc950';
const OPEN_STATUS = 'to do';
const OPEN_COLOR = '#87909e';

export interface TaskActions {
  createTask: (input: CreateTaskInput) => Task;
  updateTask: (id: string, patch: TaskPatch) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  moveTask: (id: string, listId: string) => void;
  setTags: (id: string, tags: TaskTag[]) => void;
  addTag: (id: string, tag: TaskTag) => void;
  removeTag: (id: string, name: string) => void;
  reorderTasks: (orderedIds: string[]) => void;
  setTimeEstimate: (id: string, minutes: number | null) => void;
  addTimeEntry: (id: string, durationMs: number, startedAt?: number) => void;
  linkTask: (id: string, targetId: string) => void;
  unlinkTask: (id: string, targetId: string) => void;
  addComment: (id: string, text: string) => void;
}

let activitySeq = 0;
function makeActivity(kind: ActivityKind, authorId: string, text: string): ActivityEntry {
  activitySeq += 1;
  return { id: `a-${Date.now()}-${activitySeq}`, kind, authorId, text, createdAt: Date.now() };
}

function fmtDay(ms: number | null | undefined): string {
  if (!ms) return 'none';
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

/** Diff a patch against the existing task into concise activity entries. */
function diffActivity(prev: Task, patch: TaskPatch, authorId: string): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  if (patch.status !== undefined && patch.status !== prev.status) {
    out.push(makeActivity('status', authorId, `set status to ${patch.status}`));
  }
  if (patch.priority !== undefined && patch.priority !== prev.priority) {
    out.push(
      makeActivity('priority', authorId, patch.priority ? `set priority to ${patch.priority}` : 'cleared priority'),
    );
  }
  if (patch.assignees !== undefined) {
    const before = new Set(prev.assignees.map((a) => a.id));
    const after = new Set(patch.assignees.map((a) => a.id));
    for (const a of patch.assignees) if (!before.has(a.id)) out.push(makeActivity('assignee', authorId, `assigned ${a.name}`));
    for (const a of prev.assignees) if (!after.has(a.id)) out.push(makeActivity('assignee', authorId, `unassigned ${a.name}`));
  }
  if (patch.dueDate !== undefined && patch.dueDate !== prev.dueDate) {
    out.push(makeActivity('dates', authorId, `set due date to ${fmtDay(patch.dueDate)}`));
  }
  if (patch.startDate !== undefined && patch.startDate !== prev.startDate) {
    out.push(makeActivity('dates', authorId, `set start date to ${fmtDay(patch.startDate)}`));
  }
  if (patch.tags !== undefined) {
    const before = new Set((prev.tags ?? []).map((t) => t.name));
    const after = new Set(patch.tags.map((t) => t.name));
    for (const t of patch.tags) if (!before.has(t.name)) out.push(makeActivity('tags', authorId, `added tag "${t.name}"`));
    for (const t of prev.tags ?? []) if (!after.has(t.name)) out.push(makeActivity('tags', authorId, `removed tag "${t.name}"`));
  }
  if (patch.description !== undefined && (patch.description ?? '') !== (prev.description ?? '')) {
    out.push(makeActivity('description', authorId, 'updated the description'));
  }
  if (patch.name !== undefined && patch.name !== prev.name) {
    out.push(makeActivity('name', authorId, `renamed to "${patch.name}"`));
  }
  if (patch.timeEstimate !== undefined && (patch.timeEstimate ?? null) !== (prev.timeEstimate ?? null)) {
    out.push(
      makeActivity(
        'estimate',
        authorId,
        patch.timeEstimate ? `set estimate to ${fmtDuration(patch.timeEstimate * 60000)}` : 'cleared estimate',
      ),
    );
  }
  return out;
}

/** Apply a patch plus auto-logged activity, returning the next task. */
function withPatch(prev: Task, patch: TaskPatch, authorId: string): Task {
  const events = diffActivity(prev, patch, authorId);
  const activity = events.length ? [...(prev.activity ?? []), ...events] : prev.activity;
  return { ...prev, ...patch, activity, dateUpdated: Date.now() };
}

/** Next free order index for a sibling group (same list + parent). */
function nextOrder(
  tasks: Record<string, Task>,
  listId: string,
  parent: string | null,
): number {
  let max = -1;
  for (const t of Object.values(tasks)) {
    if (t.listId === listId && (t.parent ?? null) === parent && t.order > max) {
      max = t.order;
    }
  }
  return max + 1;
}

export const createTaskSlice: StateCreator<WorkspaceState, [], [], TaskActions> = (
  set,
  get,
) => ({
  createTask: (input) => {
    const now = Date.now();
    const id = nextId('task', set, get);
    const parent = input.parent ?? null;
    const order =
      input.order ?? nextOrder(get().tasks, input.listId, parent);
    const task: Task = {
      id,
      name: input.name,
      status: input.status ?? OPEN_STATUS,
      statusColor: input.statusColor ?? OPEN_COLOR,
      statusType: input.statusType ?? 'open',
      listId: input.listId,
      priority: input.priority ?? null,
      priorityColor: input.priorityColor ?? null,
      dueDate: input.dueDate ?? null,
      startDate: input.startDate ?? null,
      assignees: input.assignees ?? [],
      dateCreated: now,
      dateUpdated: now,
      parent,
      archived: false,
      order,
      tags: input.tags ?? [],
      activity: [makeActivity('created', get().currentMemberId, 'created this task')],
    };
    set((state) => ({ tasks: { ...state.tasks, [id]: task } }));
    return task;
  },

  updateTask: (id, patch) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      return {
        tasks: {
          ...state.tasks,
          [id]: withPatch(existing, patch, state.currentMemberId),
        },
      };
    });
  },

  toggleTaskComplete: (id) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const done = existing.statusType === 'closed' || existing.statusType === 'done';
      const next: Task = done
        ? { ...existing, status: OPEN_STATUS, statusColor: OPEN_COLOR, statusType: 'open' }
        : { ...existing, status: DONE_STATUS, statusColor: DONE_COLOR, statusType: 'closed' };
      return { tasks: { ...state.tasks, [id]: { ...next, dateUpdated: Date.now() } } };
    });
  },

  deleteTask: (id) => {
    set((state) => {
      if (!state.tasks[id]) return {};
      const rest = { ...state.tasks };
      delete rest[id];
      // Cascade-delete subtasks so no orphans linger.
      for (const t of Object.values(rest)) {
        if (t.parent === id) delete rest[t.id];
      }
      return { tasks: rest };
    });
  },

  deleteTasks: (ids) => {
    set((state) => {
      const kill = new Set(ids);
      const rest = { ...state.tasks };
      for (const t of Object.values(state.tasks)) {
        if (kill.has(t.id) || (t.parent && kill.has(t.parent))) delete rest[t.id];
      }
      return { tasks: rest };
    });
  },

  moveTask: (id, listId) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      return {
        tasks: {
          ...state.tasks,
          [id]: { ...existing, listId, dateUpdated: Date.now() },
        },
      };
    });
  },

  setTags: (id, tags) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      return { tasks: { ...state.tasks, [id]: { ...existing, tags, dateUpdated: Date.now() } } };
    });
  },

  addTag: (id, tag) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const current = existing.tags ?? [];
      if (current.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())) return {};
      return {
        tasks: { ...state.tasks, [id]: { ...existing, tags: [...current, tag], dateUpdated: Date.now() } },
      };
    });
  },

  removeTag: (id, name) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const tags = (existing.tags ?? []).filter((t) => t.name !== name);
      return { tasks: { ...state.tasks, [id]: { ...existing, tags, dateUpdated: Date.now() } } };
    });
  },

  reorderTasks: (orderedIds) => {
    set((state) => {
      const tasks = { ...state.tasks };
      orderedIds.forEach((id, index) => {
        const t = tasks[id];
        if (t) tasks[id] = { ...t, order: index };
      });
      return { tasks };
    });
  },

  setTimeEstimate: (id, minutes) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      return {
        tasks: { ...state.tasks, [id]: withPatch(existing, { timeEstimate: minutes }, state.currentMemberId) },
      };
    });
  },

  addTimeEntry: (id, durationMs, startedAt) => {
    if (durationMs <= 0) return;
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const entry: TimeEntry = {
        id: `te-${Date.now()}`,
        authorId: state.currentMemberId,
        startedAt: startedAt ?? Date.now() - durationMs,
        durationMs,
      };
      const activity = [
        ...(existing.activity ?? []),
        makeActivity('time', state.currentMemberId, `tracked ${fmtDuration(durationMs)}`),
      ];
      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...existing,
            timeEntries: [...(existing.timeEntries ?? []), entry],
            activity,
            dateUpdated: Date.now(),
          },
        },
      };
    });
  },

  linkTask: (id, targetId) => {
    if (id === targetId) return;
    set((state) => {
      const existing = state.tasks[id];
      const target = state.tasks[targetId];
      if (!existing || !target) return {};
      const current = existing.linkedTaskIds ?? [];
      if (current.includes(targetId)) return {};
      const activity = [
        ...(existing.activity ?? []),
        makeActivity('relationship', state.currentMemberId, `linked "${target.name}"`),
      ];
      return {
        tasks: {
          ...state.tasks,
          [id]: { ...existing, linkedTaskIds: [...current, targetId], activity, dateUpdated: Date.now() },
        },
      };
    });
  },

  unlinkTask: (id, targetId) => {
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const current = existing.linkedTaskIds ?? [];
      if (!current.includes(targetId)) return {};
      const target = state.tasks[targetId];
      const activity = [
        ...(existing.activity ?? []),
        makeActivity('relationship', state.currentMemberId, `unlinked "${target?.name ?? targetId}"`),
      ];
      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...existing,
            linkedTaskIds: current.filter((x) => x !== targetId),
            activity,
            dateUpdated: Date.now(),
          },
        },
      };
    });
  },

  addComment: (id, text) => {
    const body = text.trim();
    if (!body) return;
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return {};
      const comment: TaskComment = {
        id: `c-${Date.now()}`,
        authorId: state.currentMemberId,
        text: body,
        createdAt: Date.now(),
      };
      return {
        tasks: {
          ...state.tasks,
          [id]: { ...existing, comments: [...(existing.comments ?? []), comment], dateUpdated: Date.now() },
        },
      };
    });
  },
});
