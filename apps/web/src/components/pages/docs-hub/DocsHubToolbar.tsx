'use client';

import { PlusIcon, CaretDown } from '../page-primitives';
import { ImportIcon } from './docs-hub-icons';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const SECONDARY = 'var(--cu-text-secondary, rgb(90,90,90))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const SOLID_BTN_BG = 'var(--cu-text-primary, rgb(48,48,48))';
const SOLID_BTN_FG = 'var(--cu-bg-app, #fff)';

function ImportButton() {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        background: 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: SECONDARY,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <ImportIcon size={15} />
      Import
    </button>
  );
}

function NewDocButton({ onNewDoc }: { onNewDoc?: () => void }) {
  return (
    <button
      type="button"
      onClick={onNewDoc}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 8px 0 12px',
        background: SOLID_BTN_BG,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: SOLID_BTN_FG,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
      }}
    >
      <PlusIcon size={14} />
      New Doc
      <span style={{ display: 'flex', opacity: 0.8, marginLeft: 2 }}>
        <CaretDown size={12} />
      </span>
    </button>
  );
}

/**
 * Docs hub header. Oracle: the active section title ("All Docs") on the left,
 * with Import and a split "New Doc ▾" CTA pinned to the right.
 */
export function DocsHubToolbar({ title, onNewDoc }: { title: string; onNewDoc?: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 52,
        padding: '0 16px 0 24px',
        flexShrink: 0,
      }}
    >
      <h1 style={{ fontSize: 17, fontWeight: 600, color: TEXT, margin: 0 }}>{title}</h1>
      <span style={{ flex: 1 }} />
      <ImportButton />
      <NewDocButton onNewDoc={onNewDoc} />
    </div>
  );
}
