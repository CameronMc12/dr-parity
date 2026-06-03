'use client';

import { useMemo, useState } from 'react';
import { QuickAddRow } from '@/components/create/QuickAddRow';
import { TaskRow } from '@/components/create/TaskRow';
import { useMyTasks, useSpaces } from '@/store/workspace/hooks';
import { useUiStore } from '@/store/ui-store';
import type { Task } from '@/store/workspace/types';
import {
  BORDER,
  EllipsisIcon,
  PageSurface,
  PlusIcon,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from './page-primitives';

/**
 * Home → My Tasks (oracle: /my-work). Renders the current member's live tasks
 * from the workspace store, split into To Do / Complete groups, with an inline
 * quick-add and per-row interactions. Falls back to the ClickUp onboarding hero
 * when the member has no tasks yet.
 */
export function MyTasksPage() {
  const tasks = useMyTasks();
  const spaces = useSpaces();
  const openCreateTask = useUiStore((s) => s.openCreateTask);

  // First list in the tree is the default target for quick-add.
  const firstListId = useMemo(() => {
    for (const s of spaces) {
      if (s.folderlessLists[0]) return s.folderlessLists[0].id;
      for (const f of s.folders) if (f.lists[0]) return f.lists[0].id;
    }
    return '';
  }, [spaces]);

  const { todo, done } = useMemo(() => split(tasks), [tasks]);

  return (
    <PageSurface>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>My Tasks</span>
        <span style={{ fontSize: 13, color: TEXT_MUTED }}>{tasks.length}</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => openCreateTask(firstListId || undefined)}
          data-testid="my-tasks-new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            paddingLeft: 10,
            paddingRight: 12,
            background: 'var(--cu-text-primary)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--cu-bg-app)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <PlusIcon size={14} />
          New Task
        </button>
        <button
          aria-label="More"
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: TEXT_MUTED,
          }}
        >
          <EllipsisIcon />
        </button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState onCreate={() => openCreateTask(firstListId || undefined)} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 40 }}>
          <Group label="To Do" count={todo.length}>
            {todo.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
            <QuickAddRow listId={firstListId} />
          </Group>

          {done.length > 0 ? (
            <Group label="Complete" count={done.length}>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </PageSurface>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 24px 6px',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_SECONDARY }}>{label}</span>
        <span
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            background: 'var(--cu-bg-strong)',
            borderRadius: 10,
            padding: '1px 7px',
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}` }}>{children}</div>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 48,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: TEXT_PRIMARY, margin: 0 }}>
        It all begins with tasks.
      </h1>
      <p style={{ fontSize: 15, color: TEXT_MUTED, margin: '4px 0 18px' }}>
        Begin getting organized and productive with tasks.
      </p>
      <button
        onClick={onCreate}
        data-testid="my-tasks-empty-create"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 44,
          paddingLeft: 18,
          paddingRight: 22,
          background: 'var(--cu-text-primary)',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          color: 'var(--cu-bg-app)',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        <PlusIcon size={18} />
        Create your first task
      </button>
    </div>
  );
}

function split(tasks: Task[]): { todo: Task[]; done: Task[] } {
  const todo: Task[] = [];
  const done: Task[] = [];
  for (const t of tasks) {
    if (t.statusType === 'closed' || t.statusType === 'done') done.push(t);
    else todo.push(t);
  }
  const byUpdated = (a: Task, b: Task) => (b.dateUpdated ?? 0) - (a.dateUpdated ?? 0);
  return { todo: todo.sort(byUpdated), done: done.sort(byUpdated) };
}
