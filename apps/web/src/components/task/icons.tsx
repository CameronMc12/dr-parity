/**
 * Inline 16px stroke icons for the task detail panel. The shared sprite
 * (CuIconSprite) only ships a handful of glyphs, so the panel's meta-row
 * leading icons live here as self-contained SVGs matching ClickUp's set.
 */

interface IconProps {
  size?: number;
}

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const StatusDashIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
  </Svg>
);

export const CalendarIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </Svg>
);

export const TimeEstimateIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 4h14M5 20h14M7 4c0 4 5 5 5 8M17 4c0 4-5 5-5 8M7 20c0-4 5-5 5-8M17 20c0-4-5-5-5-8" />
  </Svg>
);

export const TagIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M3 12l9-9h7a2 2 0 0 1 2 2v7l-9 9z" />
    <circle cx="16.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const AssigneeIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Svg>
);

export const FlagIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
);

export const TrackTimeIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4l3 2" />
  </Svg>
);

export const RelationshipsIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </Svg>
);

export const DocLineIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const ArrowRightIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const CheckIcon = ({ size }: IconProps) => (
  <Svg size={size}>
    <path d="M5 13l4 4L19 7" />
  </Svg>
);

export const ChevronRightSmallIcon = ({ size = 14 }: IconProps) => (
  <Svg size={size}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const ChevronUpIcon = ({ size = 14 }: IconProps) => (
  <Svg size={size}>
    <path d="M6 15l6-6 6 6" />
  </Svg>
);

export const PlusSmallIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CloseIcon = ({ size = 18 }: IconProps) => (
  <Svg size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ExpandIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M14 4v16" />
  </Svg>
);

export const SearchIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </Svg>
);

export const BellIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);

export const FilterIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M3 5h18l-7 8v6l-4-2v-4z" />
  </Svg>
);

export const EllipsisIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const StarIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
  </Svg>
);

export const LinkIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
  </Svg>
);

export const SparkleIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"
      fill="url(#cuSpark)"
    />
    <defs>
      <linearGradient id="cuSpark" x1="5" y1="3" x2="19" y2="17">
        <stop stopColor="#f857a6" />
        <stop offset="1" stopColor="#7d5fff" />
      </linearGradient>
    </defs>
  </svg>
);

export const CommentIcon = ({ size = 16 }: IconProps) => (
  <Svg size={size}>
    <path d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12z" />
  </Svg>
);
