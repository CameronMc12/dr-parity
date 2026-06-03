/**
 * Inline SVG icons local to the Embed view's slim URL bar. Kept tiny and
 * stroke-driven so they inherit `currentColor` from the surrounding button.
 */

import type { ReactElement } from 'react';

interface IconProps {
  size?: number;
}

export function ReloadIcon({ size = 15 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0-.6 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M20 5v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 15 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 5h5v5M19 5l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-9A1.5 1.5 0 0 1 6 18.5v-9A1.5 1.5 0 0 1 7.5 8H12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ size = 15 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function PencilIcon({ size = 15 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 19h3l9.5-9.5a2 2 0 0 0 0-2.83l-.17-.17a2 2 0 0 0-2.83 0L5 16v3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function AlertIcon({ size = 32 }: IconProps): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="1.1" fill="currentColor" />
    </svg>
  );
}
