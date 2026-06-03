'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Shared primitives for the Home destination pages (Inbox, Replies,
 * Assigned Comments, My Tasks). Sampled 1:1 from the 2026-06-01 oracles.
 */

export const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32, 32, 32))';
export const TEXT_SECONDARY = 'var(--cu-text-secondary, rgb(80, 80, 80))';
export const TEXT_MUTED = 'var(--cu-text-muted, rgb(130, 130, 130))';
export const BORDER = 'var(--cu-border-divider, rgb(232, 232, 232))';
export const HOVER_BG = 'var(--cu-bg-hover, rgb(244, 244, 244))';
export const APP_BG = 'var(--cu-bg-app, rgb(255, 255, 255))';
/** Solid CTA pill. Light theme: near-black; dark theme: light-on-dark via token. */
export const DARK_BTN = 'var(--cu-text-primary, rgb(24, 24, 24))';

const PAGE_PADDING_X = 24;

/** Full-height white page surface that fills the main content area. */
export function PageSurface({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: APP_BG,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** Page title rendered above the tab strip (Replies / Assigned Comments / My Tasks). */
export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: PAGE_PADDING_X,
        paddingRight: PAGE_PADDING_X,
        paddingTop: 16,
        paddingBottom: right ? 4 : 8,
      }}
    >
      <h1
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: TEXT_PRIMARY,
          margin: 0,
          flex: right ? undefined : 1,
        }}
      >
        {children}
      </h1>
      {right && (
        <>
          <span style={{ flex: 1 }} />
          {right}
        </>
      )}
    </div>
  );
}

interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Underline tab strip. `variant="full"` stretches each tab to an equal share of
 * the row (Inbox: Primary/Other/Later/Cleared). `variant="text"` packs the tabs
 * to the left with text-only labels (Replies, Assigned Comments).
 */
export function TabStrip({
  tabs,
  activeId,
  onSelect,
  variant = 'text',
}: {
  tabs: TabDef[];
  activeId: string;
  onSelect: (id: string) => void;
  variant?: 'full' | 'text';
}) {
  const full = variant === 'full';
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: full ? 0 : 18,
        paddingLeft: full ? 0 : PAGE_PADDING_X,
        paddingRight: full ? 0 : PAGE_PADDING_X,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const base: CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          justifyContent: full ? 'flex-start' : 'center',
          gap: 8,
          flex: full ? 1 : undefined,
          paddingLeft: full ? 24 : 0,
          paddingRight: full ? 24 : 0,
          paddingTop: full ? 14 : 10,
          paddingBottom: full ? 14 : 10,
          background: 'transparent',
          border: 'none',
          borderBottom: `2px solid ${active ? TEXT_PRIMARY : 'transparent'}`,
          marginBottom: -1,
          cursor: 'pointer',
          color: active ? TEXT_PRIMARY : TEXT_MUTED,
          fontSize: full ? 14 : 13,
          fontWeight: active ? 600 : 500,
        };
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            style={base}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = TEXT_PRIMARY;
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = TEXT_MUTED;
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-shaped filter/control button used in the page sub-toolbar. */
export function PillButton({
  children,
  icon,
  caret,
  active,
  onClick,
}: {
  children: ReactNode;
  icon?: ReactNode;
  caret?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        paddingLeft: 10,
        paddingRight: caret ? 8 : 10,
        background: active ? 'var(--cu-bg-active)' : 'transparent',
        border: `1px solid ${active ? 'transparent' : BORDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = active ? 'var(--cu-bg-active)' : 'transparent';
      }}
    >
      {icon}
      {children}
      {caret && <CaretDown />}
    </button>
  );
}

/** Solid dark CTA button (Invite people / Create your first task). */
export function DarkButton({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <button
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        paddingLeft: icon ? 16 : 20,
        paddingRight: 20,
        background: DARK_BTN,
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: APP_BG,
        fontSize: 14,
        fontWeight: 600,
        transition: 'opacity 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
    >
      {icon}
      {children}
    </button>
  );
}

/** Centered empty/zero-state block used across the message-style pages. */
export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 18 }}>{illustration}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: TEXT_PRIMARY }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 14, color: TEXT_MUTED, marginTop: 8 }}>{subtitle}</div>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

/* ---- inline icons (oracle-matched) ---- */

export function CaretDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 17a1 1 0 0 1-.707-.293l-6-6a1 1 0 0 1 1.414-1.414L12 14.586l5.293-5.293a1 1 0 1 1 1.414 1.414l-6 6A1 1 0 0 1 12 17Z"
        clipRule="evenodd"
      />
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

export function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2m0 14v2M5 5l1.5 1.5M17.5 17.5 19 19M3 12h2m14 0h2M5 19l1.5-1.5M17.5 6.5 19 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
