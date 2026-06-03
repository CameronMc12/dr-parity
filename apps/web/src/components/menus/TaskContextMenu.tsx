'use client';

/**
 * Shared right-click context menu for a task across every view (board cards,
 * list rows, calendar chips, gantt bars, table rows, …).
 *
 * Structure mirrors the real ClickUp task menu 1:1 (captured at
 * docs/research/clickup-parity/interactions/list/rightclick-task.png), mapped
 * onto our dark theme:
 *
 *   ┌ icon row ─────────────────┐
 *   │ Copy link · Copy ID · New │
 *   ├───────────────────────────┤
 *   │ Add a column              │
 *   │ Favorite              ▸   │
 *   │ Rename                    │
 *   │ Follow task               │
 *   │ Remind me in Inbox    ▸   │
 *   ├───────────────────────────┤
 *   │ Move to               ▸   │
 *   │ Add to                ▸   │
 *   │ Merge                 ▸   │
 *   │ Duplicate                 │
 *   │ Convert to            ▸   │
 *   │ Templates             ▸   │
 *   ├───────────────────────────┤
 *   │ Relationships         ▸   │
 *   │ Task Type             ▸   │
 *   ├───────────────────────────┤
 *   │ Start timer               │
 *   │ Send email to task        │
 *   ├───────────────────────────┤
 *   │ Archive                   │
 *   │ Delete                    │
 *   ├───────────────────────────┤
 *   │ ▮ Sharing & Permissions ▮ │
 *   └───────────────────────────┘
 *
 * Our extra Status / Priority / Assignees / Due-date submenus are folded into
 * the same flyout group so a right-click is still a full task editor.
 *
 * The shared `Menu` primitive only anchors to a trigger rect, so this renders a
 * `position: fixed` surface at the cursor `(x, y)` — mirroring `TabContextMenu`
 * — while reusing `MenuItem` / `MenuDivider` for byte-identical row styling.
 *
 * Wired to the real workspace store where a model exists (Copy link / Copy ID /
 * New tab / Rename / Duplicate / Archive / Delete / Move to + our pick lists).
 * Parity-only rows (Add a column, Favorite, Follow, Remind, Merge, Convert,
 * Templates, Relationships, Task Type, Start timer, Send email, Sharing) render
 * with their real icons + submenus and gracefully no-op.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MenuDivider, MenuItem } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import { useUiStore } from '@/store/ui-store';
import type { Assignee, Task } from '@/store/workspace/types';
import {
  PRIORITY_OPTIONS,
  groupStatusOptions,
  listStatusOptions,
  type StatusOption,
} from '@/components/pages/listview/statuses';
import { quickDates } from '@/components/pages/listview/calendar';
import {
  AddColumnIcon,
  AddToIcon,
  ArchiveIcon,
  AssigneeIcon,
  CompleteIcon,
  ConvertIcon,
  CopyIdIcon,
  CopyLinkIcon,
  DeleteIcon,
  DueDateIcon,
  DuplicateIcon,
  FavoriteIcon,
  FollowIcon,
  MergeIcon,
  MoveIcon,
  NewTabIcon,
  PriorityIcon,
  RelationshipsIcon,
  RemindIcon,
  RenameIcon,
  SendEmailIcon,
  SharingIcon,
  StatusIcon,
  TaskTypeIcon,
  TemplatesIcon,
  TimerIcon,
} from './task-menu-icons';
import {
  AddToSubmenu,
  ConvertSubmenu,
  FavoriteSubmenu,
  MergeSubmenu,
  MoveToSubmenu,
  RelationshipsSubmenu,
  RemindSubmenu,
  TaskTypeSubmenu,
  TemplatesSubmenu,
} from './task-menu-stubs';

// ── Surface tokens (match Menu.tsx / TabContextMenu.tsx) ─────────────────────

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const DANGER = 'rgb(226, 67, 41)';

const MENU_WIDTH = 240;
/** Conservative full-height estimate used only for the below/above flip. */
const EST_HEIGHT = 560;

export interface TaskContextMenuPos {
  x: number;
  y: number;
}

// ── Decorative bits ──────────────────────────────────────────────────────────

function CheckMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4 10-10"
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusDot({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        background: dashed ? 'transparent' : color,
        border: dashed ? `1.5px dashed ${color}` : 'none',
      }}
    />
  );
}

function FlagDot({ color }: { color: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3v18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 4h11l-2.5 3.5L17 11H6" fill={color} stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function AvatarBubble({ assignee, size = 20 }: { assignee: Assignee; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: assignee.color || '#7b68ee',
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {assignee.initials}
    </span>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 14px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: TEXT_MUTED,
      }}
    >
      {children}
    </div>
  );
}

// ── Top icon-button row (Copy link · Copy ID · New tab) ──────────────────────

function IconButton({ label, children, onSelect }: { label: string; children: ReactNode; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => {
        if (ref.current) ref.current.style.background = HOVER_BG;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.background = 'transparent';
      }}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 30,
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', color: TEXT_MUTED }}>{children}</span>
      {label}
    </button>
  );
}

function IconButtonRow({
  onCopyLink,
  onCopyId,
  onNewTab,
}: {
  onCopyLink: () => void;
  onCopyId: () => void;
  onNewTab: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 8px 6px' }}>
      <IconButton label="Copy link" onSelect={onCopyLink}>
        <CopyLinkIcon />
      </IconButton>
      <span style={{ width: 1, height: 18, background: MENU_BORDER, flexShrink: 0 }} />
      <IconButton label="Copy ID" onSelect={onCopyId}>
        <CopyIdIcon />
      </IconButton>
      <span style={{ width: 1, height: 18, background: MENU_BORDER, flexShrink: 0 }} />
      <IconButton label="New tab" onSelect={onNewTab}>
        <NewTabIcon />
      </IconButton>
    </div>
  );
}

// ── Footer button (Sharing & Permissions) ────────────────────────────────────

function FooterButton({ onSelect }: { onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ padding: '4px 8px 2px' }}>
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onMouseEnter={() => {
          if (ref.current) ref.current.style.background = 'var(--cu-bg-elevated, rgb(40,40,44))';
        }}
        onMouseLeave={() => {
          if (ref.current) ref.current.style.background = 'var(--cu-bg-input, rgb(32,32,36))';
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 34,
          background: 'var(--cu-bg-input, rgb(32,32,36))',
          border: `1px solid ${MENU_BORDER}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'background 120ms ease',
        }}
      >
        <span style={{ display: 'flex', color: TEXT_MUTED }}>
          <SharingIcon />
        </span>
        Sharing &amp; Permissions
      </button>
    </div>
  );
}

// ── Our extra pick-list submenus (status / priority / assignee / due) ────────

function StatusSubmenu({ task, listTasks, onAct }: { task: Task; listTasks: Task[]; onAct: (fn: () => void) => void }) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const groups = useMemo(() => groupStatusOptions(listStatusOptions(listTasks)), [listTasks]);

  const apply = (o: StatusOption) =>
    onAct(() =>
      updateTask(task.id, { status: o.status, statusColor: o.statusColor, statusType: o.statusType }),
    );

  return (
    <>
      {groups.map((g) => (
        <div key={g.heading}>
          <SubHeading>{g.heading}</SubHeading>
          {g.options.map((o) => (
            <MenuItem
              key={o.status}
              icon={<StatusDot color={o.statusColor} dashed={g.heading === 'Not started'} />}
              label={
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: TEXT_SECONDARY }}>
                  {o.status}
                </span>
              }
              trailing={o.status === task.status ? <CheckMark /> : undefined}
              active={o.status === task.status}
              onSelect={() => apply(o)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function PrioritySubmenu({ task, onAct }: { task: Task; onAct: (fn: () => void) => void }) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  return (
    <>
      {PRIORITY_OPTIONS.map((p) => (
        <MenuItem
          key={p.key}
          icon={<FlagDot color={p.color} />}
          label={p.label}
          trailing={task.priority === p.key ? <CheckMark /> : undefined}
          active={task.priority === p.key}
          onSelect={() => onAct(() => updateTask(task.id, { priority: p.key, priorityColor: p.color }))}
        />
      ))}
      <MenuDivider />
      <MenuItem
        label={<span style={{ color: TEXT_SECONDARY }}>Clear</span>}
        onSelect={() => onAct(() => updateTask(task.id, { priority: null, priorityColor: null }))}
      />
    </>
  );
}

function AssigneeSubmenu({ task, onAct }: { task: Task; onAct: (fn: () => void) => void }) {
  const members = useWorkspaceStore((s) => s.members);
  const currentMemberId = useWorkspaceStore((s) => s.currentMemberId);
  const updateTask = useWorkspaceStore((s) => s.updateTask);

  const toggle = (m: Assignee) => {
    const has = task.assignees.some((a) => a.id === m.id);
    const next: Assignee[] = has
      ? task.assignees.filter((a) => a.id !== m.id)
      : [...task.assignees, { id: m.id, name: m.name, initials: m.initials, color: m.color }];
    updateTask(task.id, { assignees: next });
  };

  return (
    <>
      {members.map((m) => {
        const assigned = task.assignees.some((a) => a.id === m.id);
        return (
          <MenuItem
            key={m.id}
            icon={<AvatarBubble assignee={m} />}
            label={m.id === currentMemberId ? `${m.name} (Me)` : m.name}
            trailing={assigned ? <CheckMark /> : undefined}
            active={assigned}
            onSelect={() => onAct(() => toggle(m))}
          />
        );
      })}
    </>
  );
}

function DueDateSubmenu({ task, onAct }: { task: Task; onAct: (fn: () => void) => void }) {
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const quick = useMemo(() => quickDates(), []);
  return (
    <>
      {quick.map((q) => (
        <MenuItem
          key={q.label}
          label={q.label}
          postscript={q.hint}
          onSelect={() => onAct(() => updateTask(task.id, { dueDate: q.value }))}
        />
      ))}
      <MenuDivider />
      <MenuItem
        label={<span style={{ color: TEXT_SECONDARY }}>Clear due date</span>}
        onSelect={() => onAct(() => updateTask(task.id, { dueDate: null }))}
      />
    </>
  );
}

// ── Menu ─────────────────────────────────────────────────────────────────────

const TASK_URL_BASE = '/90152566819/t/';

export function TaskContextMenu({
  task,
  listTasks,
  pos,
  onClose,
  onRename,
}: {
  task: Task;
  /** Sibling tasks of the same list — drives the live status set in the submenu. */
  listTasks: Task[];
  pos: TaskContextMenuPos;
  onClose: () => void;
  /** Hand control to the view's inline-rename flow. Optional (falls back to open). */
  onRename?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const updateTask = useWorkspaceStore((s) => s.updateTask);
  const deleteTask = useWorkspaceStore((s) => s.deleteTask);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const openTask = useUiStore((s) => s.openTask);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  /** Run a store action then close the whole menu (submenu rows self-close). */
  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const taskUrl = () =>
    typeof window !== 'undefined' ? `${location.origin}${TASK_URL_BASE}${task.id}` : `${TASK_URL_BASE}${task.id}`;

  const copyLink = () =>
    act(() => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(taskUrl());
      }
    });

  const copyId = () =>
    act(() => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(task.id);
      }
    });

  const openNewTab = () =>
    act(() => {
      if (typeof window !== 'undefined') {
        window.open(taskUrl(), '_blank', 'noopener');
      }
    });

  const rename = () => act(() => (onRename ? onRename() : openTask(task.id)));

  const duplicate = () =>
    act(() =>
      createTask({
        name: `${task.name} (copy)`,
        listId: task.listId,
        status: task.status,
        statusColor: task.statusColor,
        statusType: task.statusType,
        priority: task.priority,
        priorityColor: task.priorityColor,
        dueDate: task.dueDate,
        startDate: task.startDate,
        assignees: task.assignees,
      }),
    );

  const archive = () => act(() => updateTask(task.id, { archived: true }));
  const remove = () => act(() => deleteTask(task.id));
  const noop = () => act(() => undefined);

  // Cursor-anchored placement with viewport flips (mirrors TabContextMenu).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const flipUp = vh - pos.y < EST_HEIGHT;
  const left = Math.min(pos.x, vw - MENU_WIDTH - 8);

  return (
    <div
      ref={ref}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        zIndex: 9999,
        width: MENU_WIDTH,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        left,
        ...(flipUp ? { bottom: vh - pos.y + 4 } : { top: pos.y + 4 }),
        background: MENU_BG,
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 8,
        boxShadow: MENU_SHADOW,
        padding: '6px 0',
        boxSizing: 'border-box',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
        animation: 'cuMenuIn 110ms ease',
      }}
    >
      <IconButtonRow onCopyLink={copyLink} onCopyId={copyId} onNewTab={openNewTab} />

      <MenuItem icon={<AddColumnIcon />} label="Add a column" onSelect={noop} />
      <MenuItem icon={<FavoriteIcon />} label="Favorite" submenu={<FavoriteSubmenu onAct={act} />} />
      <MenuItem icon={<RenameIcon />} label="Rename" onSelect={rename} />
      <MenuItem icon={<FollowIcon />} label="Follow task" onSelect={noop} />
      <MenuItem icon={<RemindIcon />} label="Remind me in Inbox" submenu={<RemindSubmenu onAct={act} />} />

      <MenuDivider />

      <MenuItem icon={<MoveIcon />} label="Move to" submenu={<MoveToSubmenu task={task} onAct={act} />} />
      <MenuItem icon={<AddToIcon />} label="Add to" submenu={<AddToSubmenu onAct={act} />} />
      <MenuItem icon={<MergeIcon />} label="Merge" submenu={<MergeSubmenu />} />
      <MenuItem icon={<DuplicateIcon />} label="Duplicate" onSelect={duplicate} />
      <MenuItem icon={<ConvertIcon />} label="Convert to" submenu={<ConvertSubmenu onAct={act} />} />
      <MenuItem icon={<TemplatesIcon />} label="Templates" submenu={<TemplatesSubmenu onAct={act} />} />

      <MenuDivider />

      {/* Our model-backed editors, folded in alongside ClickUp's parity rows. */}
      <MenuItem icon={<StatusIcon />} label="Set status" submenu={<StatusSubmenu task={task} listTasks={listTasks} onAct={act} />} />
      <MenuItem icon={<PriorityIcon />} label="Set priority" submenu={<PrioritySubmenu task={task} onAct={act} />} />
      <MenuItem icon={<AssigneeIcon />} label="Assignees" submenu={<AssigneeSubmenu task={task} onAct={act} />} />
      <MenuItem icon={<DueDateIcon />} label="Due date" submenu={<DueDateSubmenu task={task} onAct={act} />} />
      <MenuItem icon={<CompleteIcon />} label="Set status complete" onSelect={() => act(() => updateTask(task.id, { statusType: 'closed' }))} />

      <MenuDivider />

      <MenuItem icon={<RelationshipsIcon />} label="Relationships" submenu={<RelationshipsSubmenu onAct={act} />} />
      <MenuItem icon={<TaskTypeIcon />} label="Task Type" submenu={<TaskTypeSubmenu onAct={act} />} />

      <MenuDivider />

      <MenuItem icon={<TimerIcon />} label="Start timer" onSelect={noop} />
      <MenuItem icon={<SendEmailIcon />} label="Send email to task" onSelect={noop} />

      <MenuDivider />

      <MenuItem icon={<ArchiveIcon />} label="Archive" onSelect={archive} />
      <MenuItem
        icon={<span style={{ color: DANGER }}><DeleteIcon /></span>}
        label={<span style={{ color: DANGER }}>Delete</span>}
        onSelect={remove}
      />

      <MenuDivider />

      <FooterButton onSelect={noop} />
    </div>
  );
}
