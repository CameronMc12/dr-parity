'use client';

import {
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MenuCloseContext, MenuDivider, MenuItem } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import { useIsFavorite } from '@/store/workspace/hooks';
import { ArchiveIcon, PinIcon, ShuffleIcon } from './menu-icons';

/**
 * Row context (kebab ⋯) menus for sidebar rows. Items follow the documented
 * ClickUp row-menu set from FEATURE_MAP §4. The store-backed actions are wired:
 *   - Add to / Remove from Favorites → toggleFavorite (reflects favorited state)
 *   - Rename → onRename callback (inline rename in the sidebar)
 *   - Delete / Archive → deleteNode
 * Items without a clean store mapping stay as no-op closers.
 *
 * The SPACE kind renders the full Figma Space actions menu (267px dark popover,
 * five grouped sections + a filled "Sharing & Permissions" footer button). It is
 * a self-contained dark surface that overrides the shared Menu chrome via the
 * trigger's `surfaceStyle`; the non-space kinds keep the generic MenuItem rows.
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

// ── Space-menu glyphs (24×24 stroke icons, sprite lacks these) ──────────────
const PlusIcon = () => <I d="M12 5v14M5 12h14" />;
const BoltIcon = () => <I d="M13 3L5 13h5l-1 8 8-10h-5l1-8z" />;
const AppsGridIcon = () => <I d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z" />;
const FieldsIcon = () => <I d="M5 5h14v14H5zM9 9l2 2 4-4" />;
const StatusIcon = () => <I d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />;
const MoreIcon = () => <I d="M6 12h.01M12 12h.01M18 12h.01" />;
const ImportArrowIcon = () => <I d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14M9 12h11m0 0l-3-3m3 3l-3 3" />;
const TemplateIcon = () => <I d="M4.5 6h15M4.5 11h15M4.5 16h9" />;
const EyeOffIcon = () => <I d="M4 4l16 16M9.5 5.5A8.5 8.5 0 0 1 21 12a13 13 0 0 1-2.2 2.9M6.5 6.7A13 13 0 0 0 3 12a8.5 8.5 0 0 0 11.4 5M9.5 9.7a3 3 0 0 0 4 4" />;

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

  if (kind === 'space') {
    return <SpaceMenu nodeId={nodeId} onRename={onRename} />;
  }

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
      {kind === 'list' && <MenuItem icon={<ShuffleIcon />} label="Sharing & Permissions" />}
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

// ── Space actions menu (Figma 1:1) ──────────────────────────────────────────

/** Figma palette for the Space actions popover. */
const SP = {
  surface: '#191919',
  border: '#2a2a2a',
  divider: '#2a2a2a',
  icon: '#b4b4b4',
  label: '#eeeeee',
  desc: '#7b7b7b',
  chevron: '#7b7b7b',
  hover: 'rgba(255,255,255,0.06)',
  footerBg: '#eeeeee',
  footerText: '#000000df',
} as const;

const ROW_WIDTH = 251;

/**
 * Overrides applied to the shared Menu popover when the kebab opens the space
 * menu, so the surface matches the Figma spec (267px, #191919, #2a2a2a border,
 * 8px padding). SpacesTree passes this via the Menu `surfaceStyle` prop only for
 * space rows; the kebab width is set to 267 there as well.
 */
export const SPACE_MENU_SURFACE: CSSProperties = {
  background: SP.surface,
  border: `1px solid ${SP.border}`,
  borderRadius: 8,
  padding: 8,
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
};

export const SPACE_MENU_WIDTH = 267;

function SpaceMenu({ nodeId, onRename }: { nodeId?: string; onRename?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <SpaceGroup>
        <SpaceRowItem icon={<FavoriteIcon />} label="Favorite" hasSubmenu />
        <SpaceRowItem icon={<RenameIcon />} label="Rename" onSelect={onRename} />
        <SpaceRowItem icon={<CopyLinkIcon />} label="Copy link" />
      </SpaceGroup>

      <SpaceSeparator />

      <SpaceGroup>
        <SpaceRowItem icon={<PlusIcon />} label="Create new" hasSubmenu />
        <SpaceRowItem icon={<ColorIcon />} label="Color & Icon" hasSubmenu />
        <SpaceRowItem icon={<BoltIcon />} label="Automations" />
        <SpaceRowItem icon={<AppsGridIcon />} label="ClickApps" />
        <SpaceRowItem icon={<FieldsIcon />} label="Custom Fields" />
        <SpaceRowItem icon={<StatusIcon />} label="Task statuses" />
        <SpaceRowItem icon={<MoreIcon />} label="More" hasSubmenu />
      </SpaceGroup>

      <SpaceSeparator />

      <SpaceGroup>
        <SpaceRowItem icon={<ImportArrowIcon />} label="Imports" hasSubmenu />
        <SpaceRowItem icon={<TemplateIcon />} label="Templates" hasSubmenu />
      </SpaceGroup>

      <SpaceSeparator />

      <SpaceGroup>
        <HideSpaceRow />
      </SpaceGroup>

      <SpaceSeparator />

      <SpaceGroup>
        <SpaceRowItem icon={<DuplicateIcon />} label="Duplicate" />
        <SpaceRowItem icon={<ArchiveIcon />} label="Archive" />
        <SpaceRowItem icon={<DeleteIcon />} label="Delete" />
      </SpaceGroup>

      <div style={{ height: 8 }} />
      <SharingFooter />
    </div>
  );
}

function SpaceGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>;
}

function SpaceSeparator() {
  return (
    <div
      style={{
        height: 1,
        background: SP.divider,
        margin: '8px 0',
      }}
    />
  );
}

function SubmenuChevron() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke={SP.chevron}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpaceRowItem({
  icon,
  label,
  hasSubmenu,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  hasSubmenu?: boolean;
  onSelect?: () => void;
}) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);

  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
        if (!hasSubmenu) close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: ROW_WIDTH,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        background: hover ? SP.hover : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: SP.icon,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          fontWeight: 400,
          letterSpacing: '-0.15px',
          color: SP.label,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {hasSubmenu && (
        <span style={{ display: 'flex', flexShrink: 0 }}>
          <SubmenuChevron />
        </span>
      )}
    </button>
  );
}

function HideSpaceRow() {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: ROW_WIDTH,
        minHeight: 66,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px',
        borderRadius: 6,
        border: 'none',
        background: hover ? SP.hover : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: SP.icon,
          marginTop: 1,
        }}
      >
        <EyeOffIcon />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '-0.15px',
            color: SP.label,
          }}
        >
          Hide Space
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontSize: 12,
            lineHeight: '18px',
            color: SP.desc,
          }}
        >
          You&apos;ll retain access to this Space, but it won&apos;t show in your sidebar
        </span>
      </span>
    </button>
  );
}

function SharingFooter() {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: ROW_WIDTH,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: 'none',
        background: SP.footerBg,
        opacity: hover ? 0.92 : 1,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: 500,
        color: SP.footerText,
        boxSizing: 'border-box',
      }}
    >
      Sharing &amp; Permissions
    </button>
  );
}
