'use client';

/**
 * "More" apps grid — oracle `menu-my-tasks-more` / `home-header-caret`.
 * A 3-column tile grid of pinnable sidebar modules (Forms, Clips, Goals,
 * Timesheets) plus an Apps tile. Each tile shows its colored glyph + label;
 * hovering reveals the pin/unpin affordance (visual only — non-functional).
 */

interface Tile {
  id: string;
  label: string;
  glyph: React.ReactNode;
  pinned?: boolean;
}

function FormsGlyph() {
  return (
    <span style={tileBadge('rgb(124,77,255)')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M7 8l1.4 1.4 2.6-3M7 14l1.4 1.4 2.6-3M14 8h3.5M14 14h3.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
function ClipsGlyph() {
  return (
    <span style={tileBadge('rgb(229,57,53)')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="7" width="11" height="10" rx="2.5" fill="#fff" />
        <path d="M16 10.5l4-2.2v7.4l-4-2.2v-3z" fill="#fff" />
      </svg>
    </span>
  );
}
function GoalsGlyph() {
  return (
    <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏆</span>
  );
}
function TimesheetsGlyph() {
  return (
    <span style={tileBadge('rgb(255,138,0)')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="7.5" stroke="#fff" strokeWidth="1.8" />
        <path d="M12 8v4.2l2.6 1.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
function AppsGlyph() {
  return (
    <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="6" r="2.4" fill="rgb(124,77,255)" />
        <circle cx="12" cy="6" r="2.4" fill="rgb(38,132,255)" />
        <circle cx="18" cy="6" r="2.4" fill="rgb(255,138,0)" />
        <circle cx="6" cy="12" r="2.4" fill="rgb(22,199,132)" />
        <circle cx="12" cy="12" r="2.4" fill="rgb(229,57,53)" />
        <circle cx="18" cy="12" r="2.4" fill="rgb(124,77,255)" />
        <circle cx="9" cy="18" r="2.4" fill="rgb(255,203,71)" />
        <circle cx="15" cy="18" r="2.4" fill="rgb(38,132,255)" />
      </svg>
    </span>
  );
}

function tileBadge(bg: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const TILES: Tile[] = [
  { id: 'forms', label: 'Forms', glyph: <FormsGlyph /> },
  { id: 'clips', label: 'Clips', glyph: <ClipsGlyph /> },
  { id: 'goals', label: 'Goals', glyph: <GoalsGlyph /> },
  { id: 'timesheets', label: 'Timesheets', glyph: <TimesheetsGlyph />, pinned: true },
  { id: 'apps', label: 'Apps', glyph: <AppsGlyph /> },
];

export function MoreAppsMenu() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4,
        padding: '4px 8px',
      }}
    >
      {TILES.map((t) => (
        <AppTile key={t.id} tile={t} />
      ))}
    </div>
  );
}

function AppTile({ tile }: { tile: Tile }) {
  return (
    <button
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 6px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'var(--cu-bg-hover, rgb(244,244,244))';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {tile.glyph}
      <span style={{ fontSize: 12, color: 'var(--cu-text-primary, rgb(32,32,32))' }}>{tile.label}</span>
    </button>
  );
}
