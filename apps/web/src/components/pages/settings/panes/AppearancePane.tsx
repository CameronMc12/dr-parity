'use client';

import { useEffect, useState } from 'react';
import { PaneTitle, SettingsSection } from './primitives';

/**
 * Appearance + Theme color controls. Shared by both the Profile pane (oracle
 * inlines them) and the standalone Appearance pane.
 *
 * Theme color swatches mirror the oracle row. Selecting one writes
 * --cu-accent on <html> so the change is visible app-wide. Appearance picker
 * flips data-theme between light / dark / auto.
 */

const THEME_COLORS = [
  '#4ecdc4', // teal (default ClickUp accent)
  '#7b68ee',
  '#1090e0',
  '#fd71af',
  '#a259ff',
  '#536af5',
  '#e8730a',
  '#0c8d8d',
  '#a98a6a',
  '#3aa657',
];

function CheckMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ThemeColorRow() {
  const [active, setActive] = useState(0);

  const pick = (i: number) => {
    setActive(i);
    const color = THEME_COLORS[i];
    if (color && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--cu-accent', color);
    }
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      {THEME_COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          onClick={() => pick(i)}
          aria-label={`Theme color ${i + 1}`}
          className="w-8 h-8 rounded-[var(--cu-radius-md)] flex items-center justify-center transition-transform hover:scale-105"
          style={{
            background: i === 0 ? 'var(--cu-grey-800)' : c,
            boxShadow: active === i ? `0 0 0 2px var(--cu-bg-app), 0 0 0 4px ${c}` : 'none',
          }}
        >
          {active === i && <CheckMark />}
        </button>
      ))}
    </div>
  );
}

type Mode = 'light' | 'dark' | 'auto';

const MODES: { key: Mode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
];

function ModePreview({ mode }: { mode: Mode }) {
  // Mini app-window mockup: sidebar + content bars.
  const isDark = mode === 'dark';
  const split = mode === 'auto';
  const bg = isDark ? '#1f1f1f' : '#ffffff';
  const bar = isDark ? '#3a3a3a' : '#e4e4e4';
  return (
    <div
      className="w-full h-[72px] rounded-md overflow-hidden flex border border-[var(--cu-border)]"
      style={{ background: bg }}
    >
      <div className="w-1/3 h-full" style={{ background: isDark ? '#000' : '#f4f4f4' }} />
      <div className="flex-1 p-2 flex flex-col gap-1.5" style={split ? { background: '#000' } : undefined}>
        <div className="h-2 rounded" style={{ width: '70%', background: bar }} />
        <div className="h-2 rounded" style={{ width: '50%', background: bar }} />
        <div className="h-2 rounded" style={{ width: '60%', background: bar }} />
      </div>
    </div>
  );
}

export function AppearanceRow() {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      root.dataset.theme = mode;
    }
  }, [mode]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => setMode(m.key)}
          className="flex flex-col gap-2 text-left rounded-lg p-1.5 transition-colors"
          style={{
            boxShadow: mode === m.key ? '0 0 0 2px var(--cu-accent)' : 'none',
          }}
        >
          <ModePreview mode={m.key} />
          <span className="text-[13px] font-medium text-[var(--cu-text-primary)] px-1">
            {m.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Standalone Appearance pane (My Settings → Appearance). */
export function AppearancePane() {
  return (
    <div>
      <PaneTitle>Appearance</PaneTitle>
      <SettingsSection
        label="Theme color"
        description="Choose a preferred accent color for the app."
      >
        <ThemeColorRow />
      </SettingsSection>
      <SettingsSection
        label="Appearance"
        description="Choose light or dark mode, or switch automatically based on your system settings."
      >
        <AppearanceRow />
      </SettingsSection>
    </div>
  );
}
