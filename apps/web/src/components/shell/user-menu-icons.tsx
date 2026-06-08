import type { ReactNode } from 'react';

/**
 * Inline SVG glyphs for the user-avatar dropdown menu.
 *
 * Path data is lifted from the real ClickUp cu3-icon sprite so each row icon is
 * 1:1 with production. Kept local to the user-menu so we never touch the shared
 * Icons.tsx. Every glyph renders on a 24×24 viewBox at currentColor.
 */
function MenuGlyph({
  size = 16,
  children,
}: {
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export const SetStatusIcon = () => (
  <MenuGlyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4 4 0 0 0 7 0" />
    <circle cx="9" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9.5" r="0.6" fill="currentColor" stroke="none" />
  </MenuGlyph>
);

export const MuteIcon = () => (
  <MenuGlyph>
    <path d="M6 9v6h3l4 3V6L9 9H6Z" />
    <path d="m16 9 4 6M20 9l-4 6" />
  </MenuGlyph>
);

export const ChevronRightIcon = () => (
  <MenuGlyph size={14}>
    <path d="m9 6 6 6-6 6" />
  </MenuGlyph>
);

export const SettingsIcon = () => (
  <MenuGlyph>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </MenuGlyph>
);

export const BellIcon = () => (
  <MenuGlyph>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </MenuGlyph>
);

export const PaletteIcon = () => (
  <MenuGlyph>
    <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.5-2 4-4 4h-1.5a1.5 1.5 0 0 0-1.06 2.56A1.5 1.5 0 0 1 12 21Z" />
    <circle cx="7.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
  </MenuGlyph>
);

export const KeyboardIcon = () => (
  <MenuGlyph>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
  </MenuGlyph>
);

export const DownloadIcon = () => (
  <MenuGlyph>
    <path d="M12 3v12M7 11l5 4 5-4M5 19h14" />
  </MenuGlyph>
);

export const HelpIcon = () => (
  <MenuGlyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 1.75-2 3" />
    <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
  </MenuGlyph>
);

export const ExternalLinkIcon = () => (
  <MenuGlyph size={13}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </MenuGlyph>
);

export const PinIcon = () => (
  <MenuGlyph size={13}>
    <path d="M9 4h6l-1 6 3 3H7l3-3-1-6ZM12 16v4" />
  </MenuGlyph>
);

export const CreateTaskIcon = () => (
  <MenuGlyph>
    <path d="m21 6-11 11-4-4" />
    <path d="M22 12a10 10 0 1 1-3-7.2" />
  </MenuGlyph>
);

export const MyWorkIcon = () => (
  <MenuGlyph>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </MenuGlyph>
);

export const TrackTimeIcon = () => (
  <MenuGlyph>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5M9 2h6" />
  </MenuGlyph>
);

export const NotepadIcon = () => (
  <MenuGlyph>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3v2M15 3v2M8 9h8M8 13h8M8 17h5" />
  </MenuGlyph>
);

export const RecordClipIcon = () => (
  <MenuGlyph>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m22 8-6 4 6 4V8Z" />
  </MenuGlyph>
);

export const ReminderIcon = () => (
  <MenuGlyph>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l3 2M9 2 5 5M19 5l-2.5-2" />
  </MenuGlyph>
);

export const CreateDocIcon = () => (
  <MenuGlyph>
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M5 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5Z" />
    <path d="M9 13h6M9 17h6" />
  </MenuGlyph>
);

export const CreateWhiteboardIcon = () => (
  <MenuGlyph>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 14c1.5-3 3-3 4.5-1.5S15 14 17 9" />
  </MenuGlyph>
);

export const ViewPeopleIcon = () => (
  <MenuGlyph>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6a3 3 0 0 1 0 5.5M16.5 13.5a5 5 0 0 1 4 5" />
  </MenuGlyph>
);

export const CreateDashboardIcon = () => (
  <MenuGlyph>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 16v-3M12 16V9M16 16v-5" />
  </MenuGlyph>
);

export const AiNotetakerIcon = () => (
  <MenuGlyph>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 3v2M15 3v2M8 9h8M8 13h4" />
    <path d="m15.5 14 .6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" fill="currentColor" stroke="none" />
  </MenuGlyph>
);

export const TrashIcon = () => (
  <MenuGlyph>
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </MenuGlyph>
);

export const LogoutIcon = () => (
  <MenuGlyph>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" />
  </MenuGlyph>
);
