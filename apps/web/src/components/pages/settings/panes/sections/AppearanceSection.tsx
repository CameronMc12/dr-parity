'use client';

import { useEffect, useState } from 'react';
import { SettingsSection } from '../primitives';

/**
 * Appearance section of My Settings: Light / Dark / Auto preview cards.
 * Initializes from the current <html data-theme> so it does not hijack the
 * app theme on mount, then writes the selection back on change.
 */

type Mode = 'light' | 'dark' | 'auto';

const MODES: { key: Mode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'auto', label: 'Auto' },
];

function ModePreview({ mode }: { mode: Mode }) {
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
      <div
        className="flex-1 p-2 flex flex-col gap-1.5"
        style={split ? { background: '#000' } : undefined}
      >
        <div className="h-2 rounded" style={{ width: '70%', background: bar }} />
        <div className="h-2 rounded" style={{ width: '50%', background: bar }} />
        <div className="h-2 rounded" style={{ width: '60%', background: bar }} />
      </div>
    </div>
  );
}

export function AppearanceSection() {
  const [mode, setMode] = useState<Mode>('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === 'light' || current === 'dark') setMode(current);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      root.dataset.theme = mode;
    }
  }, [mode, hydrated]);

  return (
    <SettingsSection
      label="Appearance"
      description="Choose Light or Dark mode, or select your mode automatically based on your system settings."
    >
      <div className="grid grid-cols-3 gap-3 max-w-md">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className="flex flex-col gap-2 text-left rounded-lg p-1.5 transition-colors"
            style={{ boxShadow: mode === m.key ? '0 0 0 2px var(--cu-accent)' : 'none' }}
          >
            <ModePreview mode={m.key} />
            <span className="text-[13px] font-medium text-[var(--cu-text-primary)] px-1">
              {m.label}
            </span>
          </button>
        ))}
      </div>
    </SettingsSection>
  );
}
