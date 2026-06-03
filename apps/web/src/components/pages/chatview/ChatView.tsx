'use client';

/**
 * Chat view. ClickUp's Chat is a channel-style conversation pinned to a List: a
 * slim header, a scrollable transcript of grouped messages (avatar + name +
 * timestamp + body) seeded from the list's REAL tasks, day dividers, and a bottom
 * composer that appends a live message from the current member (CM). Reactions
 * toggle on hover; messages that reference a real task open it on click and carry
 * the shared task context menu.
 *
 * Owns the `chatview/` folder only. Imports the shared chrome (ViewShell renders
 * the breadcrumb + tab strip); this component is just the body slot. No
 * ViewToolbar — Chat has no task toolbar, so a slim channel header stands in.
 *
 * Route: /<wsId>/v/chat/:viewId  ->  <ChatView viewId=… />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveViewListId, useViewTasks } from '@/lib/view-data';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ViewShell } from '@/components/views/ViewShell';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';
import { useCurrentMemberId, useMembers } from '@/store/workspace/hooks';
import type { Member, Task } from '@/store/workspace/types';
import { CHAT } from './chat-tokens';
import { ChatComposer } from './ChatComposer';
import { ChatMessageRow } from './ChatMessageRow';
import { buildSeedMessages, dayKey, dayLabel, type ChatMessage } from './chat-messages';

const GROUP_WINDOW_MS = 5 * 60_000;

function DayDivider({ ms }: { ms: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 16px 8px',
        userSelect: 'none',
      }}
    >
      <span style={{ flex: 1, height: 1, background: CHAT.border }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: CHAT.textMuted,
          padding: '2px 10px',
          borderRadius: 10,
          border: `1px solid ${CHAT.border}`,
          background: CHAT.inputBg,
          whiteSpace: 'nowrap',
        }}
      >
        {dayLabel(ms)}
      </span>
      <span style={{ flex: 1, height: 1, background: CHAT.border }} />
    </div>
  );
}

function ChannelHeader({ name, count }: { name: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 16px',
        borderBottom: `1px solid ${CHAT.border}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 16, color: CHAT.textMuted, fontWeight: 700, lineHeight: 1 }}>#</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: CHAT.textPrimary }}>Chat</span>
      <span style={{ fontSize: 12, color: CHAT.textMuted }}>· {name}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: CHAT.textMuted }}>
        {count} {count === 1 ? 'message' : 'messages'}
      </span>
    </div>
  );
}

export function ChatView({ viewId }: { viewId: string }) {
  const listId = resolveViewListId(viewId);
  const tasks = useViewTasks(viewId);
  const members = useMembers();
  const currentMemberId = useCurrentMemberId();
  const openTask = useUiStore((s) => s.openTask);
  const { onContextMenu, menu } = useTaskContextMenu();

  // Human-readable list label for the channel header. Primitive selector only —
  // never return the resolved object itself (that would be a fresh ref each call).
  const listName = useWorkspaceStore(
    (s) => workspaceSelectors.findList(s, listId)?.list?.name ?? null,
  );

  const [appended, setAppended] = useState<ChatMessage[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const taskByName = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.name, t);
    return map;
  }, [tasks]);

  const seed = useMemo(
    () => buildSeedMessages(viewId, tasks, members),
    [viewId, tasks, members],
  );

  // Reset locally-appended messages + reaction overrides when the view changes.
  useEffect(() => {
    setAppended([]);
    setOverrides({});
  }, [viewId]);

  // Baseline reactions keyed by message id. Stable across reaction toggles (only
  // depends on `seed`/`appended`), so the reaction updater can read it without
  // listing the derived `messages` array as a dependency.
  const seedReactions = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const m of seed) map.set(m.id, m.reactions);
    for (const m of appended) map.set(m.id, m.reactions);
    return map;
  }, [seed, appended]);

  const messages = useMemo<ChatMessage[]>(() => {
    const merged = [...seed, ...appended].sort((a, b) => a.createdAt - b.createdAt);
    return merged.map((m): ChatMessage => {
      const override = overrides[m.id];
      return override ? { ...m, reactions: override } : m;
    });
  }, [seed, appended, overrides]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(
    (text: string) => {
      setAppended((prev) => [
        ...prev,
        {
          id: `local-${viewId}-${Date.now()}-${prev.length}`,
          authorId: currentMemberId,
          text,
          createdAt: Date.now(),
          reactions: {},
          system: false,
        },
      ]);
    },
    [viewId, currentMemberId],
  );

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      setOverrides((prev) => {
        const baseline = prev[messageId] ?? seedReactions.get(messageId) ?? {};
        const next = { ...baseline };
        if (next[emoji]) {
          next[emoji] -= 1;
          if (next[emoji] <= 0) delete next[emoji];
        } else {
          next[emoji] = 1;
        }
        return { ...prev, [messageId]: next };
      });
    },
    [seedReactions],
  );

  // Resolve a referenced task for a message by scanning its body for a real name.
  const taskFor = useCallback(
    (text: string): Task | undefined => {
      for (const [name, task] of taskByName) {
        if (name.length > 2 && text.includes(name)) return task;
      }
      return undefined;
    },
    [taskByName],
  );

  const channelName = listName ?? 'Chat';
  let prevDay = '';
  let prevAuthor = '';
  let prevTime = 0;

  return (
    <ViewShell code="chat" viewId={viewId}>
      {/*
        ViewShell wraps children in a block with `overflow: auto`. That wrapper is
        a flex child with a definite height, so `height: 100%` here resolves. We
        clip our own overflow (`overflow: hidden`) so the inner transcript div is
        the ONLY scroller: nothing ever leaks to the outer auto-overflow container,
        which would otherwise scroll the whole column (composer included) on short
        viewports and unpin the composer.
      */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <ChannelHeader name={channelName} count={messages.length} />

        <div
          ref={scrollRef}
          data-testid="chat-messages"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 0' }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '40px 24px',
                color: CHAT.textMuted,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: CHAT.textSecondary }}>
                This is the start of the conversation.
              </span>
              <span>Post an update or drop a note for the team about this list.</span>
            </div>
          ) : (
            messages.map((m) => {
              const key = dayKey(m.createdAt);
              const showDivider = key !== prevDay;
              const grouped =
                !showDivider &&
                m.authorId === prevAuthor &&
                m.createdAt - prevTime < GROUP_WINDOW_MS;
              prevDay = key;
              prevAuthor = m.authorId;
              prevTime = m.createdAt;
              const task = taskFor(m.text);
              return (
                <div key={m.id}>
                  {showDivider && <DayDivider ms={m.createdAt} />}
                  <ChatMessageRow
                    message={m}
                    author={memberById.get(m.authorId)}
                    grouped={grouped}
                    task={task}
                    onReact={handleReact}
                    onOpenTask={openTask}
                    onContextMenu={onContextMenu}
                  />
                </div>
              );
            })
          )}
        </div>

        <ChatComposer channelName={channelName} onSend={handleSend} />
      </div>
      {menu}
    </ViewShell>
  );
}
