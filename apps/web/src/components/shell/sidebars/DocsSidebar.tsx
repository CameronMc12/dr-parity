'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Chevron } from '@/components/pages/list-view-icons';
import { DocGlyphIcon } from '@/components/pages/docs-hub/docs-hub-icons';
import {
  useDocs,
  useDocsHydration,
  useDocsStore,
  docUpdatedAt,
  type Doc,
} from '@/store/workspace/docs.slice';
import { useCurrentMemberId } from '@/store/workspace/hooks';

const WORKSPACE_ID = '90152566819';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACTIVE = 'var(--cu-bg-active, rgb(236,236,236))';
const ACCENT = 'var(--cu-accent, rgb(123,97,255))';

type Filter = 'mine' | 'shared';

/**
 * Docs shell sidebar — the faithful ClickUp Docs left rail. Header with a
 * "+ Create Doc" CTA, a "Recent" section (most-recently-edited docs), a
 * Created-by-me / Shared filter, and a tree of all docs that expand to reveal
 * their pages. The active doc/page is highlighted from the route; right-click a
 * doc for rename / duplicate / favorite / delete (all persisted to the store).
 */
export function DocsSidebar() {
  useDocsHydration();
  const pathname = usePathname();
  const router = useRouter();
  const docs = useDocs();
  const memberId = useCurrentMemberId();
  const createDoc = useDocsStore((s) => s.createDoc);

  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const docMatch = pathname.match(/\/v\/dc\/([^/]+)(?:\/([^/]+))?/);
  const activeDocId = docMatch?.[1] ?? null;
  const activePageId = docMatch?.[2] ?? null;

  const [filter, setFilter] = useState<Filter>('mine');

  const openDoc = (docId: string, pageId?: string) =>
    router.push(`/${wsId}/v/dc/${docId}${pageId ? `/${pageId}` : ''}`);

  const handleCreate = () => openDoc(createDoc());

  const recent = useMemo(
    () =>
      docs
        .slice()
        .sort((a, b) => docUpdatedAt(b) - docUpdatedAt(a))
        .slice(0, 5),
    [docs],
  );

  const filtered = useMemo(() => {
    const mine = (d: Doc) => d.authorId === null || d.authorId === memberId;
    return docs.filter((d) => (filter === 'mine' ? mine(d) : !mine(d)));
  }, [docs, filter, memberId]);

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
          justifyContent: 'space-between',
          padding: '0 12px',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>Docs</span>
        <button
          type="button"
          onClick={handleCreate}
          title="Create Doc"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 8px',
            border: 'none',
            borderRadius: 6,
            background: ACCENT,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Create
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        <SectionLabel>Recent</SectionLabel>
        {recent.map((doc) => (
          <DocRow
            key={`recent-${doc.id}`}
            doc={doc}
            active={doc.id === activeDocId}
            onOpen={() => openDoc(doc.id)}
          />
        ))}
        {recent.length === 0 && <EmptyHint>No recent docs</EmptyHint>}

        <FilterTabs value={filter} onChange={setFilter} />

        {filtered.map((doc) => (
          <DocTreeNode
            key={doc.id}
            doc={doc}
            activeDocId={activeDocId}
            activePageId={activePageId}
            onOpen={openDoc}
          />
        ))}
        {filtered.length === 0 && (
          <EmptyHint>{filter === 'mine' ? 'No docs yet' : 'Nothing shared with you'}</EmptyHint>
        )}
      </nav>
    </aside>
  );
}

function FilterTabs({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const tab = (id: Filter, label: string) => {
    const active = value === id;
    return (
      <button
        type="button"
        onClick={() => onChange(id)}
        style={{
          flex: 1,
          height: 28,
          border: 'none',
          borderRadius: 6,
          background: active ? ACTIVE : 'transparent',
          color: active ? TEXT : MUTED,
          fontSize: 12,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 4, margin: '14px 0 6px', padding: '0 4px' }}>
      {tab('mine', 'Created by me')}
      {tab('shared', 'Shared')}
    </div>
  );
}

function DocTreeNode({
  doc,
  activeDocId,
  activePageId,
  onOpen,
}: {
  doc: Doc;
  activeDocId: string | null;
  activePageId: string | null;
  onOpen: (docId: string, pageId?: string) => void;
}) {
  const isActive = doc.id === activeDocId;
  const [open, setOpen] = useState(isActive);
  const expandable = doc.pages.length > 1;
  const expanded = open || isActive;
  const menu = useDocNodeMenu(doc, onOpen);

  return (
    <div>
      <DocRow
        doc={doc}
        active={isActive && !activePageId}
        expandable={expandable}
        expanded={expanded}
        onToggle={() => setOpen((v) => !v)}
        onOpen={() => onOpen(doc.id)}
        onContextMenu={menu.onContextMenu}
      />
      {expanded &&
        expandable &&
        doc.pages.map((page) => (
          <PageRow
            key={page.id}
            label={page.name}
            active={isActive && page.id === activePageId}
            onOpen={() => onOpen(doc.id, page.id)}
          />
        ))}
      {menu.node}
    </div>
  );
}

function DocRow({
  doc,
  active,
  expandable = false,
  expanded = false,
  onToggle,
  onOpen,
  onContextMenu,
}: {
  doc: Doc;
  active: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 30,
        padding: '0 6px',
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? ACTIVE : hover ? HOVER : 'transparent',
        color: active ? TEXT : SECONDARY,
      }}
    >
      <span
        aria-hidden
        onClick={(e) => {
          if (!expandable || !onToggle) return;
          e.stopPropagation();
          onToggle();
        }}
        style={{
          width: 16,
          display: 'inline-flex',
          justifyContent: 'center',
          visibility: expandable ? 'visible' : 'hidden',
          color: MUTED,
        }}
      >
        <Chevron open={expanded} />
      </span>
      <span style={{ width: 16, textAlign: 'center', fontSize: 13, flexShrink: 0 }}>
        {doc.emoji ?? <DocGlyphIcon size={15} />}
      </span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          fontWeight: active ? 600 : 500,
        }}
      >
        {doc.name}
      </span>
      {doc.favorite && (
        <span style={{ color: 'rgb(245,184,40)', fontSize: 11, flexShrink: 0 }}>★</span>
      )}
    </div>
  );
}

function PageRow({
  label,
  active,
  onOpen,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 28,
        padding: '0 6px 0 30px',
        borderRadius: 6,
        cursor: 'pointer',
        background: active ? ACTIVE : hover ? HOVER : 'transparent',
        color: active ? TEXT : MUTED,
      }}
    >
      <span style={{ width: 14, textAlign: 'center', fontSize: 11 }}>▤</span>
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '5px 8px', color: MUTED, fontSize: 12 }}>{children}</div>;
}

interface MenuState {
  x: number;
  y: number;
}

/** Lightweight right-click menu for a sidebar doc row, wired to the store. */
function useDocNodeMenu(doc: Doc, onOpen: (docId: string, pageId?: string) => void) {
  const [pos, setPos] = useState<MenuState | null>(null);
  const renameDoc = useDocsStore((s) => s.renameDoc);
  const duplicateDoc = useDocsStore((s) => s.duplicateDoc);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const toggleFavorite = useDocsStore((s) => s.toggleFavorite);

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
  };
  const close = () => setPos(null);

  const rename = () => {
    const next = window.prompt('Rename doc', doc.name);
    if (next && next.trim()) renameDoc(doc.id, next.trim());
    close();
  };
  const duplicate = () => {
    const id = duplicateDoc(doc.id);
    close();
    if (id) onOpen(id);
  };
  const remove = () => {
    if (window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) deleteDoc(doc.id);
    close();
  };
  const favorite = () => {
    toggleFavorite(doc.id);
    close();
  };

  const node = pos ? (
    <ContextMenu
      pos={pos}
      onClose={close}
      items={[
        { label: 'Open', onSelect: () => { onOpen(doc.id); close(); } },
        { label: 'Rename', onSelect: rename },
        { label: 'Duplicate', onSelect: duplicate },
        { label: doc.favorite ? 'Remove from Favorites' : 'Add to Favorites', onSelect: favorite },
        { label: 'Delete', onSelect: remove, danger: true },
      ]}
    />
  ) : null;

  return { onContextMenu, node };
}

interface MenuItemDef {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

function ContextMenu({
  pos,
  onClose,
  items,
}: {
  pos: MenuState;
  onClose: () => void;
  items: MenuItemDef[];
}) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const left = Math.min(pos.x, vw - 200);
  return (
    <>
      <div
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
      />
      <div
        role="menu"
        style={{
          position: 'fixed',
          zIndex: 9999,
          left,
          top: pos.y + 4,
          width: 188,
          background: 'var(--cu-bg-menu, #fff)',
          border: '1px solid var(--cu-border-divider, rgb(232,232,232))',
          borderRadius: 8,
          boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))',
          padding: '6px 0',
        }}
      >
        {items.map((item) => (
          <MenuButton key={item.label} item={item} />
        ))}
      </div>
    </>
  );
}

function MenuButton({ item }: { item: MenuItemDef }) {
  const [hover, setHover] = useState(false);
  const color = item.danger ? 'rgb(226,67,41)' : TEXT;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={item.onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '7px 14px',
        border: 'none',
        background: hover ? HOVER : 'transparent',
        color,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {item.label}
    </button>
  );
}
