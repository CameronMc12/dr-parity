import type { ReactNode } from 'react';
import { DOCS_TREE, type DocNode } from '@/data/docs-tree';

const WORKSPACE_ID = '90152566819';

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const SOFT = 'var(--cu-text-muted)';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';

function Cu3Icon({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      data-testid="icon"
      className="svg"
      style={{ width: size, height: size, display: 'block', fill: 'currentColor' }}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path d="m15 15 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function HeaderButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      aria-label={label}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: SOFT,
        background: 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function DocAvatar({ doc, active }: { doc: DocNode; active: boolean }) {
  return (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        background: doc.emoji ? 'transparent' : active ? 'var(--cu-indigo-subtle)' : HOVER,
        color: active ? 'var(--cu-indigo-text)' : SOFT,
        fontSize: doc.emoji ? 14 : undefined,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {doc.emoji ?? <Cu3Icon id="cu3-icon-v4IaSidebarDocs" size={14} />}
    </span>
  );
}

function DocRow({ doc, active = false }: { doc: DocNode; active?: boolean }) {
  return (
    <a
      href={`/${WORKSPACE_ID}/v/dc/${doc.id}`}
      style={{
        minHeight: 34,
        padding: '5px 8px',
        borderRadius: 6,
        color: active ? TEXT : MUTED,
        background: active ? ACTIVE : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      <DocAvatar doc={doc} active={active} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
          {doc.pageCount > 1 && (
            <span style={{ color: 'rgb(170, 170, 170)', fontSize: 11, fontWeight: 400, flexShrink: 0 }}>{doc.pageCount}</span>
          )}
        </span>
        <span style={{ display: 'block', color: 'rgb(170, 170, 170)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.location}
        </span>
      </span>
    </a>
  );
}

export function DocsSidebar() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>Docs</span>
        <HeaderButton label="Search docs">
          <SearchIcon />
        </HeaderButton>
        <HeaderButton label="Create doc">
          <Cu3Icon id="cu3-icon-addSmall" size={14} />
        </HeaderButton>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 4px 12px' }}>
        <div style={{ padding: '0 8px 6px', color: SOFT, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
          Recent
        </div>
        {DOCS_TREE.map((doc, index) => (
          <DocRow key={doc.id} doc={doc} active={index === 0} />
        ))}
      </nav>
    </div>
  );
}
