'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useAllTasksFlat,
  useListTasksFlat,
  useMembers,
  useTaskById,
} from '@/store/workspace/hooks';
import { findList } from '@/store/workspace/selectors';
import type { ActivityEntry, Task, TaskComment } from '@/store/workspace/types';
import { ActivityRail, type ActivityItem } from './ActivityRail';
import { CopyLinkButton, MoreMenu } from './HeaderMenu';
import { MetaRow } from './MetaRow';
import { SubtasksBlock } from './SubtasksBlock';
import {
  AssigneeField,
  DateField,
  PriorityField,
  StatusCompleteToggle,
  StatusField,
} from './MetaEditors';
import {
  RelationshipsField,
  TagsField,
  TimeEstimateField,
  TrackTimeField,
} from './MetaEditorsExtra';
import {
  ArrowRightIcon,
  AssigneeIcon,
  CalendarIcon,
  CloseIcon,
  DocLineIcon,
  ExpandIcon,
  FlagIcon,
  PlusSmallIcon,
  RelationshipsIcon,
  SparkleIcon,
  StarIcon,
  StatusDashIcon,
  TagIcon,
  TimeEstimateIcon,
  TrackTimeIcon,
} from './icons';

const HIDE_EMPTY_KEY = 'parity-task-hide-empty';

const TEXT_PRIMARY = 'var(--cu-text-primary, #eee)';
const TEXT_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const BORDER = 'var(--cu-border-divider, #333)';

export function TaskPanel({
  taskId,
  wsId,
  onClose,
}: {
  taskId: string;
  wsId: string;
  /** When provided (modal context), overrides the default route-based close. */
  onClose?: () => void;
}) {
  const task = useTaskById(taskId);
  const members = useMembers();
  const listTasks = useListTasksFlat(task?.listId ?? '');
  const allTasks = useAllTasksFlat();
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const addStoreComment = useWorkspaceStore((s) => s.addComment);
  const currentMemberId = useWorkspaceStore((s) => s.currentMemberId);
  const router = useRouter();

  const [hideEmpty, setHideEmpty] = useState(false);
  useEffect(() => {
    setHideEmpty(window.localStorage.getItem(HIDE_EMPTY_KEY) === '1');
  }, []);
  const toggleHideEmpty = () => {
    setHideEmpty((v) => {
      const next = !v;
      window.localStorage.setItem(HIDE_EMPTY_KEY, next ? '1' : '0');
      return next;
    });
  };

  const activityItems = useMemo(
    () => mergeActivity(task?.comments ?? [], task?.activity ?? []),
    [task?.comments, task?.activity],
  );

  function goBack() {
    if (onClose) {
      onClose();
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push(`/${wsId}/home`);
  }

  if (!task) {
    return <TaskNotFound onBack={goBack} />;
  }

  const current: Task = task;

  const patch = (p: Partial<Task>) => updateTask(current.id, p);

  function addComment(text: string) {
    addStoreComment(current.id, text);
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 420px',
        height: '100%',
        background: 'var(--cu-bg-app, #111)',
        color: TEXT_PRIMARY,
        fontFamily: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* LEFT — task detail */}
      <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <PanelTopbar task={task} onClose={goBack} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 880, padding: '20px 32px 64px' }}>
            <HeaderPills task={task} />
            <TitleEditor task={task} onChange={patch} />
            <AskBrainBar />
            <MetaGrid
              task={task}
              members={members}
              listTasks={listTasks}
              allTasks={allTasks}
              onChange={patch}
              hideEmpty={hideEmpty}
              onToggleHideEmpty={toggleHideEmpty}
            />
            <DescriptionBlock task={task} onChange={patch} />
            <AddFieldsBlock />
            <SubtasksBlock task={task} />
          </div>
        </div>
      </section>

      {/* RIGHT — activity */}
      <ActivityRail items={activityItems} members={members} onSubmit={addComment} />
    </div>
  );
}

/** Interleave comments + auto-logged activity into one newest-first feed. */
function mergeActivity(comments: TaskComment[], activity: ActivityEntry[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...comments.map((c) => ({
      id: c.id,
      kind: 'comment' as const,
      authorId: c.authorId,
      text: c.text,
      createdAt: c.createdAt,
    })),
    ...activity.map((a) => ({
      id: a.id,
      kind: 'event' as const,
      authorId: a.authorId,
      text: a.text,
      createdAt: a.createdAt,
    })),
  ];
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

// ── Topbar: breadcrumb + close ───────────────────────────────────────────────

function PanelTopbar({ task, onClose }: { task: Task; onClose: () => void }) {
  const crumb = useWorkspaceStore(
    useShallow((s) => {
      const resolved = findList(s, task.listId);
      return resolved
        ? [resolved.space.name, resolved.folder?.name, resolved.list?.name].filter(
            (x): x is string => Boolean(x),
          )
        : ['Workspace'];
    }),
  );

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 12px 0 16px',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      <nav style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 13, color: TEXT_MUTED }}>
        {crumb.map((c, i) => (
          <span key={`${c}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c}</span>
          </span>
        ))}
      </nav>
      <TopbarButton label="Favorite"><StarIcon /></TopbarButton>
      <CopyLinkButton task={task} />
      <MoreMenu task={task} onClose={onClose} />
      <TopbarButton label="Expand"><ExpandIcon /></TopbarButton>
      <TopbarButton label="Close task" onClick={onClose}><CloseIcon /></TopbarButton>
    </header>
  );
}

function TopbarButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        background: 'transparent',
        color: TEXT_MUTED,
      }}
    >
      {children}
    </button>
  );
}

// ── Header pills (task type, id, Ask AI) ─────────────────────────────────────

function HeaderPills({ task }: { task: Task }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Pill>
        <span style={{ display: 'flex', color: TEXT_MUTED }}><StatusDashIcon size={14} /></span>
        Task
        <span style={{ display: 'flex', color: TEXT_MUTED }}>▾</span>
      </Pill>
      <Pill>{task.id}</Pill>
      <Pill>
        <SparkleIcon size={14} /> Ask AI
      </Pill>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 26,
        padding: '0 10px',
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        fontSize: 12,
        color: 'var(--cu-text-secondary, #aaa)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ── Title ────────────────────────────────────────────────────────────────────

function TitleEditor({ task, onChange }: { task: Task; onChange: (p: Partial<Task>) => void }) {
  const [value, setValue] = useState(task.name);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(task.name), [task.name]);

  function autosize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
  useEffect(autosize, [value]);

  function commit() {
    const next = value.trim();
    if (next && next !== task.name) onChange({ name: next });
    else setValue(task.name);
  }

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      aria-label="Task name"
      style={{
        width: '100%',
        resize: 'none',
        overflow: 'hidden',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: TEXT_PRIMARY,
        fontFamily: 'inherit',
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.2,
        padding: 0,
        margin: '0 0 16px',
      }}
    />
  );
}

// ── Ask Brain bar ────────────────────────────────────────────────────────────

function AskBrainBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        padding: '0 14px',
        borderRadius: 8,
        background: 'var(--cu-bg-hover, #1c1c1c)',
        fontSize: 13,
        color: TEXT_MUTED,
        marginBottom: 18,
      }}
    >
      <SparkleIcon size={15} />
      <span style={{ color: 'var(--cu-text-secondary, #aaa)' }}>Ask Brain to</span>
      <BrainLink>write a description</BrainLink>,
      <BrainLink>generate subtasks</BrainLink>
      <span>or</span>
      <BrainLink>find similar tasks</BrainLink>
    </div>
  );
}

function BrainLink({ children }: { children: React.ReactNode }) {
  return <span style={{ color: TEXT_PRIMARY, fontWeight: 500, cursor: 'pointer' }}>{children}</span>;
}

// ── Two-column meta grid ─────────────────────────────────────────────────────

function MetaGrid({
  task,
  members,
  listTasks,
  allTasks,
  onChange,
  hideEmpty,
  onToggleHideEmpty,
}: {
  task: Task;
  members: ReturnType<typeof useMembers>;
  listTasks: Task[];
  allTasks: Task[];
  onChange: (p: Partial<Task>) => void;
  hideEmpty: boolean;
  onToggleHideEmpty: () => void;
}) {
  const hasDates = task.startDate != null || task.dueDate != null;
  const hasTags = (task.tags ?? []).length > 0;
  const hasAssignees = task.assignees.length > 0;
  const hasRel = (task.linkedTaskIds ?? []).length > 0;
  const hasTracked = (task.timeEntries ?? []).length > 0;
  const show = (filled: boolean) => !hideEmpty || filled;

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          columnGap: 40,
          rowGap: 2,
          marginBottom: 8,
        }}
      >
        {/* LEFT column */}
        <div>
          <MetaRow icon={<StatusDashIcon />} label="Status">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusField task={task} listTasks={listTasks} onChange={onChange} />
              <StatusCompleteToggle task={task} onChange={onChange} />
            </div>
          </MetaRow>
          {show(hasDates) && (
            <MetaRow icon={<CalendarIcon />} label="Dates">
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <DateField
                  field="startDate"
                  label="Start"
                  value={task.startDate}
                  icon={<CalendarIcon size={14} />}
                  onChange={onChange}
                />
                <span style={{ color: TEXT_MUTED, display: 'flex' }}><ArrowRightIcon size={14} /></span>
                <DateField
                  field="dueDate"
                  label="Due"
                  value={task.dueDate}
                  icon={<CalendarIcon size={14} />}
                  onChange={onChange}
                />
              </div>
            </MetaRow>
          )}
          {show(Boolean(task.timeEstimate)) && (
            <MetaRow icon={<TimeEstimateIcon />} label="Time Estimate">
              <TimeEstimateField task={task} />
            </MetaRow>
          )}
          {show(hasTags) && (
            <MetaRow icon={<TagIcon />} label="Tags">
              <TagsField task={task} />
            </MetaRow>
          )}
        </div>

        {/* RIGHT column */}
        <div>
          {show(hasAssignees) && (
            <MetaRow icon={<AssigneeIcon />} label="Assignees">
              <AssigneeField task={task} members={members} onChange={onChange} />
            </MetaRow>
          )}
          {show(Boolean(task.priority)) && (
            <MetaRow icon={<FlagIcon />} label="Priority">
              <PriorityField task={task} onChange={onChange} />
            </MetaRow>
          )}
          {show(hasTracked) && (
            <MetaRow icon={<TrackTimeIcon />} label="Track Time">
              <TrackTimeField task={task} />
            </MetaRow>
          )}
          {show(hasRel) && (
            <MetaRow icon={<RelationshipsIcon />} label="Relationships">
              <RelationshipsField task={task} allTasks={allTasks} />
            </MetaRow>
          )}
        </div>
      </div>

      <button
        type="button"
        data-testid="panel-hide-empty"
        onClick={onToggleHideEmpty}
        aria-pressed={hideEmpty}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 4,
          marginBottom: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: TEXT_MUTED,
          fontFamily: 'inherit',
          fontSize: 13,
        }}
      >
        <span style={{ display: 'flex' }}>{hideEmpty ? '▾' : '▴'}</span>
        {hideEmpty ? 'Show empty properties' : 'Hide empty properties'}
      </button>

      <Divider />
    </>
  );
}

// ── Description ──────────────────────────────────────────────────────────────

function DescriptionBlock({ task, onChange }: { task: Task; onChange: (p: Partial<Task>) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.description ?? '');

  useEffect(() => setValue(task.description ?? ''), [task.description]);

  function commit() {
    setEditing(false);
    const next = value.trim();
    if (next !== (task.description ?? '')) onChange({ description: next });
  }

  if (editing) {
    return (
      <div style={{ padding: '16px 0' }}>
        <textarea
          autoFocus
          value={value}
          rows={3}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="Add a description…"
          aria-label="Task description"
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 72,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            outline: 'none',
            background: 'var(--cu-bg-input, #222)',
            color: TEXT_PRIMARY,
            fontFamily: 'inherit',
            fontSize: 14,
            padding: 12,
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  const hasBody = Boolean(task.description?.trim());

  return (
    <div style={{ padding: '16px 0' }}>
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          display: 'flex',
          alignItems: hasBody ? 'flex-start' : 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'text',
          color: hasBody ? TEXT_PRIMARY : TEXT_MUTED,
          fontFamily: 'inherit',
          fontSize: 14,
          padding: 0,
        }}
      >
        <span style={{ display: 'flex', color: TEXT_MUTED, marginTop: hasBody ? 2 : 0 }}>
          <DocLineIcon size={16} />
        </span>
        {hasBody ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{task.description}</span>
        ) : (
          'Add description'
        )}
      </button>
      {!hasBody && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: TEXT_MUTED, fontSize: 14 }}>
          <SparkleIcon size={16} /> Write with AI
        </div>
      )}
      <Divider top={16} />
    </div>
  );
}

// ── Add fields / Add subtask ─────────────────────────────────────────────────

function AddFieldsBlock() {
  return (
    <div style={{ padding: '12px 0' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>
        Add fields
      </h3>
      <OutlineButton>
        <PlusSmallIcon size={14} /> Create a field in this List
      </OutlineButton>
    </div>
  );
}

function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        borderRadius: 6,
        border: `1px dashed ${BORDER}`,
        cursor: 'pointer',
        background: 'transparent',
        color: TEXT_MUTED,
        fontFamily: 'inherit',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

function Divider({ top = 0 }: { top?: number }) {
  return <hr style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: `${top}px 0 0` }} />;
}

// ── Not found ────────────────────────────────────────────────────────────────

function TaskNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        height: '100%',
        background: 'var(--cu-bg-app, #111)',
        color: TEXT_PRIMARY,
        fontFamily: 'var(--cu-font, -apple-system, sans-serif)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Task not found</h2>
      <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED }}>
        This task may have been deleted or the link is no longer valid.
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: 8,
          height: 34,
          padding: '0 16px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: 'var(--cu-accent, #7b68ee)',
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Back
      </button>
    </div>
  );
}
