'use client';

/**
 * Per-doc page-tree rail (oracle: seed-view-doc). Unlike `DocSidebar` (which lists
 * every doc in the workspace), this pane is scoped to the OPEN doc: its title at
 * the top, a "Pages" section header, one row per page (source pages from
 * `getDocPages` plus any in-session subpages), the active page highlighted, and an
 * "Add page" affordance at the bottom. Clicking a row switches pages via
 * `onSelect`; "Add page" mints a fresh subpage via `onAddPage`.
 */

import { useState } from 'react';
import { DOCS_TREE } from '@/data/docs-tree';
import { getDocPages } from '@/lib/view-data';
import { PageStackIcon } from './doc-icons';
import type { ExtraPage } from './DocSidebar';
import { DOC } from './tokens';

export function DocPageTree({
  docId,
  pageId,
  extraPages,
  onSelect,
  onAddPage,
}: {
  docId: string;
  pageId?: string;
  extraPages: ExtraPage[];
  onSelect: (docId: string, pageId?: string) => void;
  onAddPage: () => void;
}) {
  const doc = getDocPages(docId);
  const node = DOCS_TREE.find((d) => d.id === docId);
  const pages = doc?.pages ?? [];
  const docName = doc?.name ?? node?.name ?? 'Untitled';
  // No explicit page id => the first page is the active landing page.
  const activeId = pageId ?? pages[0]?.id;

  return (
    <aside
      data-testid="doc-page-tree"
      style={{
        width: DOC.sidebarWidth,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        borderRight: `1px solid ${DOC.border}`,
        background: DOC.bg,
        padding: '14px 12px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 6px',
          marginBottom: 14,
          fontSize: 14,
          fontWeight: 600,
          color: DOC.textPrimary,
        }}
      >
        {node?.emoji && <span style={{ fontSize: 13 }}>{node.emoji}</span>}
        <span
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {docName}
        </span>
      </div>

      <div
        style={{
          padding: '0 6px',
          marginBottom: 6,
          fontSize: 12,
          fontWeight: 500,
          color: DOC.textMuted,
        }}
      >
        Pages
      </div>

      {pages.map((page) => (
        <PageRow
          key={page.id}
          label={page.name}
          active={page.id === activeId}
          onSelect={() => onSelect(docId, page.id)}
        />
      ))}
      {extraPages.map((page) => (
        <PageRow
          key={page.id}
          label={page.name}
          active={page.id === pageId}
          onSelect={() => onSelect(docId, page.id)}
        />
      ))}

      <AddPageRow onClick={onAddPage} />
    </aside>
  );
}

function PageRow({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="doc-tree-page"
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={rowStyle(active, hover)}
    >
      <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', color: DOC.textMuted }}>
        <PageStackIcon size={14} />
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
        {label}
      </span>
    </div>
  );
}

function AddPageRow({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="doc-tree-add-page"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...rowStyle(false, hover), color: DOC.textMuted, marginTop: 2 }}
    >
      <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', fontSize: 16, lineHeight: 1 }}>
        +
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>Add page</span>
    </div>
  );
}

function rowStyle(active: boolean, hover: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 6px',
    borderRadius: 6,
    cursor: 'pointer',
    color: active ? DOC.textPrimary : DOC.textSecondary,
    background: active ? DOC.active : hover ? DOC.hover : 'transparent',
    userSelect: 'none',
  };
}
