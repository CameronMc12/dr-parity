'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import {
  buildSearchIndex,
  flattenGroups,
  search,
} from '@/lib/search';
import type { MatchRange, SearchKind, SearchResult } from '@/lib/search';

const WORKSPACE_ID = '90152566819';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACCENT = 'var(--cu-accent, rgb(18,165,148))';
const MENU_BG = 'var(--cu-bg-menu, #fff)';

const KIND_LABEL: Record<SearchKind, string> = {
  task: 'Task',
  list: 'List',
  folder: 'Folder',
  space: 'Space',
  doc: 'Doc',
  person: 'Person',
};

/**
 * Global ⌘K command palette. Centered modal overlay opened from the TopBar
 * search button and the ⌘K / Ctrl+K shortcut. Indexes tasks, lists, folders,
 * spaces, docs and people via the pure engine in `@/lib/search`, groups hits by
 * type, highlights the matched substring, and navigates on Enter / click.
 *
 * Keyboard: ⌘K opens, Esc closes, ↑/↓ move the active row, Enter activates.
 */
export function SearchCommandPalette() {
  const open = useUiStore((s) => s.searchOpen);
  const query = useUiStore((s) => s.searchQuery);
  const setQuery = useUiStore((s) => s.setSearchQuery);
  const openSearch = useUiStore((s) => s.openSearch);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const openTask = useUiStore((s) => s.openTask);

  const router = useRouter();
  const pathname = usePathname();
  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  // Global ⌘K / Ctrl+K listener. Toggles the palette open; Esc handled below.
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
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Index built once per open; the workspace is local-first and stable here.
  const index = useMemo(
    () => (open ? buildSearchIndex(useWorkspaceStore.getState()) : null),
    [open],
  );

  const recents = useMemo<SearchResult[]>(() => {
    if (!index) return [];
    return [...index.tasks]
      .sort((a, b) => (b.dateUpdated ?? 0) - (a.dateUpdated ?? 0))
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        kind: 'task' as const,
        title: t.name,
        subtitle: t.status,
        ranges: [],
        score: 0,
        color: t.statusColor,
      }));
  }, [index]);

  const groups = useMemo(
    () => (index ? search(index, query) : []),
    [index, query],
  );

  const flat = useMemo<SearchResult[]>(
    () => (query.trim() ? flattenGroups(groups) : recents),
    [groups, recents, query],
  );

  useEffect(() => {
    setActive((i) => (flat.length === 0 ? 0 : Math.min(i, flat.length - 1)));
  }, [flat.length]);

  function navigate(result: SearchResult) {
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
        // No person route in the clone; just dismiss.
        break;
    }
    closeSearch();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flat[active];
      if (target) navigate(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  }

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  let renderIndex = -1;

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
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      <div
        role="dialog"
        aria-label="Search"
        aria-modal="true"
        data-testid="search-palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: 640,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: MENU_BG,
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
          border: `1px solid ${BORDER}`,
          overflow: 'hidden',
        }}
      >
        {/* Search input row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <span style={{ color: TEXT_MUTED, display: 'inline-flex' }}>
            <SearchGlyph />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search tasks, lists, docs and people…"
            aria-label="Search query"
            data-testid="search-input"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              color: TEXT_PRIMARY,
              fontFamily: 'inherit',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 5,
              padding: '2px 6px',
              fontFamily: 'inherit',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', padding: '6px 0 8px' }}>
          {flat.length === 0 ? (
            <EmptyState hasQuery={hasQuery} query={query} />
          ) : !hasQuery ? (
            <Section label="Recent">
              {recents.map((r) => {
                renderIndex++;
                const i = renderIndex;
                return (
                  <ResultRow
                    key={`${r.kind}-${r.id}`}
                    result={r}
                    active={i === active}
                    onHover={() => setActive(i)}
                    onClick={() => navigate(r)}
                  />
                );
              })}
            </Section>
          ) : (
            groups.map((group) => (
              <Section key={group.kind} label={group.label}>
                {group.results.map((r) => {
                  renderIndex++;
                  const i = renderIndex;
                  return (
                    <ResultRow
                      key={`${r.kind}-${r.id}`}
                      result={r}
                      active={i === active}
                      onHover={() => setActive(i)}
                      onClick={() => navigate(r)}
                    />
                  );
                })}
              </Section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div
        style={{
          padding: '6px 18px 4px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  result,
  active,
  onHover,
  onClick,
}: {
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '8px 18px',
        border: 'none',
        background: active ? HOVER_BG : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <ResultGlyph result={result} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <Highlighted text={result.title} ranges={result.ranges} />
        </span>
        {result.subtitle ? (
          <span
            style={{
              display: 'block',
              fontSize: 12,
              color: TEXT_MUTED,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {result.subtitle}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 11, color: TEXT_MUTED, flexShrink: 0 }}>
        {KIND_LABEL[result.kind]}
      </span>
    </button>
  );
}

function ResultGlyph({ result }: { result: SearchResult }) {
  if (result.kind === 'person') {
    return (
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: result.color ?? ACCENT,
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {result.initials ?? '?'}
      </span>
    );
  }
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        background: `${HOVER_BG}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: result.color ?? TEXT_SECONDARY,
      }}
    >
      <KindGlyph kind={result.kind} />
    </span>
  );
}

function Highlighted({ text, ranges }: { text: string; ranges: MatchRange[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, idx) => {
    if (r.start > cursor) parts.push(<span key={`p${idx}`}>{text.slice(cursor, r.start)}</span>);
    parts.push(
      <mark
        key={`m${idx}`}
        style={{ background: 'transparent', color: ACCENT, fontWeight: 600 }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{parts}</>;
}

function EmptyState({ hasQuery, query }: { hasQuery: boolean; query: string }) {
  return (
    <div
      style={{
        padding: '40px 18px',
        textAlign: 'center',
        color: TEXT_MUTED,
        fontSize: 13,
      }}
    >
      {hasQuery ? (
        <>
          No results for <strong style={{ color: TEXT_SECONDARY }}>“{query.trim()}”</strong>
        </>
      ) : (
        'Start typing to search everything'
      )}
    </div>
  );
}

// ── Glyphs ────────────────────────────────────────────────────────────────

function SearchGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function KindGlyph({ kind }: { kind: SearchKind }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'task':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          <path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case 'space':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a12 12 0 0 0 0 16M4 12h16" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Sidebar placeholder kept for the IconBar 'search' rail. Clicking the input
 * opens the full command palette, so the panel itself stays a thin launcher.
 */
export function SearchSidebar() {
  const openSearch = useUiStore((s) => s.openSearch);
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <span className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider">
          Search
        </span>
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => openSearch()}
          className="
            w-full h-8 px-3 rounded-[var(--cu-radius-md)] text-xs flex items-center justify-between
            bg-[var(--cu-bg-input)] text-[var(--cu-text-muted)]
            border border-[var(--cu-border)]
            hover:border-[var(--cu-border-strong)] transition-colors
          "
        >
          <span>Search everything…</span>
          <kbd className="text-[10px] text-[var(--cu-text-disabled)]">⌘K</kbd>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[var(--cu-text-muted)] text-xs">Press ⌘K to search</span>
      </div>
    </div>
  );
}
