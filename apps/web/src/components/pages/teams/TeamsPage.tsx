'use client';

import { useState } from 'react';
import { PageSurface } from '@/components/pages/page-primitives';
import { TeamsGrid } from './TeamsGrid';
import { T } from './teams-tokens';
import {
  ChevronDownIcon,
  SearchGlyph,
  ListViewGlyph,
  GalleryViewGlyph,
} from './teams-icons';

type ViewMode = 'list' | 'gallery';

const FILTERS = ['Members', 'Created', 'Creator', 'Sort'] as const;

/**
 * Teams hub default surface: /<wsId>/teams-pulse/teams ("All Teams").
 * Matches ClickUp's Teams Pulse gallery — heading + Create Team CTA, a filter
 * toolbar, and an auto-fill grid of team cards. Interaction is local only.
 */
export function TeamsPage() {
  const [view, setView] = useState<ViewMode>('gallery');

  return (
    <PageSurface>
      <Header />
      <Toolbar view={view} onView={setView} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <TeamsGrid />
      </div>
    </PageSurface>
  );
}

function Header() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 24px 12px',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.textPrimary }}>
        All Teams
      </h1>
      <span style={{ flex: 1 }} />
      <CreateTeamButton />
    </div>
  );
}

function CreateTeamButton() {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 30,
        padding: '0 14px',
        background: T.dark,
        border: 'none',
        borderRadius: 7,
        cursor: 'pointer',
        color: T.appBg,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        transition: 'opacity 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      Create Team
    </button>
  );
}

function Toolbar({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 20px 12px',
      }}
    >
      {FILTERS.map((label) => (
        <FilterPill key={label} label={label} />
      ))}
      <span style={{ flex: 1 }} />
      <SearchButton />
      <ViewSwitcher view={view} onView={onView} />
    </div>
  );
}

function FilterPill({ label }: { label: string }) {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        height: 28,
        padding: '0 6px 0 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: T.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
      <span style={{ display: 'flex', color: T.textMuted }}>
        <ChevronDownIcon size={14} />
      </span>
    </button>
  );
}

function SearchButton() {
  return (
    <button
      type="button"
      aria-label="Search teams"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: T.textSecondary,
        fontSize: 13,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.hoverBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'flex', color: T.textMuted }}>
        <SearchGlyph size={15} />
      </span>
      Search
    </button>
  );
}

function ViewSwitcher({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  return (
    <div
      role="group"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        marginLeft: 4,
        padding: 2,
        background: T.hoverBg,
        borderRadius: 7,
      }}
    >
      <SwitcherButton
        label="List"
        active={view === 'list'}
        onClick={() => onView('list')}
        icon={<ListViewGlyph size={15} />}
      />
      <SwitcherButton
        label="Gallery"
        active={view === 'gallery'}
        onClick={() => onView('gallery')}
        icon={<GalleryViewGlyph size={15} />}
      />
    </div>
  );
}

function SwitcherButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 24,
        background: active ? T.appBg : 'transparent',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        color: active ? T.textPrimary : T.textMuted,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      {icon}
    </button>
  );
}
