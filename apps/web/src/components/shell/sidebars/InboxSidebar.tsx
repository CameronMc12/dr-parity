export function InboxSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2">
        <span className="text-[var(--cu-text-secondary)] text-xs font-semibold uppercase tracking-wider">
          Inbox
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[var(--cu-text-muted)] text-xs">Inbox is empty</span>
      </div>
    </div>
  );
}
