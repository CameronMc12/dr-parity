'use client';

/**
 * Parity-only submenu bodies for the task right-click menu.
 *
 * The real ClickUp menu shows these flyouts (Favorite ▸, Remind me in Inbox ▸,
 * Move to ▸, Add to ▸, Merge ▸, Convert to ▸, Templates ▸, Relationships ▸,
 * Task Type ▸). None map cleanly onto our local workspace model, so they render
 * the captured option set as graceful no-op rows that simply close the menu.
 * Keeping them present makes the menu structure byte-match the real capture.
 */

import { MenuDivider, MenuItem } from '@/components/ui/Menu';
import type { Task, WorkspaceTree } from '@/store/workspace/types';
import { useWorkspaceStore } from '@/store/workspace';

const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '8px 14px',
        fontSize: 12,
        color: TEXT_MUTED,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}

/** Favorite ▸ — real menu offers a single "Favorite" toggle row. */
export function FavoriteSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <MenuItem
      label={<span style={{ color: TEXT_SECONDARY }}>Add to Favorites</span>}
      onSelect={() => onAct(() => undefined)}
    />
  );
}

/** Remind me in Inbox ▸ — quick-relative reminder presets (visual only). */
export function RemindSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  const presets = ['In 20 minutes', 'In 1 hour', 'In 3 hours', 'Tomorrow', 'Next week'];
  return (
    <>
      {presets.map((p) => (
        <MenuItem key={p} label={p} onSelect={() => onAct(() => undefined)} />
      ))}
      <MenuDivider />
      <MenuItem
        label={<span style={{ color: TEXT_SECONDARY }}>Custom…</span>}
        onSelect={() => onAct(() => undefined)}
      />
    </>
  );
}

/** Move to ▸ — real ClickUp shows a list/space picker. We list the live lists. */
export function MoveToSubmenu({ task, onAct }: { task: Task; onAct: (fn: () => void) => void }) {
  const tree = useWorkspaceStore((s) => s.tree);
  const moveTask = useWorkspaceStore((s) => s.moveTask);

  const lists = collectLists(tree);
  const others = lists.filter((l) => l.id !== task.listId);

  if (others.length === 0) return <PlaceholderRow label="No other lists" />;

  return (
    <>
      {others.map((l) => (
        <MenuItem
          key={l.id}
          label={l.name}
          onSelect={() => onAct(() => moveTask(task.id, l.id))}
        />
      ))}
    </>
  );
}

/** Add to ▸ — secondary-location picker; parity stub. */
export function AddToSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <>
      <MenuItem label="Another List" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Sprint" onSelect={() => onAct(() => undefined)} />
    </>
  );
}

/** Merge ▸ — task-merge target picker; no local model. */
export function MergeSubmenu() {
  return <PlaceholderRow label="Search tasks to merge…" />;
}

/** Convert to ▸ — task → subtask / list-item conversions; parity stub. */
export function ConvertSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <>
      <MenuItem label="Subtask of…" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="List item" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Doc" onSelect={() => onAct(() => undefined)} />
    </>
  );
}

/** Templates ▸ — save / browse task templates; parity stub. */
export function TemplatesSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <>
      <MenuItem label="Save as Template" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Update existing Template" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Browse Templates" onSelect={() => onAct(() => undefined)} />
    </>
  );
}

/** Relationships ▸ — dependencies / links; parity stub. */
export function RelationshipsSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <>
      <MenuItem label="Blocking" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Waiting on" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Linked to" onSelect={() => onAct(() => undefined)} />
    </>
  );
}

/** Task Type ▸ — task / milestone / form-response type switch; parity stub. */
export function TaskTypeSubmenu({ onAct }: { onAct: (fn: () => void) => void }) {
  return (
    <>
      <MenuItem label="Task" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Milestone" onSelect={() => onAct(() => undefined)} />
      <MenuItem label="Form Response" onSelect={() => onAct(() => undefined)} />
    </>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

interface ListLike {
  id: string;
  name: string;
}

/** Flatten the workspace tree to the list nodes the Move-to picker offers. */
function collectLists(tree: WorkspaceTree): ListLike[] {
  const out: ListLike[] = [];
  for (const space of tree.spaces) {
    for (const list of space.folderlessLists) {
      out.push({ id: list.id, name: list.name });
    }
    for (const folder of space.folders) {
      for (const list of folder.lists) {
        out.push({ id: list.id, name: list.name });
      }
    }
  }
  return out;
}
