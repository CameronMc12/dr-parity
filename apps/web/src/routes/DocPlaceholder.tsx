export function DocPlaceholder({ docId = '', pageId }: { docId?: string; pageId?: string }) {
  return (
    <div className="p-6">
      <div
        className="
          inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--cu-radius-md)] mb-4
          bg-[var(--cu-bg-strong)] border border-[var(--cu-border-divider)]
        "
      >
        <span className="text-[var(--cu-accent)] text-xs font-mono">Phase 3</span>
      </div>

      <h1 className="text-[var(--cu-text-primary)] text-lg font-semibold mb-2">
        Doc
      </h1>
      <p className="text-[var(--cu-text-muted)] text-sm font-mono">
        Route stub: /v/dc/{docId}{pageId ? `/${pageId}` : ''}
      </p>
      <p className="text-[var(--cu-text-disabled)] text-xs mt-2">
        Not yet implemented — Phase 3
      </p>
    </div>
  );
}
