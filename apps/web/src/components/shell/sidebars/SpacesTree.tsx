'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useIsExpanded,
  useSpaces,
  useTasksByList,
} from '@/store/workspace/hooks';
import type {
  FolderNode,
  ListNode,
  SpaceNode,
} from '@/store/workspace/types';
import { Menu } from '@/components/ui/Menu';
import { RowContextMenu, type RowKind } from '@/components/menus/RowContextMenu';

const LIGHT_TEXT = 'var(--cu-text-primary)';
const MUTED_TEXT = 'var(--cu-text-muted)';
const HOVER_BG = 'var(--cu-bg-hover)';
const ACTIVE_BG = 'var(--cu-bg-active)';
const COUNT_TEXT = 'var(--cu-text-muted)';
const SPACE_GREEN = 'rgb(22, 199, 132)';

// ── Tree filtering ────────────────────────────────────────────────────────
// A row is shown when it matches the (case-insensitive) filter OR one of its
// descendants matches, so ancestors of matches stay visible.

const matches = (name: string, filter: string) =>
  name.toLowerCase().includes(filter.toLowerCase());

function folderMatches(folder: FolderNode, filter: string): boolean {
  return matches(folder.name, filter) || folder.lists.some((l) => matches(l.name, filter));
}

function spaceMatches(space: SpaceNode, filter: string): boolean {
  if (matches(space.name, filter)) return true;
  if (space.folderlessLists.some((l) => matches(l.name, filter))) return true;
  return space.folders.some((f) => folderMatches(f, filter));
}

// Cu3Icon uses the sprite symbols (defined in CuIconSprite)
export function Cu3Icon({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      data-testid="icon"
      className="svg"
      style={{ width: size, height: size, display: 'block', fill: 'currentColor' }}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

export interface SidebarItemProps {
  icon?: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  secondaryLabel?: string;
  indent?: boolean;
  colorDot?: string;
  rightContent?: ReactNode;
  onClick?: () => void;
}

export function SidebarItem({ icon, label, active, badge, secondaryLabel, indent, colorDot, rightContent, onClick }: SidebarItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: indent ? 24 : 12,
        paddingRight: 8,
        paddingTop: 5,
        paddingBottom: 5,
        minHeight: 30,
        boxSizing: 'border-box',
        background: active ? ACTIVE_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? LIGHT_TEXT : MUTED_TEXT,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        transition: 'background 100ms ease, color 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.background = HOVER_BG;
          (e.currentTarget as HTMLDivElement).style.color = LIGHT_TEXT;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          (e.currentTarget as HTMLDivElement).style.color = MUTED_TEXT;
        }
      }}
    >
      {colorDot && (
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: colorDot,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        />
      )}
      {icon && (
        <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--cu-text-muted)' }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {rightContent}
      {secondaryLabel && (
        <span style={{ fontSize: 11, color: 'var(--cu-text-disabled)', flexShrink: 0 }}>{secondaryLabel}</span>
      )}
      {badge != null && badge > 0 && (
        <span
          style={{
            minWidth: 16,
            height: 16,
            borderRadius: 9999,
            background: 'rgb(210,30,36)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/**
 * Wraps a sidebar row and reveals a kebab (⋯) trigger on hover. The kebab opens
 * the shared RowContextMenu for the given row `kind`. The row content (a
 * SidebarItem / TreeRow button) is passed as children; the kebab is overlaid
 * absolutely on the right so it never nests a button inside a button.
 */
export function RowWithKebab({
  kind,
  nodeId,
  onRename,
  onNewList,
  children,
}: {
  kind: RowKind;
  nodeId?: string;
  onRename?: () => void;
  onNewList?: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="cu-row-kebab-wrap"
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      <Menu
        width={224}
        align="left"
        trigger={({ ref, onClick, open }) => (
          <button
            ref={ref}
            data-row-kebab
            aria-label="Row options"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              onClick(e);
            }}
            style={{
              position: 'absolute',
              top: '50%',
              right: 8,
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              display: hover || open ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              background: open ? 'var(--cu-bg-strong)' : HOVER_BG,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: MUTED_TEXT,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-strong)';
            }}
            onMouseLeave={(e) => {
              if (!open) (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG;
            }}
          >
            <Cu3Icon id="cu3-icon-ellipsisRegular" size={14} />
          </button>
        )}
      >
        <RowContextMenu kind={kind} nodeId={nodeId} onRename={onRename} onNewList={onNewList} />
      </Menu>
    </div>
  );
}

/**
 * Inline rename field rendered in place of a row label. Commits on Enter / blur,
 * cancels on Escape. Auto-focuses and selects on mount.
 */
export function InlineRename({
  initial,
  depth = 0,
  onCommit,
  onCancel,
}: {
  initial: string;
  depth?: number;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const v = ref.current?.value.trim();
    if (v) onCommit(v);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      data-testid="inline-rename"
      defaultValue={initial}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={commit}
      style={{
        width: '100%',
        marginLeft: 12 + depth * 16,
        marginRight: 8,
        marginTop: 3,
        marginBottom: 3,
        height: 26,
        padding: '0 8px',
        fontSize: 13,
        color: LIGHT_TEXT,
        border: '1px solid var(--cu-border-strong)',
        borderRadius: 6,
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
  );
}

export function MiniListIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 6h10M7 12h10M7 18h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

export function MiniFolderIcon({ color = SPACE_GREEN }: { color?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.8 7.5h5.7l1.7 2h8.9v7.2a2.2 2.2 0 0 1-2.2 2.2H6a2.2 2.2 0 0 1-2.2-2.2V7.5Z" stroke={color} strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

export function TreeRow({
  label,
  icon,
  depth,
  active,
  rightContent,
  muted,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  depth: number;
  active?: boolean;
  rightContent?: ReactNode;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 30,
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 12 + depth * 16,
        paddingRight: 8,
        boxSizing: 'border-box',
        background: active ? ACTIVE_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: active ? LIGHT_TEXT : muted ? 'var(--cu-text-disabled)' : MUTED_TEXT,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        transition: 'background 100ms ease, color 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {rightContent}
    </div>
  );
}

/**
 * Leading icon slot that doubles as an expand/collapse toggle for rows that have
 * children (spaces, folders). By default it shows the row's normal icon; on row
 * hover (driven by the `.cu-row-kebab-wrap:hover` parent) it reveals a chevron
 * toggle button overlaid on top of the icon. This matches ClickUp, where the
 * left affordance toggles children and never collides with the right-side kebab.
 *
 * The toggle is a real <button> (the row itself is a role="button" div, so this
 * is not a nested native button) and stops propagation so it never triggers the
 * row label navigation.
 */
export function RowLeading({
  icon,
  expanded,
  onToggle,
}: {
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <span
      style={{
        position: 'relative',
        width: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        className="cu-row-leading-icon"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cu-text-muted)',
        }}
      >
        {icon}
      </span>
      <button
        type="button"
        className="cu-row-leading-toggle"
        aria-label={expanded ? 'Collapse' : 'Expand'}
        aria-expanded={expanded}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 4,
          padding: 0,
          cursor: 'pointer',
          color: 'var(--cu-text-primary)',
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          style={{
            transform: expanded ? 'none' : 'rotate(-90deg)',
            transition: 'transform 120ms ease',
          }}
        >
          <path
            fillRule="evenodd"
            d="M12 17a1 1 0 0 1-.707-.293l-6-6a1 1 0 0 1 1.414-1.414L12 14.586l5.293-5.293a1 1 0 1 1 1.414 1.414l-6 6A1 1 0 0 1 12 17Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </span>
  );
}

export function SpaceIcon({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: 'white',
      }}
    >
      <Cu3Icon id="cu3-icon-user" size={11} />
    </span>
  );
}

export function ListCount({ value }: { value: number }) {
  if (!value) return null;
  return <span style={{ color: COUNT_TEXT, fontSize: 12, flexShrink: 0, marginRight: 2 }}>{value}</span>;
}

/** Live task count for a list, read from the store. */
export function LiveListCount({ listId }: { listId: string }) {
  const tasks = useTasksByList(listId);
  return <ListCount value={tasks.length} />;
}

/** A single list row inside a space/folder. Navigates to its list view. */
export function ListRow({
  list,
  depth,
  activeListId,
  onOpen,
}: {
  list: ListNode;
  depth: number;
  activeListId: string | null;
  onOpen: (listId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameNode = useWorkspaceStore((s) => s.renameNode);

  if (renaming) {
    return (
      <InlineRename
        initial={list.name}
        depth={depth}
        onCommit={(name) => {
          renameNode(list.id, name);
          setRenaming(false);
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <RowWithKebab kind="list" nodeId={list.id} onRename={() => setRenaming(true)}>
      <TreeRow
        label={list.name}
        depth={depth}
        icon={<MiniListIcon />}
        active={activeListId === list.id}
        onClick={() => onOpen(list.id)}
        rightContent={<LiveListCount listId={list.id} />}
      />
    </RowWithKebab>
  );
}

/**
 * A folder row with its own expand/collapse (persisted) and nested lists. When
 * `onOpenFolder` is provided (Spaces sidebar), clicking the row label navigates
 * to the folder-scoped view while the chevron-free label still toggles via a
 * dedicated chevron when present. In Home usage (no callback) the label click
 * toggles expand, matching the original behavior.
 */
export function FolderRow({
  folder,
  spaceId,
  activeListId,
  onOpen,
  onOpenFolder,
  filter,
}: {
  folder: FolderNode;
  spaceId: string;
  activeListId: string | null;
  onOpen: (listId: string) => void;
  onOpenFolder?: (folderId: string) => void;
  filter?: string;
}) {
  const expanded = useIsExpanded(folder.id);
  const toggleExpanded = useWorkspaceStore((s) => s.toggleExpanded);
  const createList = useWorkspaceStore((s) => s.createList);
  const renameNode = useWorkspaceStore((s) => s.renameNode);
  const [renaming, setRenaming] = useState(false);

  const addList = () => {
    const name = window.prompt('List name')?.trim();
    if (name) createList({ spaceId, folderId: folder.id }, name);
    if (!expanded) toggleExpanded(folder.id);
  };

  return (
    <div>
      {renaming ? (
        <InlineRename
          initial={folder.name}
          depth={1}
          onCommit={(name) => {
            renameNode(folder.id, name);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <RowWithKebab
          kind="list"
          nodeId={folder.id}
          onRename={() => setRenaming(true)}
          onNewList={addList}
        >
          <TreeRow
            label={folder.name}
            depth={1}
            icon={
              <RowLeading
                icon={<MiniFolderIcon />}
                expanded={expanded}
                onToggle={() => toggleExpanded(folder.id)}
              />
            }
            onClick={() => (onOpenFolder ? onOpenFolder(folder.id) : toggleExpanded(folder.id))}
          />
        </RowWithKebab>
      )}
      {(expanded || !!filter) &&
        folder.lists
          .filter((list) => !filter || matches(folder.name, filter) || matches(list.name, filter))
          .map((list) => (
            <ListRow
              key={list.id}
              list={list}
              depth={2}
              activeListId={activeListId}
              onOpen={onOpen}
            />
          ))}
    </div>
  );
}

/**
 * A space row with persisted expand/collapse, folders and folderless lists. When
 * `onOpenSpace` is provided (Spaces sidebar), the row label navigates to the
 * space-scoped view and a chevron toggles expand. In Home usage the label click
 * toggles expand, matching the original behavior.
 */
export function SpaceRow({
  space,
  activeListId,
  onOpen,
  onOpenSpace,
  onOpenFolder,
  filter,
}: {
  space: SpaceNode;
  activeListId: string | null;
  onOpen: (listId: string) => void;
  onOpenSpace?: (spaceId: string) => void;
  onOpenFolder?: (folderId: string) => void;
  filter?: string;
}) {
  const expanded = useIsExpanded(space.id);
  const toggleExpanded = useWorkspaceStore((s) => s.toggleExpanded);
  const createList = useWorkspaceStore((s) => s.createList);
  const renameNode = useWorkspaceStore((s) => s.renameNode);
  const [renaming, setRenaming] = useState(false);

  const addList = () => {
    const name = window.prompt('List name')?.trim();
    if (name) createList({ spaceId: space.id }, name);
    if (!expanded) toggleExpanded(space.id);
  };

  return (
    <div>
      {renaming ? (
        <InlineRename
          initial={space.name}
          onCommit={(name) => {
            renameNode(space.id, name);
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <RowWithKebab
          kind="space"
          nodeId={space.id}
          onRename={() => setRenaming(true)}
          onNewList={addList}
        >
          <SidebarItem
            icon={
              <RowLeading
                icon={<SpaceIcon color={space.color} />}
                expanded={expanded}
                onToggle={() => toggleExpanded(space.id)}
              />
            }
            label={space.name}
            onClick={() => (onOpenSpace ? onOpenSpace(space.id) : toggleExpanded(space.id))}
          />
        </RowWithKebab>
      )}
      {(expanded || !!filter) && (
        <>
          {space.folders
            .filter((folder) => !filter || matches(space.name, filter) || folderMatches(folder, filter))
            .map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                spaceId={space.id}
                activeListId={activeListId}
                onOpen={onOpen}
                onOpenFolder={onOpenFolder}
                filter={filter}
              />
            ))}
          {space.folderlessLists
            .filter((list) => !filter || matches(space.name, filter) || matches(list.name, filter))
            .map((list) => (
              <ListRow
                key={list.id}
                list={list}
                depth={1}
                activeListId={activeListId}
                onOpen={onOpen}
              />
            ))}
        </>
      )}
    </div>
  );
}

/**
 * Store-backed Spaces tree. Spaces / folders / lists come from the workspace
 * store; expand state is persisted via toggleExpanded; lists navigate to their
 * list view; "+ New Space" creates a space. When `onOpenSpace` / `onOpenFolder`
 * are provided, space/folder rows navigate to scope-scoped views.
 */
export function SpacesTree({
  activeListId,
  onOpen,
  onOpenSpace,
  onOpenFolder,
  filter,
}: {
  activeListId: string | null;
  onOpen: (listId: string) => void;
  onOpenSpace?: (spaceId: string) => void;
  onOpenFolder?: (folderId: string) => void;
  filter?: string;
}) {
  const spaces = useSpaces();
  const createSpace = useWorkspaceStore((s) => s.createSpace);

  const addSpace = () => {
    const name = window.prompt('Space name')?.trim();
    if (name) createSpace(name);
  };

  const f = filter?.trim() ?? '';
  const visibleSpaces = f ? spaces.filter((s) => spaceMatches(s, f)) : spaces;

  return (
    <>
      <style>{`
        .cu-row-leading-toggle { display: none; }
        .cu-row-kebab-wrap:hover .cu-row-leading-toggle,
        .cu-row-leading-toggle:focus-visible { display: flex; }
        .cu-row-kebab-wrap:hover .cu-row-leading-icon { visibility: hidden; }
        .cu-row-leading-toggle:hover { background: var(--cu-bg-hover); }
      `}</style>
      {!f && (
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-sidebarEverything" size={16} />}
          label="All Tasks – Cameron Mc's Wor..."
        />
      )}
      {visibleSpaces.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          activeListId={activeListId}
          onOpen={onOpen}
          onOpenSpace={onOpenSpace}
          onOpenFolder={onOpenFolder}
          filter={f || undefined}
        />
      ))}
      {!f && (
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-addSmall" size={14} />}
          label="New Space"
          onClick={addSpace}
        />
      )}
    </>
  );
}
