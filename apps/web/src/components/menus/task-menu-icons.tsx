/**
 * Inline 24x24 icons for the task right-click context menu, mirroring the real
 * ClickUp menu glyphs captured at
 * docs/research/clickup-parity/interactions/list/rightclick-task.png.
 *
 * Stroke weight + rounded caps match the kebab-menu icon family so the dark
 * theme reads byte-identical to the rest of the menus. The sprite carries none
 * of these task-menu glyphs, so they are hand-rolled here.
 */

const ICON_SIZE = 16;

interface PathIconProps {
  d: string;
  fill?: boolean;
}

function I({ d, fill }: PathIconProps) {
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

// Top icon-button row -------------------------------------------------------

export const CopyLinkIcon = () => (
  <I d="M9.5 14.5l5-5M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2" />
);
export const CopyIdIcon = () => (
  <I d="M9 9h9v9H9zM7 15H6V6h9v1" />
);
export const NewTabIcon = () => (
  <I d="M14 4h6v6M20 4l-8 8M6 6h4M6 6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
);

// Body items ----------------------------------------------------------------

export const AddColumnIcon = () => (
  <I d="M4 5h16v14H4zM10 5v14M16 5v14M13 9v6M13 12h6M16 12h-6" />
);
export const FavoriteIcon = () => (
  <I d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.4 7.4 18.8l.9-5.1L4.5 10l5.2-.8L12 4.5z" />
);
export const FavoriteFilledIcon = () => (
  <I d="M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.4 7.4 18.8l.9-5.1L4.5 10l5.2-.8L12 4.5z" fill />
);
export const RenameIcon = () => (
  <I d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.2 7.3l3.5 3.5" />
);
export const FollowIcon = () => (
  <I d="M12 5C7 5 3.5 12 3.5 12S7 19 12 19s8.5-7 8.5-7S17 5 12 5zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
);
export const RemindIcon = () => (
  <I d="M18 9a6 6 0 1 0-12 0c0 5-2.5 6.5-2.5 6.5h17S18 14 18 9zM10 19a2 2 0 0 0 4 0" />
);

export const MoveIcon = () => (
  <I d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4L11 7h7.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V6.5z" />
);
export const AddToIcon = () => (
  <I d="M4 7h10M4 12h7M4 17h7M16.5 14v6M13.5 17h6" />
);
export const MergeIcon = () => (
  <I d="M7 4v4.5a4 4 0 0 0 4 4h6M17 4v16M14 14.5l3-2 3 2M17 4l-3 2.5M17 4l3 2.5" />
);
export const DuplicateIcon = () => (
  <I d="M8.5 8.5h9v9h-9zM6.5 15.5h-1v-9h9v1" />
);
export const ConvertIcon = () => (
  <I d="M5 8h11l-3-3M19 16H8l3 3" />
);
export const TemplatesIcon = () => (
  <I d="M5 4h14v5H5zM5 11h6v9H5zM13 11h6v9h-6z" />
);

export const RelationshipsIcon = () => (
  <I d="M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9.5 11l5 2.5" />
);
export const TaskTypeIcon = () => (
  <I d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8.5 12l2.4 2.4 4.6-4.8" />
);

export const TimerIcon = () => (
  <I d="M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 11v3l2 1.5M9 4h6M12 4v2" />
);
export const SendEmailIcon = () => (
  <I d="M4 6h16v12H4zM4 7l8 6 8-6" />
);

export const ArchiveIcon = () => (
  <I d="M4 6h16v3.5H4zM5.5 9.5h13V18a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V9.5zM10 13h4" />
);
export const DeleteIcon = () => (
  <I d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7" />
);
export const SharingIcon = () => (
  <I d="M15 5l5 5-5 5M20 10H9a5 5 0 0 0-5 5v3" />
);

// Our extra submenu glyphs (status / priority / assignee / due) -------------

export const StatusIcon = () => (
  <I d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8.5 12l2.4 2.4 4.6-4.8" />
);
export const PriorityIcon = () => (
  <I d="M6 3v18M6 4h11l-2.5 3.5L17 11H6" />
);
export const AssigneeIcon = () => (
  <I d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0" />
);
export const DueDateIcon = () => (
  <I d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 9h16M8 3v4M16 3v4" />
);
export const CompleteIcon = () => (
  <I d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8 12l2.5 2.5L16 9" />
);
