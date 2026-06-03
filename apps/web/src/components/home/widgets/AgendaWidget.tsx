import { WidgetCard } from '../WidgetCard';

function ConnectButton({ provider }: { provider: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-[var(--cu-radius-sm)] border border-[var(--cu-border-divider)] flex items-center justify-center text-[11px]">
          📅
        </span>
        <span className="text-[var(--cu-text-primary)] text-[13px]">{provider}</span>
      </span>
      <button
        type="button"
        className="text-[var(--cu-status-blue)] text-[12px] font-medium px-2.5 h-7 rounded-[var(--cu-radius-sm)] border border-[var(--cu-border-divider)] hover:bg-[var(--cu-bg-hover)]"
      >
        Connect
      </button>
    </div>
  );
}

export function AgendaWidget() {
  return (
    <WidgetCard title="Agenda" icon={<span className="text-[14px] leading-none">🗓</span>}>
      <div className="flex flex-col">
        <p className="text-[var(--cu-text-muted)] text-[12px] leading-[1.45] mb-2">
          Connect your calendar to view upcoming events and join your next call
        </p>
        <ConnectButton provider="Google Calendar" />
        <div className="h-px bg-[var(--cu-border-divider)]" />
        <ConnectButton provider="Microsoft Outlook" />
      </div>
    </WidgetCard>
  );
}
