'use client';

import { useState } from 'react';
import {
  MenuButtonRow,
  MenuDivider,
  MenuHeading,
  MenuItem,
  MenuOutlineButton,
} from '@/components/ui/Menu';
import { useUiStore } from '@/store/ui-store';
import {
  AgentIcon,
  AiSparkleIcon,
  ChannelIcon,
  CustomizeSidebarIcon,
  DashboardIcon,
  DocIcon,
  FormIcon,
  ImportIcon,
  ListIcon,
  MessageIcon,
  SpaceIcon,
  TaskIcon,
  TemplatesIcon,
  WhiteboardIcon,
} from './menu-icons';

/**
 * Create menu — oracle `home-header-plus`.
 * Anchored to the Home header `+` / `▾`. Search input on top, then the exact
 * 14-item create list grouped by dividers, then an Import / Templates row.
 */
export function CreateMenu() {
  const [query, setQuery] = useState('');
  const openCreateTask = useUiStore((s) => s.openCreateTask);

  return (
    <>
      {/* Search */}
      <div style={{ padding: '2px 10px 8px' }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe anything to create"
          aria-label="Describe anything to create"
          style={{
            width: '100%',
            height: 32,
            boxSizing: 'border-box',
            padding: '0 10px',
            fontSize: 13,
            color: 'var(--cu-text-primary, rgb(32,32,32))',
            background: 'var(--cu-bg-input, #fff)',
            border: '1px solid var(--cu-border-strong, rgb(180,180,180))',
            borderRadius: 6,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      <MenuHeading>Create</MenuHeading>
      <MenuItem
        icon={<TaskIcon />}
        label="Task"
        postscript="⌥ T"
        active
        onSelect={() => openCreateTask()}
      />
      <MenuItem icon={<MessageIcon />} label="Message" postscript="⌘ G" />

      <MenuDivider />
      <MenuItem icon={<ListIcon />} label="List" description="Track tasks, projects, people & more" />
      <MenuItem icon={<ChannelIcon />} label="Channel" description="Conversations on specific topics" />
      <MenuItem icon={<SpaceIcon />} label="Space" description="Organize work by team or department" />

      <MenuDivider />
      <MenuItem icon={<AiSparkleIcon />} label="Create with AI" />
      <MenuItem icon={<AgentIcon />} label="Super Agent" trailing={<HotTag />} />

      <MenuDivider />
      <MenuItem icon={<DocIcon />} label="Doc" />
      <MenuItem icon={<FormIcon />} label="Form" />
      <MenuItem icon={<DashboardIcon />} label="Dashboard" />
      <MenuItem icon={<WhiteboardIcon />} label="Whiteboard" />

      <MenuDivider />
      <MenuItem icon={<CustomizeSidebarIcon />} label="Customize your sidebar" />

      <MenuDivider />
      <MenuButtonRow>
        <MenuOutlineButton icon={<ImportIcon size={15} />} label="Import" />
        <MenuOutlineButton icon={<TemplatesIcon size={15} />} label="Templates" />
      </MenuButtonRow>
    </>
  );
}

function HotTag() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        lineHeight: '14px',
        padding: '0 6px',
        borderRadius: 4,
        color: 'rgb(229,57,53)',
        background: 'rgba(229,57,53,0.12)',
        flexShrink: 0,
      }}
    >
      Hot
    </span>
  );
}
