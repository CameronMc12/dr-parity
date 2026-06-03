'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import { useViewsStore } from '@/store/views';
import { Cu3Icon, SpacesTree } from './SpacesTree';

const WORKSPACE_ID = '90152566819';

const TEXT = 'var(--cu-text-primary)';
const SOFT = 'var(--cu-text-muted)';

function MiniIcon({ type }: { type: 'search' | 'folder' | 'list' }) {
  if (type === 'search') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="2" />
        <path d="m15 15 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'folder') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 7.5h6l1.8 2h9.2v7.7a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3V7.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.5h12M6 12h12M6 19.5h12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function HeaderButton({ children, label, onClick }: { children: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: SOFT,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function SpacesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const createSpace = useWorkspaceStore((s) => s.createSpace);
  const ws = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  // Active list id from `/v/l/<listId>` (raw listId in URL), mirroring HomeSidebar.
  const listMatch = pathname.match(/\/v\/l\/([^/]+)/);
  const activeListId = listMatch?.[1] ?? null;

  // Navigate to a list's FIRST templated view (registry-driven), mirroring
  // HomeSidebar.openList exactly. Default first view is List → /v/l/<listId>.
  const openList = (listId: string) => {
    const first = useViewsStore.getState().getListViews(listId)[0];
    const code = first?.code ?? 'l';
    const segId = first?.id ?? listId;
    router.push(`/${ws}/v/${code}/${segId}`);
  };
  const openSpace = (spaceId: string) => router.push(`/${ws}/space/${spaceId}`);
  const openFolder = (folderId: string) => router.push(`/${ws}/folder/${folderId}`);

  const addSpace = () => {
    const name = window.prompt('Space name')?.trim();
    if (name) createSpace(name);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Spaces</span>
        <HeaderButton label="Search spaces">
          <MiniIcon type="search" />
        </HeaderButton>
        <HeaderButton label="Create space" onClick={addSpace}>
          <Cu3Icon id="cu3-icon-addSmall" size={14} />
        </HeaderButton>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 4px 12px' }}>
        <SpacesTree
          activeListId={activeListId}
          onOpen={openList}
          onOpenSpace={openSpace}
          onOpenFolder={openFolder}
        />
      </nav>
    </div>
  );
}
