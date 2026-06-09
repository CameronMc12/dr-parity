export const ORACLE_BASE = 'http://localhost:7050';
export const REACT_BASE = 'http://localhost:5173';

export const VIEWPORT = { width: 1440, height: 900 };

// pixelmatch per-pixel sensitivity: 0.1 = small colour differences count as diff
export const PIXELMATCH_THRESHOLD = 0.1;

// How many seconds to wait for a reachability probe before declaring unreachable
export const REACHABILITY_TIMEOUT_MS = 5000;

// Output directory relative to harness root
export const OUTPUT_DIR = 'output';

// Shell region definitions for --shell-only mode.
// Coordinates are in CSS pixels at 1440×900 viewport.
// fullHeight is resolved at runtime from the actual screenshot height.
export interface ShellRegion {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number | 'fullHeight';
}

export const SHELL_REGIONS: ShellRegion[] = [
  // Left icon bar (far-left navigation rail)
  { label: 'IconBar',  x: 0,   y: 0, w: 64,  h: 'fullHeight' },
  // Sidebar (expands to the right of the icon bar)
  { label: 'Sidebar',  x: 64,  y: 0, w: 256, h: 'fullHeight' },
  // Top bar (horizontal chrome above the content area)
  { label: 'TopBar',   x: 64,  y: 0, w: VIEWPORT.width - 64, h: 56 },
];

// Pass criteria for --shell-only mode
export const SHELL_PIXEL_THRESHOLD = 0.98;
export const SHELL_DOM_THRESHOLD = 0.95;

// CSS selectors that describe the shell containers for DOM diff restriction
export const SHELL_SELECTORS = [
  // ClickUp top-level app wrapper
  '.app-layout',
  // Icon bar / nav rail
  '.nav-sidebar',
  '[class*="icon-bar"]',
  '[class*="IconBar"]',
  // Sidebar
  '[class*="sidebar"]',
  '[class*="Sidebar"]',
  // Top bar / header
  '[class*="top-bar"]',
  '[class*="TopBar"]',
  'header',
];
