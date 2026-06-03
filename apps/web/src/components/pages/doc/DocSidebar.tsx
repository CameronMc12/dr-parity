'use client';

import { useEffect, useState } from 'react';
import { DOCS_TREE, type DocNode } from '@/data/docs-tree';
import { getDocPages, type DocPage } from '@/lib/view-data';
import { Chevron } from '@/components/pages/list-view-icons';
import { DOC } from './tokens';

/** A subpage minted in-session (via the starter / slash menu), not in the export. */
export interface ExtraPage {
  id: string;
  name: string;
  content: string;
}

/**
 * Doc/page tree sidebar. Lists every doc from the real export (`docs-tree.json`)
 * with its emoji avatar; the active doc auto-expands to reveal its pages (sourced
 * from `getDocPages`) plus any in-session subpages from `extraPages`. Selecting a
 * doc or page navigates via `onSelect`.
 */
export function DocSidebar({
  docId,
  pageId,
  extraPages,
  onSelect,
}: {
  docId: string;
  pageId?: string;
  extraPages?: Record<string, ExtraPage[]>;
  onSelect: (docId: string, pageId?: string) => void;
}) {
  return (
    <aside
      data-testid="doc-sidebar"
      style={{
        width: DOC.sidebarWidth,
        flexShrink: 0,
        height: '100%',
        overflowY: 'auto',
        borderRight: `1px solid ${DOC.border}`,
        background: DOC.sidebarBg,
        padding: '10px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 28,
          padding: '0 8px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: DOC.textMuted,
        }}
      >
        Docs
      </div>
      {DOCS_TREE.map((doc) => (
        <DocTreeRow
          key={doc.id}
          doc={doc}
          activeDocId={docId}
          activePageId={pageId}
          extraPages={extraPages?.[doc.id] ?? []}
          onSelect={onSelect}
        />
      ))}
    </aside>
  );
}

function DocTreeRow({
  doc,
  activeDocId,
  activePageId,
  extraPages,
  onSelect,
}: {
  doc: DocNode;
  activeDocId: string;
  activePageId?: string;
  extraPages: ExtraPage[];
  onSelect: (docId: string, pageId?: string) => void;
}) {
  const isActiveDoc = doc.id === activeDocId;
  const [open, setOpen] = useState(isActiveDoc);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (isActiveDoc) setOpen(true);
  }, [isActiveDoc]);

  const pages: DocPage[] = getDocPages(doc.id)?.pages ?? [];
  const totalChildren = pages.length + extraPages.length;
  const expandable = totalChildren > 1;
  const expanded = open || isActiveDoc;

  return (
    <div data-testid="doc-tree-doc" data-doc-id={doc.id}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          onSelect(doc.id);
          if (expandable) setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(doc.id);
          }
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={rowStyle(isActiveDoc && !activePageId, hover)}
      >
        <span
          aria-hidden
          onClick={(e) => {
            if (!expandable) return;
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          style={{
            width: 16,
            display: 'inline-flex',
            justifyContent: 'center',
            visibility: expandable ? 'visible' : 'hidden',
            color: DOC.textMuted,
          }}
        >
          <Chevron open={expanded} />
        </span>
        <span style={{ width: 18, textAlign: 'center', fontSize: 13 }}>
          {doc.emoji ?? '📄'}
        </span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            fontWeight: isActiveDoc ? 600 : 500,
          }}
        >
          {doc.name}
        </span>
      </div>

      {expanded && (
        <>
          {pages.map((page) => (
            <PageRow
              key={page.id}
              label={page.name}
              active={isActiveDoc && page.id === (activePageId ?? pages[0]?.id)}
              onSelect={() => onSelect(doc.id, page.id)}
            />
          ))}
          {extraPages.map((page) => (
            <PageRow
              key={page.id}
              label={page.name}
              active={isActiveDoc && page.id === activePageId}
              onSelect={() => onSelect(doc.id, page.id)}
            />
          ))}
        </>
      )}
    </div>
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
      style={{ ...rowStyle(active, hover), paddingLeft: 30 }}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 12, color: DOC.textMuted }}>
        ▤
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

function rowStyle(active: boolean, hover: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 8px',
    borderRadius: 6,
    cursor: 'pointer',
    color: active ? DOC.textPrimary : DOC.textSecondary,
    background: active ? DOC.active : hover ? DOC.hover : 'transparent',
    userSelect: 'none',
  };
}
