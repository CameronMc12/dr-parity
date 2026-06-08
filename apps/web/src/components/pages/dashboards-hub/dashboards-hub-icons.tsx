/** Dashboards hub inline icons (table list + template tiles). */

/** Purple bar-chart glyph shown in a rounded square next to every list name. */
export function DashboardListGlyph({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 4,
        background: '#7b68ee',
        color: '#fff',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none">
        <path d="M6 19V11M12 19V5M18 19v-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function LockGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function SpaceLocationGlyph({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 4,
        background: '#3b82f6',
        color: '#fff',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 2 7l10 5 10-5-10-5Zm0 7.2L4.8 7 12 4 19.2 7 12 9.2Z" />
        <path d="M4 11.5 12 15l8-3.5v2L12 17l-8-3.5v-2Z" opacity="0.9" />
      </svg>
    </span>
  );
}

export function ProjectLocationGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3.2" cy="7" r="1.2" fill="currentColor" />
      <circle cx="3.2" cy="12" r="1.2" fill="currentColor" />
      <circle cx="3.2" cy="17" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function SortIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4v16m0 0-3-3m3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 20V4m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function SortArrowDownIcon({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 4,
        background: 'rgba(0,0,0,0.05)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function PlusColumnIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EllipsisIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

export function CaretDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 0 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FilterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---- template tile glyphs (rounded badge, one per accent) ---- */

export function TemplateSimpleGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function TemplateAiGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 19a4.5 4.5 0 0 1 9 0M14 19a4 4 0 0 1 6.5-3.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TemplateProjectGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h11M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18.5" cy="7" r="1.4" fill="currentColor" />
      <circle cx="20.5" cy="17" r="1.4" fill="currentColor" />
    </svg>
  );
}
