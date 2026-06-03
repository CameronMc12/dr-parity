'use client';

import { MenuDivider, MenuItem } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import { useIsFavorite } from '@/store/workspace/hooks';
import { ArchiveIcon, PinIcon, ShuffleIcon } from './menu-icons';

/**
 * Row context (kebab ⋯) menus for sidebar rows. Items follow the documented
 * ClickUp row-menu set from FEATURE_MAP §4. The store-backed actions are wired:
 *   - Add to / Remove from Favorites → toggleFavorite (reflects favorited state)
 *   - Rename → onRename callback (inline rename in the sidebar)
 *   - Delete / Archive → deleteNode
 * Items without a clean store mapping (Copy link, Duplicate, Color & icon,
 * Move, Pin, Sharing) stay as no-op closers.
 */

const ICON_SIZE = 16;

function I({ d, fill }: { d: string; fill?: boolean }) {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

const RenameIcon = () => <I d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.2 7.3l3.5 3.5" />;
const CopyLinkIcon = () => <I d="M9.5 14.5l5-5M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2" />;
const DuplicateIcon = () => <I d="M8.5 8.5h9v9h-9zM6.5 15.5h-1v-9h9v1" />;
const FavoriteIcon = () => <I d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.4 7.4 18.8l.9-5.1L4.5 10l5.2-.8L12 4.5z" />;
const ColorIcon = () => <I d="M12 3a9 9 0 1 0 0 18c1.7 0 2-1.3 1.2-2.2-.7-.9-.4-2.3 1-2.3H17a4 4 0 0 0 4-4c0-4.9-4-7.5-9-7.5z" />;
const MoveIcon = () => <I d="M12 4v16M12 4l-3 3M12 4l3 3M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3M12 20l-3-3M12 20l3-3" />;
const DeleteIcon = () => <I d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7" />;

export type RowKind = 'task' | 'list' | 'channel' | 'space';

export interface RowContextMenuProps {
  kind: RowKind;
  /** Tree node id (space / folder / list) — used for favorite/rename/delete. */
  nodeId?: string;
  /** Begin inline rename of the row (owned by the sidebar). */
  onRename?: () => void;
  /** Create a child list under this space/folder row (owned by the sidebar). */
  onNewList?: () => void;
}

/**
 * Renders the context-menu body for a given row kind. Store-backed leaves call
 * their action and close; the rest are visual stubs that simply close.
 */
export function RowContextMenu({ kind, nodeId, onRename, onNewList }: RowContextMenuProps) {
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const deleteNode = useWorkspaceStore((s) => s.deleteNode);
  const deleteChannel = useWorkspaceStore((s) => s.deleteChannel);
  const isFavorite = useIsFavorite(nodeId ?? '');

  const canMutate = Boolean(nodeId);
  // Channels live in a flat list, not the tree — route their delete accordingly.
  const removeRow = kind === 'channel' ? deleteChannel : deleteNode;

  return (
    <>
      <MenuItem icon={<RenameIcon />} label="Rename" onSelect={onRename} />
      {onNewList && <MenuItem icon={<DuplicateIcon />} label="New list" onSelect={onNewList} />}
      <MenuItem icon={<CopyLinkIcon />} label="Copy link" />
      <MenuItem icon={<DuplicateIcon />} label="Duplicate" />
      <MenuDivider />
      <MenuItem
        icon={<FavoriteIcon />}
        label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        onSelect={canMutate ? () => toggleFavorite(nodeId!) : undefined}
      />
      {kind !== 'channel' && <MenuItem icon={<ColorIcon />} label="Color & icon" />}
      <MenuItem icon={<MoveIcon />} label="Move" />
      <MenuItem icon={<PinIcon />} label="Pin to top" />
      <MenuDivider />
      {(kind === 'space' || kind === 'list') && (
        <MenuItem icon={<ShuffleIcon />} label="Sharing & Permissions" />
      )}
      {kind !== 'channel' && (
        <MenuItem
          icon={<ArchiveIcon />}
          label="Archive"
          onSelect={canMutate ? () => deleteNode(nodeId!) : undefined}
        />
      )}
      <MenuItem
        icon={<DeleteIcon />}
        label={<span style={{ color: 'rgb(226, 67, 41)' }}>Delete</span>}
        onSelect={canMutate ? () => removeRow(nodeId!) : undefined}
      />
    </>
  );
}
