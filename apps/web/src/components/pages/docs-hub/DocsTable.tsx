'use client';

import { useMemo } from 'react';
import { relativeUpdated } from '@/components/pages/doc/relative-time';
import { useCurrentMemberId, useMembers } from '@/store/workspace/hooks';
import type { DocHubRow } from './docs-hub-data';
import { DocGlyphIcon, SharingGlyphIcon } from './docs-hub-icons';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER = 'var(--cu-bg-hover, rgb(248,248,248))';

const COLS = '1fr 200px 110px 150px 150px 72px';
/** Oracle owner-avatar green (sampled from the real Docs hub). */
const OWNER_GREEN = 'rgb(64,188,134)';

function HeaderCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div
      style={{
        color: MUTED,
        fontSize: 12,
        fontWeight: 500,
        textAlign: align,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

function DocAvatar({ doc }: { doc: DocHubRow }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: doc.emoji ? 15 : undefined,
        color: 'rgb(79,153,255)',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {doc.emoji ?? <DocGlyphIcon size={16} />}
    </span>
  );
}

function OwnerBadge({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function DocTableRow({
  doc,
  ownerInitials,
  ownerColor,
  onOpen,
  onContextMenu,
}: {
  doc: DocHubRow;
  ownerInitials: string;
  ownerColor: string;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const updated = relativeUpdated(doc.updated);

  return (
    <div
      role="row"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      style={{
        display: 'grid',
        gridTemplateColumns: COLS,
        alignItems: 'center',
        columnGap: 16,
        height: 44,
        padding: '0 8px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background 100ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <DocAvatar doc={doc} />
        <span
          style={{
            color: TEXT,
            fontSize: 14,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.name}
        </span>
        {doc.pageCount > 1 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: MUTED, fontSize: 12, flexShrink: 0 }}>
            <DocGlyphIcon size={13} />
            {doc.pageCount}
          </span>
        )}
      </div>

      <div
        style={{
          color: SECONDARY,
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {doc.location}
      </div>

      <div style={{ color: MUTED, fontSize: 13 }}>–</div>

      <div style={{ color: SECONDARY, fontSize: 13 }}>{updated}</div>

      <div style={{ color: SECONDARY, fontSize: 13 }}>{updated}</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <OwnerBadge initials={ownerInitials} color={ownerColor} />
      </div>
    </div>
  );
}

/**
 * Docs hub table. Columns mirror the oracle (Name / Location / Tags / Date
 * updated / Date viewed / Sharing). Rows open the single-doc DocView on click
 * and the doc context menu on right-click. Owner avatar stands in for the
 * Sharing column, sourced from the current workspace member.
 */
export function DocsTable({
  rows,
  onOpen,
  onContextMenu,
}: {
  rows: DocHubRow[];
  onOpen: (doc: DocHubRow) => void;
  onContextMenu: (e: React.MouseEvent, doc: DocHubRow) => void;
}) {
  const members = useMembers();
  const currentId = useCurrentMemberId();
  const owner = useMemo(
    () => members.find((m) => m.id === currentId) ?? members[0],
    [members, currentId],
  );

  const ownerInitials = owner?.initials?.slice(0, 1) ?? 'C';
  const ownerColor = OWNER_GREEN;

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: COLS,
          alignItems: 'center',
          columnGap: 16,
          height: 36,
          padding: '0 8px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <HeaderCell>Name</HeaderCell>
        <HeaderCell>Location</HeaderCell>
        <HeaderCell>Tags</HeaderCell>
        <HeaderCell>Date updated</HeaderCell>
        <HeaderCell>Date viewed</HeaderCell>
        <HeaderCell align="right">
          <span style={{ display: 'inline-flex' }}>
            <SharingGlyphIcon size={15} />
          </span>
        </HeaderCell>
      </div>

      {rows.map((doc) => (
        <DocTableRow
          key={doc.id}
          doc={doc}
          ownerInitials={ownerInitials}
          ownerColor={ownerColor}
          onOpen={() => onOpen(doc)}
          onContextMenu={(e) => onContextMenu(e, doc)}
        />
      ))}
    </div>
  );
}
