/**
 * Planner sidebar — UNCONNECTED empty state, 1:1 with ClickUp.
 * Oracle: app.clickup.com /90152566819/calendar (2026-06-01, 1440x900).
 * DOM source: cu-calendar-flyout-sidebar > _root_cpylc / _sidebar-nux-card_h2esq.
 * All values resolved from captured ClickUp CSS (light theme --cu-* tokens).
 */

// Resolved light-theme token values (from captured ClickUp CSS).
const CONTENT_DEFAULT = 'var(--cu-text-primary)'; // --cu-content-default (grey1100)
const CONTENT_SECONDARY = 'var(--cu-text-secondary)'; // --cu-content-secondary (grey1000)
const CONTENT_TERTIARY = 'var(--cu-text-muted)'; // --cu-content-tertiary (grey900)
const BG_STRONG = 'var(--cu-bg-strong)'; // --cu-background-strong (create button)
const BG_MENU = 'var(--cu-bg-menu)'; // --cu-background-menu (connect row)
const BG_ON_MAIN = 'var(--cu-bg-hover)'; // --cu-background-on-main (Connect pill)
const RADII_3_5 = '0.4375rem'; // --cu-radii-3-5 (7px)
const RADII_5 = '0.625rem'; // --cu-radii-5 (10px)
const ELEVATION_BORDER_1 = '0 0 1px 0 rgba(0,0,0,0.2667), 0 1px 2px 0 rgba(0,0,0,0.05)';
const CREATE_SHADOW =
  '0 0 1px 0 rgba(0,0,0,0.45), 0 1px 3px 0 rgba(0,0,0,0.15), 0 1px 2px -1px rgba(0,0,0,0.15)';

function AddIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 16, height: 16, display: 'block', fill: CONTENT_DEFAULT }}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M13 5a1 1 0 1 0-2 0v6H5a1 1 0 1 0 0 2h6v5.995a1 1 0 1 0 2 0V13h5.995a1 1 0 1 0 0-2H13V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: 14, height: 14, display: 'block', fill: CONTENT_TERTIARY }}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 8.293a1 1 0 0 1 1.414 0L12 13.586l5.293-5.293a1 1 0 1 1 1.414 1.414l-6 6a1 1 0 0 1-1.414 0l-6-6a1 1 0 0 1 0-1.414Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GoogleCalendarLogo() {
  return (
    <svg viewBox="0 0 48 48" style={{ width: 16, height: 16, display: 'block' }} aria-hidden="true">
      <path fill="#fff" d="M37 11H11v26h26V11Z" />
      <path fill="#1e88e5" d="M11 11H7.5A2.5 2.5 0 0 0 5 13.5V37h6V11Z" />
      <path fill="#fbc02d" d="M37 11h3.5A2.5 2.5 0 0 1 43 13.5V37h-6V11Z" />
      <path fill="#4caf50" d="M37 37v6H13.5A2.5 2.5 0 0 1 11 40.5V37h26Z" />
      <path fill="#1565c0" d="M37 11V5H13.5A2.5 2.5 0 0 0 11 7.5V11h26Z" />
      <path
        fill="#1e88e5"
        d="M22.32 24.91c.49.63 1.25.95 2.27.95.79 0 1.4-.2 1.85-.61.45-.4.67-.94.67-1.6 0-.68-.24-1.23-.72-1.65-.48-.42-1.16-.63-2.04-.63h-1.02v-1.82h.97c.79 0 1.4-.2 1.81-.59.42-.4.63-.92.63-1.56 0-.59-.18-1.05-.55-1.39-.36-.34-.87-.51-1.52-.51-.62 0-1.12.17-1.5.5-.38.34-.57.78-.57 1.31h-2.18c0-.81.31-1.49.92-2.04.62-.55 1.4-.83 2.34-.83 1.04 0 1.86.28 2.46.84.6.55.9 1.29.9 2.22 0 .49-.16.96-.47 1.4-.31.45-.71.78-1.2 1 .58.21 1.03.55 1.36 1.01.33.46.49.99.49 1.6 0 .94-.33 1.7-.99 2.28-.66.58-1.51.87-2.55.87-.97 0-1.79-.27-2.45-.81-.66-.54-1-1.27-1-2.18h2.19c0 .42.16.77.49 1.06Z"
      />
      <path
        fill="#1e88e5"
        d="M33.55 17.38v9.86h-2.23v-7.5l-2.05.62v-1.84l4.07-1.14h.21Z"
      />
    </svg>
  );
}

function MicrosoftOutlookLogo() {
  return (
    <svg viewBox="0 0 48 48" style={{ width: 16, height: 16, display: 'block' }} aria-hidden="true">
      <path
        fill="#103f6f"
        d="M24 24v18.5c0 .83-.67 1.5-1.5 1.5H8.5C7.67 44 7 43.33 7 42.5V24h17Z"
      />
      <path fill="#0364b8" d="M44 13v22a2 2 0 0 1-2 2H24V11h18a2 2 0 0 1 2 2Z" />
      <path fill="#0a2767" d="M44 13v.84L25 25 24 11h18a2 2 0 0 1 2 2Z" />
      <path fill="#28a8ea" d="M24 11v14l-9 5.5L24 36V11Z" opacity=".3" />
      <path fill="#fff" d="M44 14.5v20.7L31 27l13-12.5Z" opacity=".15" />
      <path
        fill="#0078d4"
        d="M3 12.86 19 9.5c.62-.13 1.2.34 1.2.98v27.04c0 .64-.58 1.11-1.2.98L3 35.14a1 1 0 0 1-.8-.98V13.84a1 1 0 0 1 .8-.98Z"
      />
      <path
        fill="#fff"
        d="M11.4 18.6c-2.86 0-4.84 2.2-4.84 5.4 0 3.2 1.98 5.4 4.84 5.4 2.85 0 4.83-2.2 4.83-5.4 0-3.2-1.98-5.4-4.83-5.4Zm0 8.86c-1.5 0-2.46-1.36-2.46-3.46 0-2.1.96-3.46 2.46-3.46 1.49 0 2.45 1.36 2.45 3.46 0 2.1-.96 3.46-2.45 3.46Z"
      />
    </svg>
  );
}

function ConnectButton({ logo, label }: { logo: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={`${label} Connect`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: 8,
        background: BG_MENU,
        borderRadius: RADII_5,
        border: 'none',
        boxShadow: ELEVATION_BORDER_1,
        cursor: 'pointer',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {logo}
        <span
          style={{
            color: CONTENT_DEFAULT,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.143,
          }}
        >
          {label}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            background: BG_ON_MAIN,
            color: CONTENT_SECONDARY,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.334,
            padding: '4px 6px',
            borderRadius: RADII_3_5,
          }}
        >
          Connect
        </span>
      </span>
    </button>
  );
}

export function PlannerSidebar() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        overflow: 'hidden',
      }}
    >
      {/* Header: title + disabled create button */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            color: CONTENT_DEFAULT,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Planner
        </span>
        <button
          type="button"
          disabled
          aria-label="Create new item in planner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px 6px 6px',
            background: BG_STRONG,
            borderRadius: RADII_3_5,
            border: 'none',
            boxShadow: CREATE_SHADOW,
            opacity: 0.5,
            cursor: 'not-allowed',
          }}
        >
          <AddIcon />
          <ChevronDownIcon />
        </button>
      </div>

      {/* Body: vertically centred NUX card */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <img
            src="/planner/empty-no-meetings-light.svg"
            alt="Connect your calendar to view upcoming events and join your next call"
            style={{ width: 72, height: 72 }}
          />
          <div
            style={{
              color: CONTENT_SECONDARY,
              fontSize: 12,
              lineHeight: 1.334,
              textAlign: 'center',
            }}
          >
            Connect your calendar to view upcoming events and join your next call
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              padding: '12px 0',
              boxSizing: 'border-box',
            }}
          >
            <ConnectButton logo={<GoogleCalendarLogo />} label="Google Calendar" />
            <ConnectButton logo={<MicrosoftOutlookLogo />} label="Microsoft Outlook" />
          </div>
        </section>
      </div>
    </div>
  );
}
