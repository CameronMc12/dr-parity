'use client';

/**
 * "+ View" add-view popover, rebuilt to the official ClickUp layout: a wide
 * (~560px) surface with a top search, a "Popular" 2-column grid of large
 * icon-tiles, a "More views" 2-column grid, an "Apps & integrations" grid, and a
 * bottom row of Private/Pin checkboxes.
 *
 * Selecting a view type calls `addView(listId, code)` and navigates to it.
 * Selecting an app creates an `embed` view, stashes the app's preset URL under
 * the new view id (`setEmbedPreset`), then navigates — EmbedView reads the
 * preset on mount. The Private/Pin checkboxes are local UI state; "Private"
 * prefixes the created view name so the flag survives without a store change.
 *
 * Route on select: /<wsId>/v/<code>/<newInstanceId>.
 */

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from '@/components/ui/Menu';
import { viewTypeByCode, type ViewType } from '@/lib/view-types';
import { VIEW_APPS, setEmbedPreset, type ViewApp } from '@/lib/view-apps';
import { scopeKey, type ViewScope } from '@/lib/view-scope';
import { useAddView } from '@/store/views/hooks';
import { SearchIcon } from '@/components/pages/list-view-icons';
import { viewRoutePath } from './view-route';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';

/** Curated ClickUp ordering: "Popular" first, then "More views". */
const POPULAR_CODES = ['l', 'gtt', 'cal', 'dc', 'b', 'form', 'dash'] as const;
const MORE_CODES = ['tbl', 'wb', 'tl', 'act', 'wl', 'mm', 'team'] as const;

function viewTypesFor(codes: readonly string[]): ViewType[] {
  return codes.map(viewTypeByCode).filter((t): t is ViewType => t != null);
}

function matchesView(t: ViewType, q: string): boolean {
  return t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
}

function matchesApp(a: ViewApp, q: string): boolean {
  return a.label.toLowerCase().includes(q);
}

// ── Tiles ────────────────────────────────────────────────────────────────

function ViewTile({ type, onSelect }: { type: ViewType; onSelect: () => void }) {
  const { Glyph } = type;
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 10px',
        background: hover ? HOVER : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
        width: '100%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          background: 'var(--cu-bg-app, #fff)',
          border: `1px solid ${BORDER}`,
        }}
      >
        <Glyph size={17} color={type.color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
          {type.label}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11.5,
            color: TEXT_MUTED,
            lineHeight: 1.35,
            marginTop: 1,
          }}
        >
          {type.description}
        </span>
      </span>
    </button>
  );
}

function AppTile({ app, onSelect }: { app: ViewApp; onSelect: () => void }) {
  const { Glyph } = app;
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: hover ? HOVER : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
        width: '100%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          background: app.iconColor,
        }}
      >
        <Glyph size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>
        {app.label}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '10px 14px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        color: TEXT_MUTED,
      }}
    >
      {children}
    </div>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        padding: '0 8px',
      }}
    >
      {children}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        color: TEXT_PRIMARY,
        padding: 0,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${checked ? ACCENT : 'var(--cu-border-strong, rgb(200,200,200))'}`,
          background: checked ? ACCENT : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 120ms ease',
        }}
      >
        {checked && (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12l4 4 10-10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

// ── Menu ───────────────────────────────────────────────────────────────────

export function AddViewMenu({ scope }: { scope: ViewScope }) {
  const router = useRouter();
  const pathname = usePathname();
  const addView = useAddView();
  const [query, setQuery] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pinned, setPinned] = useState(false);

  const key = scopeKey(scope);
  const wsId = pathname.split('/').filter(Boolean)[0] ?? '';
  const q = query.trim().toLowerCase();

  const popular = useMemo(
    () => viewTypesFor(POPULAR_CODES).filter((t) => matchesView(t, q)),
    [q],
  );
  const more = useMemo(
    () => viewTypesFor(MORE_CODES).filter((t) => matchesView(t, q)),
    [q],
  );
  const apps = useMemo(() => VIEW_APPS.filter((a) => matchesApp(a, q)), [q]);

  // The views store persists only {id, code, name, listId} — no private/pin
  // fields. Both flags survive by prefixing the created view name, mirroring
  // ClickUp's "📌 Pinned" / private affordance until Batch C adds real columns.
  const nameFor = (label: string) => {
    const prefix = `${pinned ? '📌 ' : ''}${isPrivate ? 'Private ' : ''}`;
    return prefix ? `${prefix}${label}` : undefined;
  };

  const selectView = (type: ViewType) => {
    const view = addView(key, type.code, nameFor(type.label));
    if (wsId) router.push(viewRoutePath(wsId, scope, type.code, view.id));
  };

  const selectApp = (app: ViewApp) => {
    const view = addView(key, 'embed', nameFor(app.label));
    setEmbedPreset(view.id, app.url);
    if (wsId) router.push(viewRoutePath(wsId, scope, 'embed', view.id));
  };

  const empty = popular.length === 0 && more.length === 0 && apps.length === 0;

  return (
    <Menu
      width={560}
      align="left"
      surfaceStyle={{ padding: '8px 0 0' }}
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          aria-label="Add view"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            onClick(e);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 28,
            padding: '0 8px',
            marginLeft: 4,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--cu-text-muted)',
            fontSize: 13,
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> View
        </button>
      )}
    >
      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 34,
            padding: '0 10px',
            border: `1px solid ${BORDER}`,
            borderRadius: 7,
            color: TEXT_MUTED,
          }}
        >
          <SearchIcon size={15} />
          <input
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search views..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: TEXT_PRIMARY,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* Scroll body */}
      <div style={{ maxHeight: 'min(58vh, 460px)', overflowY: 'auto' }}>
        {popular.length > 0 && (
          <>
            <SectionLabel>Popular</SectionLabel>
            <TileGrid>
              {popular.map((t) => (
                <ViewTile key={t.code} type={t} onSelect={() => selectView(t)} />
              ))}
            </TileGrid>
          </>
        )}

        {more.length > 0 && (
          <>
            <SectionLabel>More views</SectionLabel>
            <TileGrid>
              {more.map((t) => (
                <ViewTile key={t.code} type={t} onSelect={() => selectView(t)} />
              ))}
            </TileGrid>
          </>
        )}

        {apps.length > 0 && (
          <>
            <SectionLabel>Apps &amp; integrations</SectionLabel>
            <TileGrid>
              {apps.map((a) => (
                <AppTile key={a.key} app={a} onSelect={() => selectApp(a)} />
              ))}
            </TileGrid>
          </>
        )}

        {empty && (
          <div style={{ padding: '14px 16px', fontSize: 13, color: TEXT_MUTED }}>
            No views match.
          </div>
        )}
      </div>

      {/* Bottom checkbox row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '10px 16px',
          marginTop: 6,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <Checkbox label="Private view" checked={isPrivate} onChange={setIsPrivate} />
        <Checkbox label="Pin view" checked={pinned} onChange={setPinned} />
      </div>
    </Menu>
  );
}
