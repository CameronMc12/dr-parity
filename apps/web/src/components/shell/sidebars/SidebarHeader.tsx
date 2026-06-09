'use client';

import { useEffect, useRef, useState } from 'react';
import { useShellStore } from '@/store/shell-store';
import { Menu } from '@/components/ui/Menu';
import { CreateMenu } from '@/components/menus/CreateMenu';
import { SidebarOptionsMenu } from './SidebarOptionsMenu';
import {
  ChevronDownGlyph,
  DoubleChevronLeftGlyph,
  EllipsisGlyph,
  FunnelGlyph,
  PlusGlyph,
  SearchGlyph,
} from './SidebarHeaderIcons';

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const HOVER_BG = 'var(--cu-bg-hover)';

/** 24px icon button that reveals on sidebar hover. */
function HeaderIconButton({
  label,
  visible,
  onClick,
  triggerRef,
  expanded,
  hasMenu,
  children,
}: {
  label: string;
  visible: boolean;
  onClick?: (e: React.MouseEvent) => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
  expanded?: boolean;
  hasMenu?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={triggerRef}
      aria-label={label}
      aria-haspopup={hasMenu ? 'menu' : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: expanded ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: MUTED,
        flexShrink: 0,
        opacity: visible || expanded ? 1 : 0,
        pointerEvents: visible || expanded ? 'auto' : 'none',
        transition: 'opacity 120ms ease, background 100ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG;
        (e.currentTarget as HTMLButtonElement).style.color = TEXT;
      }}
      onMouseLeave={(e) => {
        if (!expanded) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = MUTED;
      }}
    >
      {children}
    </button>
  );
}

/** Always-visible black "+ ⌄" create split-button pill. */
function CreatePill() {
  return (
    <Menu
      width={280}
      align="right"
      trigger={({ ref, onClick, open }) => (
        <button
          ref={ref}
          aria-label="Create new"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 26,
            padding: 0,
            background: 'var(--cu-bg-strong, rgb(38,38,38))',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#fff',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }}>
            <PlusGlyph size={14} />
          </span>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.24)', flexShrink: 0 }} />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 26 }}>
            <ChevronDownGlyph size={12} />
          </span>
        </button>
      )}
    >
      <CreateMenu />
    </Menu>
  );
}

/** The search-mode header row: full-width input that filters the tree live. */
function SearchRow({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 6px 0 8px',
        background: 'var(--cu-bg-input, rgba(255,255,255,0.06))',
        border: '1px solid var(--cu-border-strong, rgb(70,70,70))',
        borderRadius: 8,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'flex', color: MUTED, flexShrink: 0 }}>
        <SearchGlyph size={14} />
      </span>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={() => {
          if (!value) onClose();
        }}
        placeholder="Search sidebar…"
        aria-label="Search sidebar"
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: TEXT,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      <button
        aria-label="Clear search"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
        style={{
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          color: MUTED,
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Shared sidebar header used by both Home and Spaces. Title on the left;
 * hover-revealed icon buttons and an always-visible black "+ ⌄" create pill on
 * the right. Clicking 🔍 swaps the whole row into a live search input.
 *
 * Two right-side variants:
 *   - `options` (Spaces): [⋯ options] [🔍 search] [« collapse]
 *   - `filter`  (Home):   [🔍 search] [▽ funnel]  [« collapse]
 * The funnel is a controlled toggle (`filterOpen` / `onFilterToggle`) so the
 * parent can render the chip row directly beneath the header.
 */
export function SidebarHeader({
  title,
  hovered,
  onFilterChange,
  variant = 'options',
  filterOpen = false,
  onFilterToggle,
  primaryAction,
}: {
  title: 'Home' | 'Spaces' | 'Chat';
  hovered: boolean;
  onFilterChange?: (filter: string) => void;
  variant?: 'options' | 'filter' | 'chat';
  filterOpen?: boolean;
  onFilterToggle?: () => void;
  /**
   * Replaces the right-side "+ ⌄" create pill. Used by the Chat sidebar whose
   * primary button is a compose pencil rather than the create pill.
   */
  primaryAction?: React.ReactNode;
}) {
  const setSidebarOpen = useShellStore((s) => s.setSidebarOpen);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const setFilter = (v: string) => {
    setQuery(v);
    onFilterChange?.(v);
  };
  const closeSearch = () => {
    setSearching(false);
    setQuery('');
    onFilterChange?.('');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 40,
        paddingLeft: 12,
        paddingRight: 8,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {searching ? (
        <SearchRow value={query} onChange={setFilter} onClose={closeSearch} />
      ) : (
        <>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT, flex: 1 }}>{title}</span>

          {variant === 'options' && (
            <>
              <Menu
                width={236}
                align="left"
                trigger={({ ref, onClick, open }) => (
                  <HeaderIconButton
                    label="Sidebar options"
                    visible={hovered}
                    triggerRef={ref}
                    onClick={onClick}
                    expanded={open}
                    hasMenu
                  >
                    <EllipsisGlyph size={16} />
                  </HeaderIconButton>
                )}
              >
                <SidebarOptionsMenu />
              </Menu>

              <HeaderIconButton label="Search sidebar" visible={hovered} onClick={() => setSearching(true)}>
                <SearchGlyph size={15} />
              </HeaderIconButton>
            </>
          )}

          {variant === 'filter' && (
            <>
              <HeaderIconButton label="Search sidebar" visible={hovered} onClick={() => setSearching(true)}>
                <SearchGlyph size={15} />
              </HeaderIconButton>

              <HeaderIconButton
                label="Filter sidebar"
                visible={hovered}
                expanded={filterOpen}
                onClick={() => onFilterToggle?.()}
              >
                <FunnelGlyph size={16} />
              </HeaderIconButton>
            </>
          )}

          {variant === 'chat' && (
            <>
              <HeaderIconButton label="Search chat" visible={hovered} onClick={() => setSearching(true)}>
                <SearchGlyph size={15} />
              </HeaderIconButton>

              <HeaderIconButton
                label="Filter chat"
                visible={hovered}
                expanded={filterOpen}
                onClick={() => onFilterToggle?.()}
              >
                <FunnelGlyph size={16} />
              </HeaderIconButton>
            </>
          )}

          <HeaderIconButton label="Collapse sidebar" visible={hovered} onClick={() => setSidebarOpen(false)}>
            <DoubleChevronLeftGlyph size={16} />
          </HeaderIconButton>

          {primaryAction ?? <CreatePill />}
        </>
      )}
    </div>
  );
}
