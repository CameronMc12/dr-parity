'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useViewsStore } from '@/store/views';
import { SpacesTree } from './SpacesTree';
import { SidebarHeader } from './SidebarHeader';

const WORKSPACE_ID = '90152566819';

export function SpacesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const ws = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;

  const [hovered, setHovered] = useState(false);
  const [filter, setFilter] = useState('');

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

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <SidebarHeader title="Spaces" hovered={hovered} onFilterChange={setFilter} />

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 4px 12px' }}>
        <SpacesTree
          activeListId={activeListId}
          onOpen={openList}
          onOpenSpace={openSpace}
          onOpenFolder={openFolder}
          filter={filter}
        />
      </nav>
    </div>
  );
}
