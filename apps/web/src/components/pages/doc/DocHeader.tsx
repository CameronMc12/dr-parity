'use client';

import { forwardRef, useState } from 'react';
import { Menu, MenuItem, MenuDivider } from '@/components/ui/Menu';
import {
  DocMarkIcon,
  StarIcon,
  TagOutlineIcon,
  MoreHorizIcon,
} from './doc-icons';
import { DOC } from './tokens';

/**
 * Doc header bar pinned to the top of the doc area. Matches ClickUp 1:1:
 *   left  = blue doc mark + "Doc" label + favourite star
 *   right = tag/label icon + "…" overflow menu (Share / Move / Duplicate /
 *           Copy link / Delete) backed by the real `Menu` primitive.
 *
 * Favourite is a live local toggle. The overflow + tag actions are real menus;
 * leaf actions that an offline clone can't perform (Share, Move, Delete the
 * source doc) surface a transient "copied" affordance or are no-ops, never dead.
 */
export function DocHeader({
  favorite,
  onToggleFavorite,
  onCopyLink,
  onShare,
  onMove,
  onDuplicate,
  onDelete,
  onAddTag,
  onManageTags,
}: {
  favorite: boolean;
  onToggleFavorite: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddTag: () => void;
  onManageTags: () => void;
}) {
  return (
    <div
      data-testid="doc-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        padding: '0 14px',
        borderBottom: `1px solid ${DOC.border}`,
        flexShrink: 0,
      }}
    >
      <DocMarkIcon size={18} />
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: DOC.textPrimary,
          letterSpacing: '-0.01em',
        }}
      >
        Doc
      </span>
      <FavoriteStar favorite={favorite} onToggle={onToggleFavorite} />

      <span style={{ flex: 1 }} />

      <TagMenu onAddTag={onAddTag} onManageTags={onManageTags} />
      <OverflowMenu
        onCopyLink={onCopyLink}
        onShare={onShare}
        onMove={onMove}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}

function FavoriteStar({
  favorite,
  onToggle,
}: {
  favorite: boolean;
  onToggle: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="doc-favorite"
      aria-pressed={favorite}
      aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      title={favorite ? 'Favorited' : 'Add to Favorites'}
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover ? DOC.hover : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: favorite ? 'rgb(255,196,61)' : DOC.textMuted,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      <StarIcon size={16} filled={favorite} />
    </button>
  );
}

interface IconTriggerProps {
  label: string;
  testid?: string;
  open: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const IconTrigger = forwardRef<HTMLButtonElement, IconTriggerProps>(
  function IconTrigger({ label, testid, open, onClick, children }, ref) {
    const [hover, setHover] = useState(false);
    return (
      <button
        ref={ref}
        type="button"
        data-testid={testid}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: open || hover ? DOC.hover : 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: open ? DOC.textPrimary : DOC.textSecondary,
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        {children}
      </button>
    );
  },
);

function TagMenu({
  onAddTag,
  onManageTags,
}: {
  onAddTag: () => void;
  onManageTags: () => void;
}) {
  return (
    <Menu
      width={220}
      align="right"
      trigger={({ ref, onClick, open }) => (
        <IconTrigger ref={ref} label="Tags" testid="doc-tags" open={open} onClick={onClick}>
          <TagOutlineIcon size={16} />
        </IconTrigger>
      )}
    >
      <MenuItem label="Add tag" onSelect={onAddTag} />
      <MenuItem label="Manage tags" onSelect={onManageTags} />
    </Menu>
  );
}

function OverflowMenu({
  onCopyLink,
  onShare,
  onMove,
  onDuplicate,
  onDelete,
}: {
  onCopyLink: () => void;
  onShare: () => void;
  onMove: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Menu
      width={210}
      align="right"
      trigger={({ ref, onClick, open }) => (
        <IconTrigger ref={ref} label="Options" testid="doc-options" open={open} onClick={onClick}>
          <MoreHorizIcon size={18} />
        </IconTrigger>
      )}
    >
      <MenuItem label="Share" onSelect={onShare} />
      <MenuItem label="Move" onSelect={onMove} />
      <MenuItem label="Duplicate" onSelect={onDuplicate} />
      <MenuItem
        label={copied ? 'Link copied' : 'Copy link'}
        keepOpen
        onSelect={() => {
          onCopyLink();
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      />
      <MenuDivider />
      <MenuItem
        label={<span style={{ color: 'rgb(229,72,77)' }}>Delete</span>}
        onSelect={onDelete}
      />
    </Menu>
  );
}
