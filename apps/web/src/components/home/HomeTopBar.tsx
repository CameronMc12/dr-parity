/**
 * The strip above the home page content: the "My Tasks" page label row. The
 * browser-notification permission banner now lives at the shell level
 * (NotificationsBanner) so it renders across all Home-experience routes.
 */
export function HomeTopBar() {
  return (
    <div className="shrink-0">
      {/* page label */}
      <div className="flex items-center h-[40px] px-4 border-b border-[var(--cu-border-divider)] bg-[var(--cu-bg-app)]">
        <span className="text-[var(--cu-text-primary)] text-[13px] font-medium">
          My Tasks
        </span>
      </div>
    </div>
  );
}
