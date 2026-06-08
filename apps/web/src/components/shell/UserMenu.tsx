'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUiStore } from '@/store/ui-store';
import {
  SetStatusIcon,
  MuteIcon,
  ChevronRightIcon,
  SettingsIcon,
  BellIcon,
  PaletteIcon,
  KeyboardIcon,
  DownloadIcon,
  HelpIcon,
  ExternalLinkIcon,
  PinIcon,
  CreateTaskIcon,
  MyWorkIcon,
  TrackTimeIcon,
  NotepadIcon,
  RecordClipIcon,
  ReminderIcon,
  CreateDocIcon,
  CreateWhiteboardIcon,
  ViewPeopleIcon,
  CreateDashboardIcon,
  AiNotetakerIcon,
  TrashIcon,
  LogoutIcon,
} from '@/components/shell/user-menu-icons';

const DEFAULT_WS = 'home';

const MENU_WIDTH = 248;
const ROW_HEIGHT = 32;

function Row({
  icon,
  label,
  onClick,
  endChevron,
  endExternal,
  pin,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  endChevron?: boolean;
  endExternal?: boolean;
  pin?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: ROW_HEIGHT,
        paddingLeft: 12,
        paddingRight: 10,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--cu-text-secondary)',
        fontSize: 13,
        textAlign: 'left',
        borderRadius: 6,
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.background = 'var(--cu-bg-hover)';
        t.style.color = 'var(--cu-text-primary)';
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.background = 'transparent';
        t.style.color = 'var(--cu-text-secondary)';
      }}
    >
      <span style={{ color: 'var(--cu-text-muted)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      {endExternal && (
        <span style={{ color: 'var(--cu-text-muted)', display: 'flex' }}>
          <ExternalLinkIcon />
        </span>
      )}
      {endChevron && (
        <span style={{ color: 'var(--cu-text-muted)', display: 'flex' }}>
          <ChevronRightIcon />
        </span>
      )}
      {pin && (
        <span style={{ color: 'var(--cu-text-disabled)', display: 'flex' }}>
          <PinIcon />
        </span>
      )}
    </button>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--cu-border-divider)',
        margin: '6px 0',
      }}
    />
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 12px 4px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        color: 'var(--cu-text-muted)',
        textTransform: 'none',
      }}
    >
      {children}
    </div>
  );
}

export function UserMenu({ onClose }: { onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const wsId = pathname.split('/').filter(Boolean)[0] ?? DEFAULT_WS;

  const openSettings = useUiStore((s) => s.openSettings);
  const openCreateTask = useUiStore((s) => s.openCreateTask);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [onClose]);

  const go = (segment: string) => () => {
    router.push(`/${wsId}/${segment}`);
    onClose();
  };

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const personalTools: { icon: ReactNode; label: string; onClick?: () => void }[] = [
    { icon: <CreateTaskIcon />, label: 'Create task', onClick: act(() => openCreateTask()) },
    { icon: <MyWorkIcon />, label: 'My Work' },
    { icon: <TrackTimeIcon />, label: 'Track Time' },
    { icon: <NotepadIcon />, label: 'Notepad' },
    { icon: <RecordClipIcon />, label: 'Record a Clip' },
    { icon: <ReminderIcon />, label: 'Create Reminder' },
    { icon: <CreateDocIcon />, label: 'Create Doc', onClick: go('docs') },
    { icon: <CreateWhiteboardIcon />, label: 'Create Whiteboard', onClick: go('whiteboards') },
    { icon: <ViewPeopleIcon />, label: 'View People' },
    { icon: <CreateDashboardIcon />, label: 'Create Dashboard', onClick: go('dashboards') },
    { icon: <AiNotetakerIcon />, label: 'AI Notetaker' },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="User menu"
      style={{
        position: 'absolute',
        top: 38,
        right: 0,
        width: MENU_WIDTH,
        maxHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
        background: 'var(--cu-bg-app)',
        border: '1px solid var(--cu-border-divider)',
        borderRadius: 10,
        boxShadow: '0 12px 36px rgba(0,0,0,0.20)',
        padding: '6px 0',
        zIndex: 100,
      }}
    >
      {/* Header: avatar + name + online */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 10px' }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgb(0, 0, 0)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          CM
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--cu-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Cameron Mc
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--cu-text-muted)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'rgb(44, 140, 94)',
                flexShrink: 0,
              }}
            />
            Online
          </div>
        </div>
      </div>

      <Row icon={<SetStatusIcon />} label="Set status" />
      <Row icon={<MuteIcon />} label="Mute notifications" endChevron />

      <Divider />

      <Row icon={<SettingsIcon />} label="Settings" onClick={act(() => openSettings('preferences'))} />
      <Row icon={<BellIcon />} label="Notifications" onClick={act(() => openSettings('notifications'))} />
      <Row icon={<PaletteIcon />} label="Themes" onClick={act(() => openSettings('appearance'))} />
      <Row icon={<KeyboardIcon />} label="Keyboard shortcuts" />
      <Row icon={<DownloadIcon />} label="Download ClickUp" endExternal />
      <Row icon={<HelpIcon />} label="Help" endExternal />

      <Divider />

      <SectionHeading>Personal Tools</SectionHeading>
      {personalTools.map((item) => (
        <Row key={item.label} icon={item.icon} label={item.label} onClick={item.onClick} pin />
      ))}

      <Divider />

      <Row icon={<TrashIcon />} label="Trash" />
      <Row icon={<LogoutIcon />} label="Log out" />
    </div>
  );
}
