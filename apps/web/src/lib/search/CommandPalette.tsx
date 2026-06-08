'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { buildSearchIndex, flattenGroups, search } from './engine';
import type { SearchIndex } from './engine';
import type { MatchRange, SearchKind, SearchResult } from './types';
import {
  AgentGlyph,
  AppsGlyph,
  ChannelGlyph,
  DocLinesGlyph,
  DriveGlyph,
  ExternalGlyph,
  FilterGlyph,
  FlowerGlyph,
  FolderGlyph,
  GearGlyph,
  GmailGlyph,
  LinkGlyph,
  ListLinesGlyph,
  MessageGlyph,
  NavArrowsGlyph,
  OverflowGlyph,
  SearchGlyph,
  SharePointGlyph,
  SortGlyph,
  SpaceGlyph,
  TaskCircleGlyph,
} from './glyphs';

const WORKSPACE_ID = '90152566819';

/**
 * ClickUp's command palette is its signature dark surface — it stays dark even
 * while the surrounding app runs in light mode. These tokens are local to the
 * palette so the dark treatment never bleeds into the rest of the shell.
 */
const PANEL_BG = '#1c1c1c';
const PANEL_BORDER = 'rgba(255,255,255,0.08)';
const FIELD_BORDER = 'rgba(255,255,255,0.12)';
const TEXT_PRIMARY = 'rgba(255,255,255,0.95)';
const TEXT_MUTED = 'rgba(255,255,255,0.46)';
const TEXT_FAINT = 'rgba(255,255,255,0.34)';
const ROW_ACTIVE_BG = 'rgba(255,255,255,0.055)';
const CHIP_BG = 'rgba(255,255,255,0.045)';
const KEYCAP_BG = 'rgba(255,255,255,0.07)';
const DIVIDER = 'rgba(255,255,255,0.1)';
const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';

type SourceTab = 'all' | 'clickup' | 'drive' | 'gmail' | 'sharepoint' | 'apps';
type FilterChip = 'tasks' | 'docs' | 'agents' | 'channels' | 'messages';

const SOURCE_TABS: { id: SourceTab; label: string; icon: ReactNode }[] = [
  { id: 'all', label: 'All', icon: null },
  { id: 'clickup', label: 'ClickUp', icon: <FlowerGlyph size={14} /> },
  { id: 'drive', label: 'Google Drive', icon: <DriveGlyph size={15} /> },
  { id: 'gmail', label: 'Gmail', icon: <GmailGlyph size={15} /> },
  { id: 'sharepoint', label: 'SharePoint', icon: <SharePointGlyph size={15} /> },
  { id: 'apps', label: 'Apps', icon: <AppsGlyph size={14} /> },
];

/** Filter chips map to the search kinds they constrain results to. */
const FILTER_CHIPS: { id: FilterChip; label: string; icon: ReactNode; kinds: SearchKind[] | null }[] = [
  { id: 'tasks', label: 'Tasks', icon: <TaskCircleGlyph size={14} />, kinds: ['task'] },
  { id: 'docs', label: 'Docs', icon: <DocLinesGlyph size={14} />, kinds: ['doc'] },
  { id: 'agents', label: 'Agents', icon: <AgentGlyph size={14} />, kinds: null },
  { id: 'channels', label: 'Channels', icon: <ChannelGlyph size={14} />, kinds: ['list', 'folder', 'space'] },
  { id: 'messages', label: 'Messages', icon: <MessageGlyph size={14} />, kinds: ['person'] },
];

const SOURCES_WITHOUT_RESULTS: SourceTab[] = ['drive', 'gmail', 'sharepoint', 'apps'];

function relativeTime(ms: number | null | undefined): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** A rendered row carries the result plus its resolved location + time meta. */
interface PaletteRow {
  result: SearchResult;
  location: string;
  time: string;
}

/**
 * Global ⌘K command palette — a 1:1 rebuild of ClickUp's dark command bar.
 *
 * Structure (top → bottom): borderless query input with an Ask AI pill; a row
 * of source tabs (All / ClickUp / Google Drive / Gmail / SharePoint / Apps);
 * a row of filter chips (Tasks / Docs / Agents / Channels / Messages …) plus
 * Filter and Sort on the right; a "Results" label; the result rows; and a
 * footer of command hints. The fuzzy engine in `@/lib/search` is untouched —
 * this component only renders and lightly filters its grouped output.
 *
 * Keyboard: ⌘K / Ctrl+K opens, Esc closes, ↑/↓ move the active row, Enter
 * activates. The "All" and "ClickUp" sources show real results; the other
 * sources and the Agents chip are visual-only tabs with no backend.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.searchOpen);
  const query = useUiStore((s) => s.searchQuery);
  const setQuery = useUiStore((s) => s.setSearchQuery);
  const openSearch = useUiStore((s) => s.openSearch);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const openTask = useUiStore((s) => s.openTask);
  const openAiPanel = useUiStore((s) => s.openAiPanel);

  const router = useRouter();
  const pathname = usePathname();
  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const [source, setSource] = useState<SourceTab>('all');
  const [filter, setFilter] = useState<FilterChip | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key === 'k' || e.key === 'K';
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (useUiStore.getState().searchOpen) closeSearch();
        else openSearch();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch, closeSearch]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    setSource('all');
    setFilter(null);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const index = useMemo<SearchIndex | null>(
    () => (open ? buildSearchIndex(useWorkspaceStore.getState()) : null),
    [open],
  );

  /** listId → human location, so task rows can show "in <list>". */
  const listLocation = useMemo(() => {
    const map = new Map<string, string>();
    if (index) for (const l of index.lists) map.set(l.id, l.name);
    return map;
  }, [index]);

  const recents = useMemo<SearchResult[]>(() => {
    if (!index) return [];
    return [...index.tasks]
      .sort((a, b) => (b.dateUpdated ?? 0) - (a.dateUpdated ?? 0))
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        kind: 'task' as const,
        title: t.name,
        subtitle: listLocation.get(t.listId) ?? '',
        ranges: [],
        score: 0,
        color: t.statusColor,
      }));
  }, [index, listLocation]);

  const groups = useMemo(
    () => (index ? search(index, query) : []),
    [index, query],
  );

  const baseResults = useMemo<SearchResult[]>(
    () => (query.trim() ? flattenGroups(groups) : recents),
    [groups, recents, query],
  );

  /** taskId → dateUpdated, for the relative-time meta on rows. */
  const taskUpdated = useMemo(() => {
    const map = new Map<string, number | null>();
    if (index) for (const t of index.tasks) map.set(t.id, t.dateUpdated);
    return map;
  }, [index]);

  const rows = useMemo<PaletteRow[]>(() => {
    if (SOURCES_WITHOUT_RESULTS.includes(source)) return [];
    const allowed = filter ? FILTER_CHIPS.find((c) => c.id === filter)?.kinds : undefined;
    if (allowed === null) return [];

    return baseResults
      .filter((r) => (allowed ? allowed.includes(r.kind) : true))
      .map((r) => ({
        result: r,
        location: r.kind === 'task' ? listLocation.get(r.id) ?? r.subtitle : r.subtitle,
        time: r.kind === 'task' ? relativeTime(taskUpdated.get(r.id)) : '',
      }));
  }, [baseResults, source, filter, listLocation, taskUpdated]);

  useEffect(() => {
    setActive((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length]);

  const navigate = useCallback(
    (result: SearchResult) => {
      switch (result.kind) {
        case 'task':
          openTask(result.id);
          break;
        case 'list':
          router.push(`/${wsId}/v/l/${result.id}`);
          break;
        case 'folder':
          router.push(`/${wsId}/folder/${result.id}`);
          break;
        case 'space':
          router.push(`/${wsId}/space/${result.id}`);
          break;
        case 'doc':
          router.push(`/${wsId}/v/dc/${result.id}`);
          break;
        case 'person':
          break;
      }
      closeSearch();
    },
    [openTask, router, wsId, closeSearch],
  );

  const askAi = useCallback(() => {
    closeSearch();
    openAiPanel();
  }, [closeSearch, openAiPanel]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = rows[active]?.result;
      if (target) navigate(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  }

  if (!open) return null;

  const showResultsLabel = rows.length > 0;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeSearch();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10070,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '8vh',
        font: FONT,
      }}
    >
      <div
        role="dialog"
        aria-label="Search, run a command, or ask a question"
        aria-modal="true"
        data-testid="search-palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: 760,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          background: PANEL_BG,
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.45)',
          border: `1px solid ${PANEL_BORDER}`,
          overflow: 'hidden',
          color: TEXT_PRIMARY,
        }}
      >
        <InputRow
          inputRef={inputRef}
          query={query}
          onChange={(v) => {
            setQuery(v);
            setActive(0);
          }}
          onAskAi={askAi}
        />
        <SourceTabsRow active={source} onSelect={setSource} />
        <FilterChipsRow active={filter} onToggle={(id) => setFilter((cur) => (cur === id ? null : id))} />

        <div style={{ overflowY: 'auto', padding: '0 0 6px' }}>
          {showResultsLabel ? (
            <div
              style={{
                padding: '10px 16px 4px',
                fontSize: 12,
                fontWeight: 500,
                color: TEXT_MUTED,
              }}
            >
              Results
            </div>
          ) : (
            <EmptyState query={query} source={source} />
          )}
          {rows.map((row, i) => (
            <ResultRow
              key={`${row.result.kind}-${row.result.id}`}
              row={row}
              active={i === active}
              onHover={() => setActive(i)}
              onClick={() => navigate(row.result)}
              onAskAi={askAi}
            />
          ))}
        </div>

        <FooterBar />
      </div>
    </div>
  );
}

function InputRow({
  inputRef,
  query,
  onChange,
  onAskAi,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onChange: (v: string) => void;
  onAskAi: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px 12px',
      }}
    >
      <span style={{ color: TEXT_MUTED, display: 'inline-flex' }}>
        <SearchGlyph size={18} />
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search, run a command, or ask a question…"
        aria-label="Search query"
        data-testid="search-input"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          color: TEXT_PRIMARY,
          fontFamily: 'inherit',
        }}
      />
      <button
        type="button"
        onClick={onAskAi}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '0 12px',
          borderRadius: 8,
          border: `1px solid ${FIELD_BORDER}`,
          background: 'transparent',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = CHIP_BG;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        Ask AI
        <FlowerGlyph size={16} />
      </button>
    </div>
  );
}

function SourceTabsRow({
  active,
  onSelect,
}: {
  active: SourceTab;
  onSelect: (id: SourceTab) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 16px',
        borderBottom: `1px solid ${PANEL_BORDER}`,
      }}
      role="tablist"
      aria-label="Search sources"
    >
      {SOURCE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? '#fff' : 'transparent'}`,
              color: isActive ? TEXT_PRIMARY : TEXT_MUTED,
              fontSize: 13,
              fontWeight: isActive ? 600 : 450,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: -1,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChipsRow({
  active,
  onToggle,
}: {
  active: FilterChip | null;
  onToggle: (id: FilterChip) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
      }}
    >
      {FILTER_CHIPS.map((chip) => (
        <Chip
          key={chip.id}
          active={chip.id === active}
          onClick={() => onToggle(chip.id)}
          icon={chip.icon}
          label={chip.label}
        />
      ))}
      <Chip icon={<OverflowGlyph size={16} />} ariaLabel="More filters" />

      <div style={{ flex: 1 }} />
      <div style={{ width: 1, height: 16, margin: '0 2px', background: DIVIDER }} />
      <Chip icon={<FilterGlyph size={14} />} label="Filter" />
      <Chip icon={<SortGlyph size={14} />} label="Sort" />
    </div>
  );
}

function Chip({
  active = false,
  onClick,
  icon,
  label,
  ariaLabel,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      aria-pressed={onClick ? active : undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: label ? '0 10px' : '0 7px',
        borderRadius: 6,
        border: `1px solid ${active ? FIELD_BORDER : PANEL_BORDER}`,
        background: active ? KEYCAP_BG : 'transparent',
        color: active ? TEXT_PRIMARY : TEXT_MUTED,
        fontSize: 13,
        fontWeight: 450,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = CHIP_BG;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function ResultRow({
  row,
  active,
  onHover,
  onClick,
  onAskAi,
}: {
  row: PaletteRow;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  onAskAi: () => void;
}) {
  const { result, location, time } = row;
  return (
    <div
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 36,
        margin: '0 8px',
        padding: '6px 8px',
        borderRadius: 8,
        background: active ? ROW_ACTIVE_BG : 'transparent',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: TEXT_MUTED, display: 'inline-flex', flexShrink: 0 }}>
        <KindLeadingGlyph kind={result.kind} />
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 0, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 14,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
          }}
        >
          <Highlighted text={result.title} ranges={result.ranges} />
        </span>
        {(location || time) && (
          <span
            style={{
              fontSize: 13,
              color: TEXT_MUTED,
              marginLeft: 8,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {location ? `in ${location}` : ''}
            {location && time ? ' · ' : ''}
            {time}
          </span>
        )}
      </span>

      {active && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <RowActionPill onAskAi={onAskAi} />
          <RowIconButton label="Open in new tab" onClick={onClick}>
            <ExternalGlyph size={14} />
          </RowIconButton>
          <RowIconButton label="Copy link" onClick={() => copyLink(result)}>
            <LinkGlyph size={14} />
          </RowIconButton>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              marginLeft: 2,
              borderRadius: 5,
              background: KEYCAP_BG,
              color: TEXT_MUTED,
              fontSize: 12,
            }}
          >
            ↵
          </span>
        </span>
      )}
    </div>
  );
}

function copyLink(result: SearchResult) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard
      .writeText(`https://app.clickup.com/${result.kind}/${result.id}`)
      .catch(() => undefined);
  }
}

function RowActionPill({ onAskAi }: { onAskAi: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onAskAi();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 9px',
        borderRadius: 6,
        border: `1px solid ${FIELD_BORDER}`,
        background: 'transparent',
        color: TEXT_PRIMARY,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Ask AI
      <FlowerGlyph size={14} />
    </button>
  );
}

function RowIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: TEXT_MUTED,
        cursor: 'pointer',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = KEYCAP_BG;
        (e.currentTarget as HTMLButtonElement).style.color = TEXT_PRIMARY;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = TEXT_MUTED;
      }}
    >
      {children}
    </button>
  );
}

function KindLeadingGlyph({ kind }: { kind: SearchKind }) {
  switch (kind) {
    case 'task':
      return <TaskCircleGlyph size={16} />;
    case 'doc':
      return <DocLinesGlyph size={16} />;
    case 'folder':
      return <FolderGlyph size={16} />;
    case 'space':
      return <SpaceGlyph size={16} />;
    case 'person':
      return <MessageGlyph size={16} />;
    case 'list':
    default:
      return <ListLinesGlyph size={16} />;
  }
}

function Highlighted({ text, ranges }: { text: string; ranges: MatchRange[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, idx) => {
    if (r.start > cursor) parts.push(<span key={`p${idx}`}>{text.slice(cursor, r.start)}</span>);
    parts.push(
      <mark key={`m${idx}`} style={{ background: 'transparent', color: '#fff', fontWeight: 600 }}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

function EmptyState({ query, source }: { query: string; source: SourceTab }) {
  const trimmed = query.trim();
  const message = SOURCES_WITHOUT_RESULTS.includes(source)
    ? 'Connect this source to search across it.'
    : trimmed
      ? `No results for “${trimmed}”`
      : 'Start typing to search everything';
  return (
    <div style={{ padding: '40px 22px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
      {message}
    </div>
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        borderRadius: 4,
        background: KEYCAP_BG,
        color: TEXT_MUTED,
        fontSize: 11,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </span>
  );
}

function FooterBar() {
  const hintStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: TEXT_FAINT,
    fontSize: 12,
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '8px 14px',
        borderTop: `1px solid ${PANEL_BORDER}`,
      }}
    >
      <span style={{ color: TEXT_MUTED, display: 'inline-flex' }}>
        <NavArrowsGlyph size={14} />
      </span>
      <span style={hintStyle}>
        Press <Keycap>/</Keycap> to see all available commands, hit <Keycap>Tab</Keycap> to see additional actions
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-label="Search settings"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: TEXT_MUTED,
          cursor: 'pointer',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = KEYCAP_BG;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <GearGlyph size={14} />
      </button>
    </div>
  );
}
