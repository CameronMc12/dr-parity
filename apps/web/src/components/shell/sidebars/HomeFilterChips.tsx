'use client';

import { useSidebarPrefsStore } from '@/store/sidebar-prefs-store';

const MUTED = 'var(--cu-text-muted)';
const TEXT = 'var(--cu-text-primary)';
const DARK = 'var(--cu-bg-strong, rgb(38,38,38))';

function Chip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: active ? '0 6px 0 10px' : '0 10px',
        background: active ? '#fff' : DARK,
        color: active ? 'rgb(32,32,32)' : MUTED,
        border: active ? '1px solid var(--cu-border-strong, rgb(208,208,208))' : 'none',
        borderRadius: 9999,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      <span>{label}</span>
      {active && (
        <span
          aria-label={`Clear ${label}`}
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            color: 'rgb(120,120,120)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </button>
  );
}

/** Home-only filter chip row revealed by the header funnel toggle. */
export function HomeFilterChips() {
  const unread = useSidebarPrefsStore((s) => s.homeFilterUnread);
  const dms = useSidebarPrefsStore((s) => s.homeFilterDms);
  const setUnread = useSidebarPrefsStore((s) => s.setHomeFilterUnread);
  const setDms = useSidebarPrefsStore((s) => s.setHomeFilterDms);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 12px 8px',
        flexShrink: 0,
      }}
    >
      <Chip label="Unread" active={unread} onToggle={() => setUnread(!unread)} />
      <Chip label="DMs" active={dms} onToggle={() => setDms(!dms)} />
    </div>
  );
}
