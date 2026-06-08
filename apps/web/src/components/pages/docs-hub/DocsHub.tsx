'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageSurface } from '../page-primitives';
import { DocsHubToolbar } from './DocsHubToolbar';
import { DocsTemplatesRow } from './DocsTemplatesRow';
import { DocsControlsBar } from './DocsControlsBar';
import { DocsTable } from './DocsTable';
import { useDocRowContextMenu } from './DocRowContextMenu';
import { DOC_HUB_ROWS, type DocHubRow } from './docs-hub-data';
import { useDocsHubStore } from '@/store/docs-hub-store';

const SECTION_TITLES: Record<string, string> = {
  all: 'All Docs',
  mine: 'My Docs',
  shared: 'Shared with me',
  private: 'Private',
  meeting: 'Meeting Notes',
  archived: 'Archived',
};

/**
 * Docs hub content (the All Docs table surface). Oracle:
 *   docs/research/crawl/app.clickup.com/deep-docs/states/state-0001
 * The left rail (collections) lives in the global sidebar via DocsSidebar; this
 * renders the header (Import / New Doc), templates row, Filters/Sort/Tags bar,
 * and the docs table of the real seeded docs. Rows open the single-doc DocView;
 * right-click opens the doc context menu. Only "All Docs" is populated.
 */
export function DocsHub({ wsId }: { wsId: string }) {
  const router = useRouter();
  const activeSection = useDocsHubStore((s) => s.activeSection);
  const removedIds = useDocsHubStore((s) => s.removedIds);
  const removeDoc = useDocsHubStore((s) => s.removeDoc);

  const openDoc = (doc: DocHubRow) => {
    router.push(`/${wsId}/v/dc/${doc.id}`);
  };

  const { onContextMenu, menu } = useDocRowContextMenu(openDoc, removeDoc);

  const rows = useMemo(
    () =>
      activeSection === 'all'
        ? DOC_HUB_ROWS.filter((d) => !removedIds.includes(d.id))
        : [],
    [activeSection, removedIds],
  );

  return (
    <PageSurface>
      <DocsHubToolbar title={SECTION_TITLES[activeSection] ?? 'All Docs'} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <DocsTemplatesRow />
        <DocsControlsBar />
        {rows.length > 0 ? (
          <DocsTable rows={rows} onOpen={openDoc} onContextMenu={onContextMenu} />
        ) : (
          <div
            style={{
              padding: '64px 24px',
              textAlign: 'center',
              color: 'var(--cu-text-muted, rgb(130,130,130))',
              fontSize: 14,
            }}
          >
            No docs here yet.
          </div>
        )}
      </div>
      {menu}
    </PageSurface>
  );
}
