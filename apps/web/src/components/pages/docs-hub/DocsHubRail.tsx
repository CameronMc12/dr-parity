'use client';

import { type ReactNode } from 'react';
import { useDocsHubStore } from '@/store/docs-hub-store';
import { useDocs, useDocsHydration } from '@/store/workspace/docs.slice';
import {
  AllDocsIcon,
  MyDocsIcon,
  SharedIcon,
  PrivateIcon,
  MeetingNotesIcon,
  ArchivedIcon,
  FavoriteIcon,
  DocGlyphIcon,
} from './docs-hub-icons';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACTIVE = 'var(--cu-bg-active, rgb(236,236,236))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';

interface RailItem {
  id: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

const PRIMARY: RailItem[] = [
  { id: 'all', label: 'All Docs', icon: <AllDocsIcon /> },
  { id: 'mine', label: 'My Docs', icon: <MyDocsIcon />, count: 11 },
  { id: 'shared', label: 'Shared with me', icon: <SharedIcon /> },
  { id: 'private', label: 'Private', icon: <PrivateIcon />, count: 1 },
  { id: 'meeting', label: 'Meeting Notes', icon: <MeetingNotesIcon /> },
  { id: 'archived', label: 'Archived', icon: <ArchivedIcon /> },
];

function RailRow({
  item,
  active,
  onSelect,
}: {
  item: RailItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        minHeight: 32,
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: active ? ACTIVE : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: active ? TEXT : MUTED,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', color: active ? TEXT : MUTED, flexShrink: 0 }}>{item.icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label}
      </span>
      {item.count != null && (
        <span style={{ color: MUTED, fontSize: 12, fontWeight: 400 }}>{item.count}</span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 8px 6px',
        color: MUTED,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </div>
  );
}

function FavoriteRow({ row }: { row: { name: string; emoji: string | null } }) {
  return (
    <div
      style={{
        minHeight: 30,
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: MUTED,
        fontSize: 13,
      }}
    >
      <span style={{ display: 'flex', color: MUTED, flexShrink: 0, fontSize: 14, width: 16 }}>
        {row.emoji ?? <DocGlyphIcon size={15} />}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
    </div>
  );
}

/**
 * Docs hub left rail. Oracle: All Docs / My Docs / Shared with me / Private /
 * Meeting Notes / Archived, then a Favorites section, then Popular Wikis. The
 * active section drives the hub's table (only "All Docs" is populated here).
 */
export function DocsHubRail() {
  useDocsHydration();
  const activeId = useDocsHubStore((s) => s.activeSection);
  const onSelect = useDocsHubStore((s) => s.setActiveSection);
  const docs = useDocs();
  const favorites = docs
    .filter((d) => d.favorite)
    .map((d) => ({ id: d.id, name: d.name, emoji: d.emoji }));

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>Docs</span>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        {PRIMARY.map((item) => (
          <RailRow
            key={item.id}
            item={item}
            active={item.id === activeId}
            onSelect={() => onSelect(item.id)}
          />
        ))}

        <SectionLabel>Favorites</SectionLabel>
        {favorites.map((row) => (
          <FavoriteRow key={row.id} row={row} />
        ))}
        {favorites.length === 0 && (
          <div style={{ padding: '5px 8px', color: MUTED, fontSize: 12 }}>
            <FavoriteIcon size={14} /> No favorites yet
          </div>
        )}

        <SectionLabel>Popular Wikis</SectionLabel>
        <div
          style={{
            margin: '4px 4px 0',
            padding: '20px 16px',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            textAlign: 'center',
            color: MUTED,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          Most viewed and active Wikis appear here
        </div>
      </nav>
    </aside>
  );
}
