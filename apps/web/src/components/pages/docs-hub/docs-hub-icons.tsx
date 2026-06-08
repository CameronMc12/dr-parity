import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function AllDocsIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function MyDocsIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c0-3 2.9-5 6.5-5s6.5 2 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function SharedIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="9" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 18c0-2.4 2.2-4 5-4M13.5 18c0-1.7 1.4-3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function PrivateIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}

export function MeetingNotesIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4.5" y="5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4v3M16 4v3M8.5 12h7M8.5 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function ArchivedIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="4" y="5" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 9v8a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function FavoriteIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path
        d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.1L12 16.4 7.4 18.8l.9-5.1L4.5 9.5l5.2-.8L12 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DocGlyphIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function ImportIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 4v9m0 0 3.5-3.5M12 13 8.5 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function SharingGlyphIcon({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="7" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m9 11 6-3M9 13l6 3" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}
