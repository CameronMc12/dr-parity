/**
 * "Apps & integrations" registry for the Add-view menu. Each entry is an
 * external web app the user can drop into the workspace. Selecting one creates a
 * concrete `embed` view (via `addView`) whose URL is the app's `url`, then
 * navigates to it.
 *
 * EMBED-PRESET HANDOFF (read this before consuming):
 * Because the views store only persists {id, code, name, listId} (no URL field),
 * the chosen app URL is stashed in a tiny localStorage-backed module map keyed by
 * the freshly-created view id. `EmbedView` reads it lazily on first render with
 * `getEmbedPreset(viewId)` and seeds its local `url` state from it. The map is
 * SSR-safe (all reads/writes are guarded) and versioned under
 * `parity-embed-presets-v1`.
 */

import type { ReactElement } from 'react';

// ── App registry ───────────────────────────────────────────────────────────

/** App glyphs are full-colour brand marks, so they take only a size. */
export type AppGlyph = (props: { size?: number }) => ReactElement;

export interface ViewApp {
  /** Stable key. */
  key: string;
  /** Display label shown on the app tile. */
  label: string;
  /** Preset URL the created embed view opens. */
  url: string;
  /** Brand-coloured square glyph. */
  Glyph: AppGlyph;
  /** Tile icon background colour. */
  iconColor: string;
}

function GoogleDocsGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 20V3.5Z" fill="#fff" opacity="0.95" />
      <path d="M8.5 11h7M8.5 14h7M8.5 17h4.5" stroke="#1a73e8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GoogleSheetsGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="1.4" fill="#fff" opacity="0.95" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h7M12 8v9" stroke="#188038" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GoogleCalendarGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="5" width="15" height="14" rx="1.6" fill="#fff" opacity="0.95" />
      <path d="M4.5 9h15M8 4v3M16 4v3" stroke="#4285f4" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="10" y="12" width="4" height="4" rx="0.8" fill="#4285f4" />
    </svg>
  );
}

function GoogleMapsGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" fill="#fff" opacity="0.95" />
      <circle cx="12" cy="11" r="2.2" fill="#ea4335" />
    </svg>
  );
}

function YouTubeGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6.5" width="17" height="11" rx="3" fill="#fff" opacity="0.95" />
      <path d="M10.5 9.5v5l4.2-2.5-4.2-2.5Z" fill="#ff0000" />
    </svg>
  );
}

function FigmaGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="14" cy="12" r="2.4" fill="#1abcfe" />
      <path d="M10 6.5h2.4a2.4 2.4 0 1 1 0 4.8H10V6.5Z" fill="#ff7262" />
      <path d="M10 11.3h2.4V16a2.4 2.4 0 1 1-2.4-2.4v-2.3Z" fill="#0acf83" />
      <path d="M10 6.5v4.8H7.6a2.4 2.4 0 1 1 0-4.8H10Z" fill="#f24e1e" />
      <path d="M10 11.3v4.8H7.6a2.4 2.4 0 1 1 0-4.8H10Z" fill="#a259ff" />
    </svg>
  );
}

export const VIEW_APPS: ViewApp[] = [
  { key: 'google-docs', label: 'Google Docs', url: 'https://docs.google.com', Glyph: GoogleDocsGlyph, iconColor: '#1a73e8' },
  { key: 'google-sheets', label: 'Google Sheets', url: 'https://sheets.google.com', Glyph: GoogleSheetsGlyph, iconColor: '#0f9d58' },
  { key: 'google-calendar', label: 'Google Calendar', url: 'https://calendar.google.com', Glyph: GoogleCalendarGlyph, iconColor: '#4285f4' },
  { key: 'google-maps', label: 'Google Maps', url: 'https://maps.google.com', Glyph: GoogleMapsGlyph, iconColor: '#34a853' },
  { key: 'youtube', label: 'YouTube', url: 'https://youtube.com', Glyph: YouTubeGlyph, iconColor: '#ff0000' },
  { key: 'figma', label: 'Figma', url: 'https://figma.com', Glyph: FigmaGlyph, iconColor: '#a259ff' },
];

// ── Embed-preset persistence ────────────────────────────────────────────────

const PRESETS_KEY = 'parity-embed-presets-v1';

function readPresets(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writePresets(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / serialization errors — preset is best-effort only
  }
}

/** Stash the preset URL for a freshly-created embed view id. */
export function setEmbedPreset(viewId: string, url: string): void {
  const map = readPresets();
  map[viewId] = url;
  writePresets(map);
}

/** Read the preset URL for an embed view id, or null if none was stored. */
export function getEmbedPreset(viewId: string): string | null {
  return readPresets()[viewId] ?? null;
}
