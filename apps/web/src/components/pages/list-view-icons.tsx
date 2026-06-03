'use client';

/**
 * Oracle-matched inline icons for the dark List view.
 * Sampled 1:1 from docs/research/clickup-dark/oracle-dark-listview-project1.png.
 * All icons inherit `currentColor` unless a colour is passed.
 */

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 120ms' }}
    >
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 0 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CaretDown({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 0 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function PlusCircle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Solid status-coloured priority flag. */
export function FlagIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4v16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 5h10.5a.6.6 0 0 1 .49.94L15 9l1.99 3.06a.6.6 0 0 1-.49.94H6"
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Empty-state priority flag — grey outline only. */
export function FlagOutline({ size = 14, color = 'rgb(120,120,120)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4v16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 5h10.5a.6.6 0 0 1 .49.94L15 9l1.99 3.06a.6.6 0 0 1-.49.94H6"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Empty-state assignee — person with a small plus. */
export function PersonAddIcon({ size = 16, color = 'rgb(120,120,120)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.6" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18.5 13.5v4M16.5 15.5h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Empty-state due date — calendar with a small plus. */
export function CalendarAddIcon({ size = 16, color = 'rgb(120,120,120)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="13" height="13" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M3.5 9h13M7.5 3.5v3M13 3.5v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18.5 13.5v4M16.5 15.5h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Comment bubble. */
export function CommentIcon({ size = 15, color = 'rgb(120,120,120)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 3.5V16H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Six-dot drag handle (⠿). */
export function DragHandleIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

/** Empty selection checkbox (rounded square). Filled variant shows a tick. */
export function CheckboxIcon({ size = 16, checked = false }: { size?: number; checked?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4"
        stroke={checked ? 'var(--cu-accent)' : 'currentColor'}
        strokeWidth="1.7"
        fill={checked ? 'var(--cu-accent)' : 'none'}
      />
      {checked && (
        <path d="M7.5 12.2l3 3 6-6.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Plus inside a square — "Add subtask" quick action. */
export function PlusSquareIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7.5v9M7.5 12h9" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Tag / label icon — "Add tag" quick action. */
export function TagIcon({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h5.1a2 2 0 0 1 1.42.59l7 7a1.6 1.6 0 0 1 0 2.26l-4.16 4.16a1.6 1.6 0 0 1-2.26 0l-7-7A2 2 0 0 1 4 9.6V5.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="8.2" cy="8.2" r="1.25" fill={color} />
    </svg>
  );
}

export function RenameIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5zM13.2 7.3l3.5 3.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EllipsisIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx={5} cy={12} r={1.7} />
      <circle cx={12} cy={12} r={1.7} />
      <circle cx={19} cy={12} r={1.7} />
    </svg>
  );
}

export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GroupIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SubtaskIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5v8a3 3 0 0 0 3 3h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="14" y="13" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ColumnsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 5v14M15 5v14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function FilterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ClosedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2m0 14v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2m14 0h2M5 19l1.5-1.5M17.5 6.5 19 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── view-tab glyph icons (dark, coloured) ───────────────────────────── */

export function ListGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1.4" fill={color} />
      <circle cx="4" cy="12" r="1.4" fill={color} />
      <circle cx="4" cy="18" r="1.4" fill={color} />
    </svg>
  );
}

export function BoardGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6" height="13" rx="1.4" stroke={color} strokeWidth="1.8" />
      <rect x="14" y="4" width="6" height="9" rx="1.4" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function CalendarGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke={color} strokeWidth="1.8" />
      <path d="M4 9h16M8 3v4M16 3v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GanttGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="9" height="3" rx="1.4" fill={color} />
      <rect x="8" y="11" width="10" height="3" rx="1.4" fill={color} />
      <rect x="6" y="17" width="7" height="3" rx="1.4" fill={color} />
    </svg>
  );
}

export function TableGlyph({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M4 10h16M4 15h16M12 5v14" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
