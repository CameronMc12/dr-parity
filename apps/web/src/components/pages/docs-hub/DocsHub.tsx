'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageSurface } from '../page-primitives';
import { DocsHubToolbar } from './DocsHubToolbar';
import { DocsTemplatesRow } from './DocsTemplatesRow';
import { DocsControlsBar } from './DocsControlsBar';
import { DocsTable } from './DocsTable';
import { useDocRowContextMenu } from './DocRowContextMenu';
import { docToRow, type DocHubRow } from './docs-hub-data';
import { useDocsHubStore } from '@/store/docs-hub-store';
import { useCurrentMemberId } from '@/store/workspace/hooks';
import {
  useDocs,
  useDocsHydration,
  useDocsStore,
  docUpdatedAt,
  type Doc,
} from '@/store/workspace/docs.slice';

const SECTION_TITLES: Record<string, string> = {
  all: 'All Docs',
  mine: 'My Docs',
  shared: 'Shared with me',
  private: 'Private',
  meeting: 'Meeting Notes',
  archived: 'Archived',
};

/**
 * Predicate for each rail collection. The clone has a single local member, so
 * "My Docs" / "Private" are the docs this member authored or created, "Shared"
 * is the (empty) set authored by others, and the rest mirror ClickUp filters.
 */
function matchesSection(doc: Doc, section: string, memberId: string): boolean {
  switch (section) {
    case 'all':
      return true;
    case 'mine':
    case 'private':
      return doc.authorId === null || doc.authorId === memberId;
    case 'shared':
      return doc.authorId !== null && doc.authorId !== memberId;
    case 'meeting':
      return /meeting|notes|standup/i.test(doc.name);
    case 'archived':
      return false;
    default:
      return true;
  }
}

/**
 * Docs hub content (the All Docs table surface). The left rail (collections)
 * lives in the global sidebar via DocsSidebar; this renders the header (Import /
 * New Doc), templates row, controls bar, and the docs table backed by the live
 * docs store. Rows open the single-doc DocView; right-click opens the context
 * menu (Open / Rename / Duplicate / Favorite / Delete) wired to the store. The
 * New Doc / template CTAs create a doc and navigate to it.
 */
export function DocsHub({ wsId }: { wsId: string }) {
  useDocsHydration();
  const router = useRouter();
  const docs = useDocs();
  const memberId = useCurrentMemberId();
  const activeSection = useDocsHubStore((s) => s.activeSection);

  const createDoc = useDocsStore((s) => s.createDoc);
  const renameDoc = useDocsStore((s) => s.renameDoc);
  const duplicateDoc = useDocsStore((s) => s.duplicateDoc);
  const deleteDoc = useDocsStore((s) => s.deleteDoc);
  const toggleFavorite = useDocsStore((s) => s.toggleFavorite);

  const openDocId = (id: string) => router.push(`/${wsId}/v/dc/${id}`);
  const openDoc = (doc: DocHubRow) => openDocId(doc.id);

  const handleCreate = () => openDocId(createDoc());
  const handleTemplate = (name: string) => openDocId(createDoc({ name }));

  const handleRename = (id: string) => {
    const doc = docs.find((d) => d.id === id);
    const next = window.prompt('Rename doc', doc?.name ?? '');
    if (next && next.trim()) renameDoc(id, next.trim());
  };
  const handleDuplicate = (id: string) => {
    const newId = duplicateDoc(id);
    if (newId) openDocId(newId);
  };

  const { onContextMenu, menu } = useDocRowContextMenu({
    onOpen: openDoc,
    onRename: handleRename,
    onDuplicate: handleDuplicate,
    onToggleFavorite: toggleFavorite,
    onDelete: deleteDoc,
  });

  const rows = useMemo(() => {
    const filtered =
      activeSection === 'mine' || activeSection === 'shared' || activeSection === 'meeting'
        ? docs.filter((d) => matchesSection(d, activeSection, memberId))
        : activeSection === 'archived'
          ? []
          : docs;
    return filtered
      .slice()
      .sort((a, b) => docUpdatedAt(b) - docUpdatedAt(a))
      .map(docToRow);
  }, [docs, activeSection, memberId]);

  return (
    <PageSurface>
      <DocsHubToolbar
        title={SECTION_TITLES[activeSection] ?? 'All Docs'}
        onNewDoc={handleCreate}
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <DocsTemplatesRow onUseTemplate={() => handleTemplate('Untitled')} />
        <DocsControlsBar />
        {rows.length > 0 ? (
          <DocsTable rows={rows} onOpen={openDoc} onContextMenu={onContextMenu} />
        ) : (
          <EmptyState section={activeSection} onCreate={handleCreate} />
        )}
      </div>
      {menu}
    </PageSurface>
  );
}

function EmptyState({ section, onCreate }: { section: string; onCreate: () => void }) {
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        color: 'var(--cu-text-muted, rgb(130,130,130))',
        fontSize: 14,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        No docs in {SECTION_TITLES[section] ?? 'this view'} yet.
      </div>
      {section !== 'archived' && (
        <button
          type="button"
          onClick={onCreate}
          style={{
            height: 32,
            padding: '0 14px',
            border: 'none',
            borderRadius: 6,
            background: 'var(--cu-accent, rgb(123,97,255))',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Create Doc
        </button>
      )}
    </div>
  );
}
