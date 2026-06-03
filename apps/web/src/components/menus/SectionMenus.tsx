'use client';

import { useState } from 'react';
import { MenuDivider, MenuItem, MenuToggle } from '@/components/ui/Menu';
import {
  AddIcon,
  AddToListIcon,
  ArchiveIcon,
  BrowseIcon,
  CheckAllIcon,
  LimitIcon,
  ManageSpacesIcon,
  PinIcon,
  ShowIcon,
  ShuffleIcon,
  SortIcon,
} from './menu-icons';

/**
 * Section header menus — oracles:
 *   menu-favorites-plus, menu-channels-plus, menu-direct-messages-plus,
 *   menu-spaces-plus, menu-add-channel.
 *
 * Submenus ("Show and sort", "Limit") render a basic nested flyout — the live
 * DOM only exposed the CDK trigger, so submenu contents are reconstructed from
 * standard ClickUp options (noted in the return summary).
 */

function ShowAndSortSubmenu() {
  return (
    <>
      <MenuItem label="Sort manually" />
      <MenuItem label="Sort alphabetically" />
      <MenuItem label="Sort by recent" />
      <MenuDivider />
      <MenuItem label="Show unread only" />
    </>
  );
}

function LimitSubmenu({ current }: { current: number }) {
  const options = [10, 20, 40, 60, 100];
  return (
    <>
      {options.map((n) => (
        <MenuItem key={n} label={String(n)} postscript={n === current ? '✓' : undefined} />
      ))}
    </>
  );
}

export function FavoritesMenu() {
  return (
    <>
      <MenuItem icon={<CheckAllIcon />} label="Mark all as read" />
      <MenuItem icon={<AddToListIcon />} label="Add to Favorites" />
      <MenuDivider />
      <MenuItem icon={<PinIcon />} label="Pin items to Top" />
      <MenuDivider />
      <MenuItem icon={<SortIcon />} label="Show and sort" submenu={<ShowAndSortSubmenu />} />
      <MenuDivider />
      <MenuItem icon={<AddIcon />} label="Create section" />
      <MenuItem icon={<ShuffleIcon />} label="Reorder sections" />
    </>
  );
}

export function ChannelsMenu() {
  return (
    <>
      <MenuItem icon={<BrowseIcon />} label="Browse Channels" />
      <MenuItem icon={<CheckAllIcon />} label="Mark all as read" />
      <MenuDivider />
      <MenuItem icon={<SortIcon />} label="Show and sort" submenu={<ShowAndSortSubmenu />} />
      <MenuItem
        icon={<LimitIcon />}
        label="Limit"
        postscript="60"
        submenu={<LimitSubmenu current={60} />}
      />
      <MenuDivider />
      <MenuItem icon={<AddIcon />} label="Create section" />
      <MenuItem icon={<ShuffleIcon />} label="Reorder sections" />
    </>
  );
}

export function DirectMessagesMenu() {
  return (
    <>
      <MenuItem icon={<BrowseIcon />} label="Browse people" />
      <MenuItem icon={<CheckAllIcon />} label="Mark all as read" />
      <MenuDivider />
      <MenuItem icon={<SortIcon />} label="Show and sort" submenu={<ShowAndSortSubmenu />} />
      <MenuItem
        icon={<LimitIcon />}
        label="Limit"
        postscript="20"
        submenu={<LimitSubmenu current={20} />}
      />
      <MenuDivider />
      <MenuItem icon={<AddIcon />} label="Create section" />
      <MenuItem icon={<ShuffleIcon />} label="Reorder sections" />
    </>
  );
}

export function SpacesMenu() {
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  return (
    <>
      <MenuItem icon={<AddIcon />} label="Create Space" />
      <MenuItem icon={<ManageSpacesIcon />} label="Manage Spaces" />
      <MenuDivider />
      <MenuToggle icon={<ShowIcon />} label="Show all Spaces" checked={showAll} onChange={setShowAll} />
      <MenuToggle icon={<ArchiveIcon />} label="Show archived" checked={showArchived} onChange={setShowArchived} />
      <MenuDivider />
      <MenuItem icon={<ShuffleIcon />} label="Reorder sections" />
    </>
  );
}
