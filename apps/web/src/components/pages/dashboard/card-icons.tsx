'use client';

/**
 * Card chrome icons. Small 14px stroke SVGs matching the ClickUp card-header
 * action anatomy (filter, refresh, fullscreen, options/ellipsis, drag handle)
 * and the per-action menu glyphs (history, sparkle, settings, duplicate,
 * trash). Stroke is `currentColor` so each button controls its own colour.
 */

interface IconProps {
  size?: number;
}

function svg(path: React.ReactNode, size: number) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export function FilterIcon({ size = 14 }: IconProps) {
  return svg(<path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5L2 3Z" />, size);
}

export function RefreshIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M13.5 7a5.5 5.5 0 1 0-1.1 4.2" />
      <path d="M13.5 2.5V7H9" />
    </>,
    size,
  );
}

export function FullscreenIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M2.5 6V2.5H6" />
      <path d="M10 2.5h3.5V6" />
      <path d="M13.5 10v3.5H10" />
      <path d="M6 13.5H2.5V10" />
    </>,
    size,
  );
}

export function EllipsisIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  );
}

export function DragIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {[4, 8, 12].map((y) =>
        [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />),
      )}
    </svg>
  );
}

export function HistoryIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
      <path d="M2.5 2.5V4h1.7" />
      <path d="M8 5v3l2 1.3" />
    </>,
    size,
  );
}

export function SparkleIcon({ size = 14 }: IconProps) {
  return svg(<path d="M8 2.5 9.2 6 12.5 7 9.2 8 8 11.5 6.8 8 3.5 7 6.8 6 8 2.5Z" />, size);
}

export function SettingsIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M12.7 3.3l-1.4 1.4M4.7 11.3l-1.4 1.4" />
    </>,
    size,
  );
}

export function DuplicateIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </>,
    size,
  );
}

export function TrashIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M3 4.5h10" />
      <path d="M5.5 4.5V3.5A1 1 0 0 1 6.5 2.5h3a1 1 0 0 1 1 1v1" />
      <path d="M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5" />
      <path d="M6.8 7v4M9.2 7v4" />
    </>,
    size,
  );
}

export function EditIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M11 2.5 13.5 5 6 12.5 3 13.5 4 10.5 11 2.5Z" />
      <path d="M9.5 4 12 6.5" />
    </>,
    size,
  );
}

export function MoveIcon({ size = 14 }: IconProps) {
  return svg(
    <>
      <path d="M8 2.5v11M2.5 8h11" />
      <path d="M8 2.5 6.5 4M8 2.5 9.5 4M8 13.5 6.5 12M8 13.5 9.5 12M2.5 8 4 6.5M2.5 8 4 9.5M13.5 8 12 6.5M13.5 8 12 9.5" />
    </>,
    size,
  );
}
