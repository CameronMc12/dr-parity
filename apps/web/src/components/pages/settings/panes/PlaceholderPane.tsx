'use client';

import { PaneTitle } from './primitives';
import { settingsLabel } from '../settings-nav';

/**
 * Faithful placeholder for settings sections whose detail content is not yet
 * built. The nav structure matches the oracle; these panes hold the slot.
 */
export function PlaceholderPane({ sectionKey }: { sectionKey: string }) {
  const label = settingsLabel(sectionKey);
  return (
    <div>
      <PaneTitle>{label}</PaneTitle>
      <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-[var(--cu-radius-lg)] border border-dashed border-[var(--cu-border)] bg-[var(--cu-bg-strong)]">
        <p className="text-sm font-medium text-[var(--cu-text-primary)]">
          {label}
        </p>
        <p className="text-[13px] text-[var(--cu-text-muted)] mt-1 max-w-sm">
          Manage your {label.toLowerCase()} settings here.
        </p>
      </div>
    </div>
  );
}
