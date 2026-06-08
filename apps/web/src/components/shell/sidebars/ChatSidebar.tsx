'use client';

/**
 * Chat sidebar — replaces the Home tree while the Chat icon is active. Sections:
 * Favorites (favorited channels/DMs), Channels (every store channel + Add row),
 * Direct Messages (DM conversations + New message row). A compose pencil sits in
 * the header (reusing SidebarHeader's hover/collapse pattern via the 'chat'
 * variant), and a bottom bar carries two view toggles + a settings gear.
 *
 * Routing: channel → /{ws}/chat/c/{id}, DM → /{ws}/chat/dm/{id}, home → /{ws}/chat.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspace';
import {
  useChannels,
  useCurrentMemberId,
  useDms,
  useFavorites,
  useMembers,
} from '@/store/workspace/hooks';
import type { Channel, Member } from '@/store/workspace/types';
import {
  PLAIN_HASH_CHANNEL_IDS,
  WORKSPACE_BADGE_CHANNEL_IDS,
} from '@/store/workspace/seed';
import { SidebarHeader } from './SidebarHeader';
import { Cu3Icon, SidebarItem } from './SpacesTree';
import {
  ComposeIcon,
  GroupedViewIcon,
  ClockIcon,
  GearIcon,
  HashIcon,
  HashListIcon,
  WorkspaceBadgeIcon,
} from '@/components/pages/chat/chat-tool-icons';
import { ChevronDownGlyph } from './SidebarHeaderIcons';
import { dmDisplay } from '@/components/pages/chat/dm-title';
import { useShallow } from 'zustand/react/shallow';

const WORKSPACE_ID = '90152566819';
const MUTED = 'var(--cu-text-muted)';
const LIGHT = 'var(--cu-text-primary)';
const HOVER_BG = 'var(--cu-bg-hover)';
const BORDER = 'var(--cu-border-divider)';

/** The leading glyph for a channel row, matching the real ClickUp icon set. */
function channelIcon(channelId: string): React.ReactNode {
  if (WORKSPACE_BADGE_CHANNEL_IDS.has(channelId)) return <WorkspaceBadgeIcon size={16} letter="C" />;
  if (PLAIN_HASH_CHANNEL_IDS.has(channelId)) return <HashIcon size={16} />;
  return <HashListIcon size={16} />;
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 12,
        paddingRight: 8,
        paddingTop: 8,
        paddingBottom: 6,
        minHeight: 26,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>{children}</span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

function DmAvatar({ member }: { member?: Member }) {
  return (
    <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: member?.color ?? '#7b68ee',
          color: 'white',
          fontSize: 8,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {member?.initials ?? '?'}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'rgb(76, 191, 110)',
          border: '1.5px solid var(--cu-bg-sidebar, #fff)',
        }}
      />
    </span>
  );
}

function UnreadDot({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread`}
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cu-accent)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 9,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

function DmRow({
  title,
  member,
  active,
  badge,
  onOpen,
}: {
  title: string;
  member?: Member;
  active: boolean;
  badge: number;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <SidebarItem
        icon={<DmAvatar member={member} />}
        label={title}
        active={active}
        onClick={onOpen}
        rightContent={
          hover ? (
            <button
              aria-label={`Edit ${title}`}
              onClick={(e) => {
                e.stopPropagation();
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
                color: MUTED,
                flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
              </svg>
            </button>
          ) : badge > 0 ? (
            <UnreadDot count={badge} />
          ) : undefined
        }
      />
    </div>
  );
}

function BottomBarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        color: active ? LIGHT : MUTED,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export function ChatSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const channels = useChannels();
  const dms = useDms();
  const members = useMembers();
  const favorites = useFavorites();
  const currentMemberId = useCurrentMemberId();
  const createChannel = useWorkspaceStore((s) => s.createChannel);

  // Per-conversation message counts. Drives unread badges: a conversation with
  // messages the current member has not opened yet shows the count.
  const channelCounts = useWorkspaceStore(
    useShallow((s) => {
      const out: Record<string, number> = {};
      for (const c of s.channels) out[c.id] = s.messages[c.id]?.length ?? 0;
      return out;
    }),
  );
  const dmCounts = useWorkspaceStore(
    useShallow((s) => {
      const out: Record<string, number> = {};
      for (const dm of s.dms) out[dm.id] = s.dmMessages[dm.id]?.length ?? 0;
      return out;
    }),
  );

  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const [hovered, setHovered] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [favOpen, setFavOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmOpen, setDmOpen] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const [recent, setRecent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);
  // Conversations the current member has opened this session (read).
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const memberById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  const activeChannelId = pathname.match(/\/chat\/c\/([^/]+)/)?.[1] ?? null;
  const activeDmId = pathname.match(/\/chat\/dm\/([^/]+)/)?.[1] ?? null;

  // The open conversation is always read; clear its unread badge.
  useEffect(() => {
    const id = activeChannelId ?? activeDmId;
    if (!id) return;
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, [activeChannelId, activeDmId]);

  const unreadFor = (id: string, count: number): number =>
    seen.has(id) ? 0 : count;

  const q = search.trim().toLowerCase();
  const visibleChannels = q
    ? channels.filter((c) => c.name.toLowerCase().includes(q))
    : channels;
  const dmList = dms.map((dm) => ({ dm, display: dmDisplay(dm, currentMemberId, memberById) }));
  const visibleDms = q
    ? dmList.filter(({ display }) => display.title.toLowerCase().includes(q))
    : dmList;

  const favoriteChannels = favorites
    .map((id) => channels.find((c) => c.id === id))
    .filter((c): c is Channel => Boolean(c));

  const markSeen = (id: string) =>
    setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const openChannel = (id: string) => {
    markSeen(id);
    router.push(`/${wsId}/chat/c/${id}`);
  };
  const openDm = (id: string) => {
    markSeen(id);
    router.push(`/${wsId}/chat/dm/${id}`);
  };
  const goHome = () => router.push(`/${wsId}/chat`);

  const startCreate = () => {
    setCreating(true);
    setDraftName('');
    setChannelsOpen(true);
  };

  const commitCreate = () => {
    const name = draftName.trim();
    if (!name) {
      setCreating(false);
      return;
    }
    const channel = createChannel(name);
    setCreating(false);
    setDraftName('');
    openChannel(channel.id);
  };

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  const composeButton = (
    <button
      type="button"
      aria-label="Compose"
      title="New message"
      onClick={goHome}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 26,
        padding: 0,
        background: 'var(--cu-bg-strong, rgb(38,38,38))',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: '#fff',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }}>
        <ComposeIcon size={15} />
      </span>
      <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.24)', flexShrink: 0 }} />
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 26 }}>
        <ChevronDownGlyph size={12} />
      </span>
    </button>
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      <SidebarHeader
        title="Chat"
        hovered={hovered}
        variant="chat"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((v) => !v)}
        onFilterChange={setSearch}
        primaryAction={composeButton}
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4, paddingLeft: 4, paddingRight: 4 }}>
        {/* Favorites */}
        <SectionLabel
          right={
            <button
              aria-label="Toggle favorites"
              onClick={() => setFavOpen((v) => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}
            >
              <ChevronDownGlyph size={12} />
            </button>
          }
        >
          Favorites
        </SectionLabel>
        {favOpen &&
          favoriteChannels.map((c) => (
            <SidebarItem
              key={c.id}
              icon={channelIcon(c.id)}
              label={c.name}
              active={activeChannelId === c.id}
              badge={unreadFor(c.id, channelCounts[c.id] ?? 0)}
              onClick={() => openChannel(c.id)}
            />
          ))}

        {/* Channels */}
        <SectionLabel
          right={
            <button
              aria-label="Toggle channels"
              onClick={() => setChannelsOpen((v) => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}
            >
              <ChevronDownGlyph size={12} />
            </button>
          }
        >
          Channels
        </SectionLabel>
        {channelsOpen && (
          <>
            {visibleChannels.map((c) => (
              <SidebarItem
                key={c.id}
                icon={channelIcon(c.id)}
                label={c.name}
                active={activeChannelId === c.id}
                badge={unreadFor(c.id, channelCounts[c.id] ?? 0)}
                onClick={() => openChannel(c.id)}
              />
            ))}
            {creating ? (
              <div style={{ padding: '2px 8px 2px 12px' }}>
                <input
                  ref={createInputRef}
                  data-testid="chat-create-channel-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitCreate();
                    } else if (e.key === 'Escape') {
                      setCreating(false);
                      setDraftName('');
                    }
                  }}
                  onBlur={commitCreate}
                  placeholder="Channel name…"
                  aria-label="New channel name"
                  style={{
                    width: '100%',
                    height: 28,
                    padding: '0 8px',
                    boxSizing: 'border-box',
                    background: 'var(--cu-bg-input)',
                    border: `1px solid var(--cu-accent)`,
                    borderRadius: 6,
                    outline: 'none',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    color: LIGHT,
                  }}
                />
              </div>
            ) : (
              <SidebarItem
                icon={<Cu3Icon id="cu3-icon-addSmall" size={16} />}
                label="Add Channel"
                onClick={startCreate}
              />
            )}
          </>
        )}

        {/* Direct Messages */}
        <SectionLabel
          right={
            <button
              aria-label="Toggle direct messages"
              onClick={() => setDmOpen((v) => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex' }}
            >
              <ChevronDownGlyph size={12} />
            </button>
          }
        >
          Direct Messages
        </SectionLabel>
        {dmOpen && (
          <>
            {visibleDms.map(({ dm, display }) => (
              <DmRow
                key={dm.id}
                title={display.title}
                member={display.other}
                active={activeDmId === dm.id}
                badge={unreadFor(dm.id, dmCounts[dm.id] ?? 0)}
                onOpen={() => openDm(dm.id)}
              />
            ))}
            <SidebarItem
              icon={<Cu3Icon id="cu3-icon-addSmall" size={16} />}
              label="New message"
              onClick={goHome}
            />
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '6px 10px',
          borderTop: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <BottomBarButton label="Grouped view" active={grouped} onClick={() => setGrouped((v) => !v)}>
          <GroupedViewIcon size={16} />
        </BottomBarButton>
        <BottomBarButton label="Recent activity" active={recent} onClick={() => setRecent((v) => !v)}>
          <ClockIcon size={16} />
        </BottomBarButton>
        <span style={{ flex: 1 }} />
        <BottomBarButton label="Chat settings" onClick={() => router.push(`/${wsId}/settings/notifications`)}>
          <GearIcon size={16} />
        </BottomBarButton>
      </div>
    </div>
  );
}
