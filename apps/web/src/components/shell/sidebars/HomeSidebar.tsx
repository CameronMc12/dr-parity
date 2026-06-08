'use client';

import { usePathname, useRouter } from 'next/navigation';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useViewsStore } from '@/store/views';
import {
  useChannels,
  useFavorites,
  useSpaces,
} from '@/store/workspace/hooks';
import type {
  Channel,
  SpaceNode,
} from '@/store/workspace/types';
import { Menu, MenuDivider, MenuItem } from '@/components/ui/Menu';
import { MoreAppsMenu } from '@/components/menus/MoreAppsMenu';
import { SidebarHeader } from './SidebarHeader';
import { HomeFilterChips } from './HomeFilterChips';
import {
  ChannelsMenu,
  DirectMessagesMenu,
  FavoritesMenu,
  SpacesMenu,
} from '@/components/menus/SectionMenus';
import {
  Cu3Icon,
  InlineRename,
  ListCount,
  MiniFolderIcon,
  MiniListIcon,
  RowWithKebab,
  SidebarItem,
  SpaceIcon,
  SpacesTree,
  TreeRow,
} from './SpacesTree';

const WORKSPACE_ID = '90152566819';

/**
 * Home sidebar — matches oracle structure:
 *   - "Home" header with +▾ action
 *   - Inbox / Replies / Assigned Comments / My Tasks / More
 *   - Horizontal divider
 *   - Favorites section
 *   - Channels section
 *   - Direct Messages section
 *   - Spaces section
 */

const LIGHT_TEXT = 'var(--cu-text-primary)';
const MUTED_TEXT = 'var(--cu-text-muted)';
const HOVER_BG   = 'var(--cu-bg-hover)';
const ACTIVE_BG  = 'var(--cu-bg-active)'; // oracle-sampled selected-row bg

/**
 * Disclosure chevron. Matches the oracle resting state: a right-pointing chevron
 * (▸) while the section is expanded, rotating to ▾ when collapsed so the toggle
 * still reads as interactive.
 */
function DisclosureArrow({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{
        flexShrink: 0,
        transform: expanded ? 'none' : 'rotate(90deg)',
        transition: 'transform 120ms ease',
      }}
    >
      <path
        fillRule="evenodd"
        d="M10 17a1 1 0 0 1-.707-1.707L13.586 12 9.293 7.707a1 1 0 1 1 1.414-1.414l5 5a1 1 0 0 1 0 1.414l-5 5A1 1 0 0 1 10 17Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Ref-forwarding sidebar row used as a Menu trigger (e.g. "More"). Mirrors
 * SidebarItem styling but exposes the underlying button so the popover can
 * anchor + toggle highlight while open.
 */
const SidebarItemButton = forwardRef<
  HTMLButtonElement,
  { icon: ReactNode; label: string; active?: boolean; onClick: (e: React.MouseEvent) => void }
>(function SidebarItemButton({ icon, label, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={active}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 8,
        paddingTop: 5,
        paddingBottom: 5,
        minHeight: 30,
        background: active ? ACTIVE_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? LIGHT_TEXT : MUTED_TEXT,
        fontSize: 13,
        textAlign: 'left',
        transition: 'background 100ms ease, color 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG;
          (e.currentTarget as HTMLButtonElement).style.color = LIGHT_TEXT;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = MUTED_TEXT;
        }
      }}
    >
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--cu-text-muted)' }}>
        {icon}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
});

function InlineAction({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: MUTED_TEXT,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Footer pinned to the bottom of the sidebar on the inbox / replies / assigned
 * routes. Matches the page-inbox oracle "Customize Sidebar" control.
 */
function CustomizeSidebarFooter() {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ flexShrink: 0, padding: '6px 8px 8px' }}>
      <button
        type="button"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 32,
          background: hover ? 'var(--cu-bg-strong)' : 'var(--cu-bg-hover)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--cu-text-secondary)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 8h12M6 16h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="9" cy="8" r="2.2" fill="var(--cu-bg-hover)" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="16" r="2.2" fill="var(--cu-bg-hover)" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        Customize Sidebar
      </button>
    </div>
  );
}

/**
 * Section-header action button (Favorites ⋯, Channels +, DMs +, Spaces +) that
 * opens its associated popover. `placement="above"` is forced for Spaces so the
 * menu flips up off the bottom-anchored header, matching the captured overlay.
 */
function SectionMenuButton({
  label,
  icon,
  children,
  width = 210,
  placement,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  width?: number;
  placement?: 'above' | 'below';
}) {
  return (
    <Menu
      width={width}
      align="left"
      placement={placement}
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            onClick(e);
          }}
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: open ? HOVER_BG : 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: MUTED_TEXT,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG;
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {icon}
        </button>
      )}
    >
      {children}
    </Menu>
  );
}

function PlusGlyph() {
  return <Cu3Icon id="cu3-icon-addSmall" size={12} />;
}

function KebabGlyph() {
  return <Cu3Icon id="cu3-icon-ellipsisRegular" size={14} />;
}

/**
 * Section header with a working collapse/expand toggle. The whole header is the
 * click target; the disclosure arrow rotates to point down when expanded.
 * `right` renders trailing content (badge / add button). `hideArrow` matches the
 * oracle "Spaces" header which shows no chevron, only the + button.
 */
function CollapsibleHeader({
  label,
  expanded,
  onToggle,
  right,
  hideArrow,
  labelColor = 'var(--cu-text-muted)',
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  right?: ReactNode;
  hideArrow?: boolean;
  labelColor?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 12,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        minHeight: 28,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: labelColor }}>{label}</span>
      {!hideArrow && (
        <span style={{ color: MUTED_TEXT, display: 'flex', alignItems: 'center' }}>
          <DisclosureArrow expanded={expanded} />
        </span>
      )}
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

function Divider({ small }: { small?: boolean }) {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--cu-border-divider)',
        margin: small ? '4px 12px' : '10px 12px',
      }}
    />
  );
}

// Channel icon with list-overlay (two layered SVGs matching oracle chatHashAvatarWithIcon + sidebarListOnHash)
function ChannelHubIcon() {
  return (
    <span style={{ position: 'relative', width: 16, height: 16, display: 'inline-flex', flexShrink: 0 }}>
      <Cu3Icon id="cu3-icon-chatHashAvatarWithIcon" size={16} />
      <span style={{ position: 'absolute', bottom: -1, right: -3 }}>
        <Cu3Icon id="cu3-icon-sidebarListOnHash" size={9} />
      </span>
    </span>
  );
}

function DocIcon() {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        background: 'rgb(26, 140, 255)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Cu3Icon id="cu3-icon-v4IaSidebarDocsFilled" size={11} />
    </span>
  );
}

/** A single channel row. Navigates to its chat view. */
function ChannelRow({
  channel,
  active,
  onOpen,
}: {
  channel: Channel;
  active: boolean;
  onOpen: (channelId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameChannel = useWorkspaceStore((s) => s.renameChannel);

  if (renaming) {
    return (
      <InlineRename
        initial={channel.name}
        onCommit={(name) => {
          renameChannel(channel.id, name);
          setRenaming(false);
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <RowWithKebab kind="channel" nodeId={channel.id} onRename={() => setRenaming(true)}>
      <SidebarItem
        icon={<ChannelHubIcon />}
        label={channel.name}
        active={active}
        onClick={() => onOpen(channel.id)}
      />
    </RowWithKebab>
  );
}

/**
 * Store-backed Channels list. Renders every channel from the store, navigates
 * on click, and exposes an inline "Add Channel" create row (createChannel).
 */
function ChannelsList({
  activeChannelId,
  onOpen,
  onCreate,
}: {
  activeChannelId: string | null;
  onOpen: (channelId: string) => void;
  onCreate: () => void;
}) {
  const channels = useChannels();
  return (
    <>
      {channels.map((channel) => (
        <ChannelRow
          key={channel.id}
          channel={channel}
          active={activeChannelId === channel.id}
          onOpen={onOpen}
        />
      ))}
      <SidebarItem
        icon={<Cu3Icon id="cu3-icon-addSmall" size={16} />}
        label="Add Channel"
        onClick={onCreate}
      />
    </>
  );
}

/** A single favorited node row. Resolves the node to a label + open target. */
function FavoriteRow({
  nodeId,
  spaces,
  channels,
  onOpenList,
  onOpenChannel,
}: {
  nodeId: string;
  spaces: SpaceNode[];
  channels: Channel[];
  onOpenList: (listId: string) => void;
  onOpenChannel: (channelId: string) => void;
}) {
  // Channel favorite?
  const channel = channels.find((c) => c.id === nodeId);
  if (channel) {
    return (
      <RowWithKebab kind="channel" nodeId={channel.id}>
        <SidebarItem
          icon={<ChannelHubIcon />}
          label={channel.name}
          onClick={() => onOpenChannel(channel.id)}
        />
      </RowWithKebab>
    );
  }

  // Tree node favorite (space / folder / list).
  for (const space of spaces) {
    if (space.id === nodeId) {
      return (
        <RowWithKebab kind="space" nodeId={space.id}>
          <SidebarItem icon={<SpaceIcon color={space.color} />} label={space.name} />
        </RowWithKebab>
      );
    }
    for (const folder of space.folders) {
      if (folder.id === nodeId) {
        return (
          <RowWithKebab kind="list" nodeId={folder.id}>
            <TreeRow label={folder.name} depth={0} icon={<MiniFolderIcon />} />
          </RowWithKebab>
        );
      }
      const list = folder.lists.find((l) => l.id === nodeId);
      if (list) {
        return (
          <RowWithKebab kind="list" nodeId={list.id}>
            <TreeRow
              label={list.name}
              depth={0}
              icon={<MiniListIcon />}
              onClick={() => onOpenList(list.id)}
            />
          </RowWithKebab>
        );
      }
    }
    const fl = space.folderlessLists.find((l) => l.id === nodeId);
    if (fl) {
      return (
        <RowWithKebab kind="list" nodeId={fl.id}>
          <TreeRow
            label={fl.name}
            depth={0}
            icon={<MiniListIcon />}
            onClick={() => onOpenList(fl.id)}
          />
        </RowWithKebab>
      );
    }
  }
  return null;
}

/** Store-backed Favorites list. Renders rows for every favorited node id. */
function FavoritesList({
  onOpenList,
  onOpenChannel,
}: {
  onOpenList: (listId: string) => void;
  onOpenChannel: (channelId: string) => void;
}) {
  const favorites = useFavorites();
  const spaces = useSpaces();
  const channels = useChannels();
  if (favorites.length === 0) return null;
  return (
    <>
      {favorites.map((nodeId) => (
        <FavoriteRow
          key={nodeId}
          nodeId={nodeId}
          spaces={spaces}
          channels={channels}
          onOpenList={onOpenList}
          onOpenChannel={onOpenChannel}
        />
      ))}
    </>
  );
}

export function HomeSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const createChannel = useWorkspaceStore((s) => s.createChannel);
  const createSpace = useWorkspaceStore((s) => s.createSpace);
  // Derive workspace id from the current path; fall back to the canonical id.
  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const isInbox = pathname.includes('/inbox') || pathname.includes('/notifications');
  const isReplies = pathname.includes('/chat/r/threads');
  const isAssignedComments = pathname.includes('/chat/r/assigned');
  const isMyTasks = pathname.endsWith('/my-work');
  const isDocRoute = pathname.includes('/v/dc/');
  const isHomeRoute =
    pathname.endsWith('/home') || pathname.endsWith('/my-work') || pathname === `/${wsId}`;

  // Active list id from `/v/l/<listId>` (raw listId in URL).
  const listMatch = pathname.match(/\/v\/l\/([^/]+)/);
  const activeListId = listMatch?.[1] ?? null;
  // Active channel id from `/chat/r/<channelId>` (excluding threads/assigned).
  const chanMatch = pathname.match(/\/chat\/r\/([^/]+)/);
  const rawChan = chanMatch?.[1];
  const activeChannelId =
    rawChan && rawChan !== 'threads' && rawChan !== 'assigned' ? rawChan : null;

  const go = (path: string) => () => router.push(`/${wsId}${path}`);
  // Navigate to the list's FIRST templated view (registry-driven). The default
  // first view is List, so the default URL stays /v/l/<listId>.
  const openList = (listId: string) => {
    const first = useViewsStore.getState().getListViews(listId)[0];
    const code = first?.code ?? 'l';
    const segId = first?.id ?? listId;
    router.push(`/${wsId}/v/${code}/${segId}`);
  };
  const openChannel = (channelId: string) => router.push(`/${wsId}/chat/r/${channelId}`);
  const addChannel = () => {
    const name = window.prompt('Channel name')?.trim();
    if (!name) return;
    const channel = createChannel(name);
    openChannel(channel.id);
  };
  const addSpace = () => {
    const name = window.prompt('Space name')?.trim();
    if (name) createSpace(name);
  };

  // On the inbox / replies / assigned routes the oracle sidebar differs from the
  // resting Home state: Channels is collapsed and a Customize Sidebar footer is
  // pinned at the bottom.
  const isCompactRoute = isInbox || isReplies || isAssignedComments;

  // Header hover-reveal + live tree filter + funnel chip-row toggle.
  const [hovered, setHovered] = useState(false);
  const [filter, setFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Section collapse state (default expanded to match oracle).
  const [favOpen, setFavOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(!isCompactRoute);
  const [dmOpen, setDmOpen] = useState(true);
  const [spacesOpen, setSpacesOpen] = useState(true);

  // Re-sync Channels collapse when the route's compact-ness changes. Collapsed
  // on inbox/replies/assigned, expanded on the resting Home/My Tasks routes.
  useEffect(() => {
    setChannelsOpen(!isCompactRoute);
  }, [isCompactRoute]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <SidebarHeader
        title="Home"
        hovered={hovered}
        onFilterChange={setFilter}
        variant="filter"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((v) => !v)}
      />
      {filterOpen && <HomeFilterChips />}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingLeft: 4, paddingRight: 4, paddingBottom: 0 }}>

        {/* Home nav items */}
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-popInboxFilled" size={16} />}
          label="Inbox"
          active={isInbox}
          onClick={go('/inbox')}
        />
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-reply" size={16} />}
          label="Replies"
          active={isReplies}
          onClick={go('/chat/r/threads')}
        />
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-commentAssigned" size={16} />}
          label="Assigned Comments"
          active={isAssignedComments}
          onClick={go('/chat/r/assigned')}
        />
        <SidebarItem
          icon={<Cu3Icon id="cu3-icon-myTasks" size={16} />}
          label="My Tasks"
          active={isMyTasks || isHomeRoute}
          onClick={go('/my-work')}
          rightContent={
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--cu-text-muted)', flexShrink: 0 }}>
              <Cu3Icon id="cu3-icon-dateDue" size={10} />
              <span style={{ fontSize: 11 }}>1</span>
            </span>
          }
        />
        <Menu
          width={236}
          align="left"
          trigger={({ ref, onClick, open }) => (
            <SidebarItemButton
              ref={ref}
              onClick={onClick}
              active={open}
              icon={<Cu3Icon id="cu3-icon-ellipsisRegular" size={16} />}
              label="More"
            />
          )}
        >
          <MoreAppsMenu />
        </Menu>

        <Divider />

        {/* Favorites */}
        <CollapsibleHeader
          label="Favorites"
          expanded={favOpen}
          onToggle={() => setFavOpen((v) => !v)}
          labelColor="var(--cu-text-muted)"
          right={
            <SectionMenuButton label="Favorites options" icon={<KebabGlyph />}>
              <FavoritesMenu />
            </SectionMenuButton>
          }
        />
        {favOpen && (
          <FavoritesList onOpenList={openList} onOpenChannel={openChannel} />
        )}

        <Divider small />

        {/* Channels */}
        <CollapsibleHeader
          label="Channels"
          expanded={channelsOpen}
          onToggle={() => setChannelsOpen((v) => !v)}
          hideArrow
          right={
            <SectionMenuButton label="Add channel" icon={<PlusGlyph />}>
              <MenuItem
                icon={<Cu3Icon id="cu3-icon-addSmall" size={16} />}
                label="Create Channel"
                onSelect={addChannel}
              />
              <MenuDivider />
              <ChannelsMenu />
            </SectionMenuButton>
          }
        />
        {channelsOpen && (
          <ChannelsList
            activeChannelId={activeChannelId}
            onOpen={openChannel}
            onCreate={addChannel}
          />
        )}

        <Divider small />

        {/* Direct Messages */}
        <CollapsibleHeader
          label="Direct Messages"
          expanded={dmOpen}
          onToggle={() => setDmOpen((v) => !v)}
          labelColor={LIGHT_TEXT}
          right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                2
              </span>
              <SectionMenuButton label="Direct Messages options" icon={<PlusGlyph />}>
                <DirectMessagesMenu />
              </SectionMenuButton>
            </span>
          }
        />

        <Divider small />

        {/* Spaces */}
        <CollapsibleHeader
          label="Spaces"
          expanded={spacesOpen}
          onToggle={() => setSpacesOpen((v) => !v)}
          hideArrow
          right={
            <SectionMenuButton label="Spaces options" icon={<PlusGlyph />} placement="above">
              <MenuItem
                icon={<Cu3Icon id="cu3-icon-addSmall" size={16} />}
                label="Create Space"
                onSelect={addSpace}
              />
              <MenuDivider />
              <SpacesMenu />
            </SectionMenuButton>
          }
        />

        {spacesOpen && (isDocRoute ? (
          <>
            <SidebarItem
              icon={<Cu3Icon id="cu3-icon-sidebarEverything" size={16} />}
              label="All Tasks – Cameron Mc's Wor..."
            />
            <SidebarItem
              icon={
                <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgb(42,113,225)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <Cu3Icon id="cu3-icon-user" size={11} />
                </span>
              }
              label="Team Space"
            />
            <SidebarItem
              icon={
                <span style={{ width: 18, height: 18, borderRadius: 4, background: 'rgb(44,169,88)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                  <Cu3Icon id="cu3-icon-user" size={11} />
                </span>
              }
              label="Software Development"
              rightContent={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: MUTED_TEXT }}>
                  <span style={{ fontWeight: 700 }}>...</span>
                  <InlineAction label="Add to Software Development">
                    <Cu3Icon id="cu3-icon-addSmall" size={12} />
                  </InlineAction>
                </span>
              }
            />
            <TreeRow label="Kanban Team" depth={1} icon={<MiniFolderIcon />} />
            <TreeRow
              label="Sprint Team"
              depth={1}
              icon={<MiniFolderIcon />}
              rightContent={
                <InlineAction label="Add to Sprint Team">
                  <Cu3Icon id="cu3-icon-addSmall" size={12} />
                </InlineAction>
              }
            />
            <TreeRow
              label="AB Content Manage..."
              depth={2}
              icon={<MiniListIcon />}
              rightContent={<ListCount value={9} />}
            />
            <TreeRow label="Projects" depth={2} icon={<MiniListIcon />} />
            <TreeRow label="Backlog" depth={2} icon={<MiniListIcon />} rightContent={<ListCount value={9} />} />
            <TreeRow label="Bugs" depth={2} icon={<MiniListIcon />} />
            <TreeRow label="Sprint 1 (10/6/25 - 10/19/..." depth={2} icon={<MiniListIcon />} />
            <TreeRow label="Getting Started Guide" depth={2} icon={<DocIcon />} active />
            <TreeRow label="Create Sprint" depth={2} icon={<Cu3Icon id="cu3-icon-addSmall" size={14} />} muted />
            <TreeRow label="Roadmap & Backlog" depth={1} icon={<MiniFolderIcon />} />
            <TreeRow label="Design" depth={1} icon={<MiniFolderIcon />} />
            <TreeRow label="QA" depth={1} icon={<MiniFolderIcon />} />
            <TreeRow label="Technical Support" depth={1} icon={<MiniFolderIcon color="rgb(0, 143, 85)" />} />
            <TreeRow label="folder test" depth={1} icon={<MiniFolderIcon color="rgb(0, 143, 85)" />} />
            <TreeRow label="DEMO" depth={1} icon={<MiniListIcon />} />
            <SidebarItem icon={<Cu3Icon id="cu3-icon-addSmall" size={14} />} label="New Space" />
          </>
        ) : (
          <SpacesTree activeListId={activeListId} onOpen={openList} filter={filter} />
        ))}
      </div>

      {isCompactRoute && <CustomizeSidebarFooter />}
    </div>
  );
}
