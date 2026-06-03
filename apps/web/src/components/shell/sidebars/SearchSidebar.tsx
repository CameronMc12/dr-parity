export function SearchSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <span className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider">
          Search
        </span>
      </div>
      <div className="px-3 pb-2">
        <input
          type="text"
          placeholder="Search everything..."
          autoFocus
          className="
            w-full h-8 px-3 rounded-[var(--cu-radius-md)] text-xs
            bg-[var(--cu-bg-input)] text-[var(--cu-text-primary)]
            border border-[var(--cu-border)] placeholder:text-[var(--cu-text-muted)]
            focus:outline-none focus:border-[var(--cu-accent)]
            transition-colors
          "
        />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[var(--cu-text-muted)] text-xs">Start typing to search</span>
      </div>
    </div>
  );
}
