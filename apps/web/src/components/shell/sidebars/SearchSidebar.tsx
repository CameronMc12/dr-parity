'use client';

import { useUiStore } from '@/store/ui-store';

/**
 * Sidebar launcher for the IconBar 'search' rail. The full ⌘K experience lives
 * in `CommandPalette` (mounted from the TopBar); this panel is a thin trigger
 * that opens it.
 */
export function SearchSidebar() {
  const openSearch = useUiStore((s) => s.openSearch);
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <span className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider">
          Search
        </span>
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => openSearch()}
          className="
            w-full h-8 px-3 rounded-[var(--cu-radius-md)] text-xs flex items-center justify-between
            bg-[var(--cu-bg-input)] text-[var(--cu-text-muted)]
            border border-[var(--cu-border)]
            hover:border-[var(--cu-border-strong)] transition-colors
          "
        >
          <span>Search everything…</span>
          <kbd className="text-[10px] text-[var(--cu-text-disabled)]">⌘K</kbd>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[var(--cu-text-muted)] text-xs">Press ⌘K to search</span>
      </div>
    </div>
  );
}
