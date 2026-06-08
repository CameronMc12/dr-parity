/** Goals surface inline icons, sampled from the Goals oracle toolbar + grid. */

export function SortIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArchivedIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 8v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Open-folder glyph used inside the "create goal folder" tile. */
export function FolderOpenIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h3.8a1.5 1.5 0 0 1 1.2.6l.9 1.2a1.5 1.5 0 0 0 1.2.6h6.4A1.5 1.5 0 0 1 21 9.9v.6H6.6a1.5 1.5 0 0 0-1.45 1.12L3 19.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="m3 19.5 2.15-7.88A1.5 1.5 0 0 1 6.6 10.5H22l-2.3 7.8a1.5 1.5 0 0 1-1.44 1.2H3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trophy glyph for the Goals icon-rail / sidebar header. */
export function GoalsGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4h10v3a5 5 0 0 1-10 0V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M12 12v4M9 20h6M10 20l.5-4h3l.5 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
