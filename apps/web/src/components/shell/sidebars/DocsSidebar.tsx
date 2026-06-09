'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AllDocsIcon,
  SharedIcon,
  PrivateIcon,
  MeetingNotesIcon,
  ArchivedIcon,
  FavoriteIcon,
  DocGlyphIcon,
} from '@/components/pages/docs-hub/docs-hub-icons';
import {
  useDocs,
  useDocsHydration,
  docUpdatedAt,
  type Doc,
} from '@/store/workspace/docs.slice';
import { useDocsHubStore } from '@/store/docs-hub-store';
import { useCurrentMemberId, useMembers } from '@/store/workspace/hooks';

const WORKSPACE_ID = '90152566819';

const TEXT = 'var(--cu-text-primary, rgb(32,32,32))';
const MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACTIVE = 'var(--cu-bg-active, rgb(237,237,237))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const DOC_BLUE = 'rgb(79,153,255)';

const RECENT_LIMIT = 5;

/**
 * ClickUp Docs left rail (faithful clone). Header "Docs", then the primary
 * collections (All Docs / My Docs / Shared with me / Private / Meeting Notes /
 * Archived), a Favorites section, a Recent Pages list, and a Popular Wikis
 * promo card. "My Docs" uses the current member avatar like the oracle. Rows
 * navigate to the docs hub (`/<wsId>/docs`) and set the active collection;
 * favorite / recent rows open the single-doc reader. Read-only against the docs
 * store; navigation behaviour is preserved.
 */
export function DocsSidebar() {
  useDocsHydration();
  const pathname = usePathname();
  const router = useRouter();
  const docs = useDocs();
  const members = useMembers();
  const currentMemberId = useCurrentMemberId();

  const activeSection = useDocsHubStore((s) => s.activeSection);
  const setActiveSection = useDocsHubStore((s) => s.setActiveSection);

  const wsId = pathname.split('/').filter(Boolean)[0] ?? WORKSPACE_ID;
  const onHub = /\/docs$/.test(pathname) || /\/docs(?:[/?#]|$)/.test(pathname);

  const owner = useMemo(
    () => members.find((m) => m.id === currentMemberId) ?? members[0],
    [members, currentMemberId],
  );

  const selectSection = (id: string) => {
    setActiveSection(id);
    router.push(`/${wsId}/docs`);
  };
  const openDoc = (docId: string) => router.push(`/${wsId}/v/dc/${docId}`);

  const favorites = useMemo(() => docs.filter((d) => d.favorite), [docs]);
  const recent = useMemo(
    () =>
      docs
        .slice()
        .sort((a, b) => docUpdatedAt(b) - docUpdatedAt(a))
        .slice(0, RECENT_LIMIT),
    [docs],
  );

  const isActive = (id: string) => onHub && activeSection === id;

  return (
    <aside
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
          Docs
        </span>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
        <NavRow
          label="All Docs"
          icon={<AllDocsIcon size={16} />}
          active={isActive('all')}
          onClick={() => selectSection('all')}
        />
        <NavRow
          label="My Docs"
          icon={<MemberAvatar initials={owner?.initials ?? 'C'} color={owner?.color ?? '#202020'} />}
          active={isActive('mine')}
          onClick={() => selectSection('mine')}
        />
        <NavRow
          label="Shared with me"
          icon={<SharedIcon size={16} />}
          active={isActive('shared')}
          onClick={() => selectSection('shared')}
        />
        <NavRow
          label="Private"
          icon={<PrivateIcon size={16} />}
          active={isActive('private')}
          onClick={() => selectSection('private')}
        />
        <NavRow
          label="Meeting Notes"
          icon={<MeetingNotesIcon size={16} />}
          active={isActive('meeting')}
          onClick={() => selectSection('meeting')}
        />
        <NavRow
          label="Archived"
          icon={<ArchivedIcon size={16} />}
          active={isActive('archived')}
          onClick={() => selectSection('archived')}
        />

        <Divider />

        <SectionLabel>Favorites</SectionLabel>
        {favorites.length > 0 ? (
          favorites.map((doc) => (
            <DocItemRow key={`fav-${doc.id}`} doc={doc} favorite onClick={() => openDoc(doc.id)} />
          ))
        ) : (
          <EmptyHint icon={<FavoriteIcon size={15} />}>No favorites yet</EmptyHint>
        )}

        <SectionLabel>Recent Pages</SectionLabel>
        {recent.map((doc) => (
          <DocItemRow key={`recent-${doc.id}`} doc={doc} onClick={() => openDoc(doc.id)} />
        ))}
        <MoreRow onClick={() => selectSection('all')} />

        <SectionLabel>Popular Wikis</SectionLabel>
        <PopularWikisCard />
      </nav>
    </aside>
  );
}

function NavRow({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        minHeight: 34,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: active ? ACTIVE : hover ? HOVER : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: active ? TEXT : 'rgb(80,80,80)',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? TEXT : 'rgb(110,110,110)',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

function MemberAvatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {initials.slice(0, 1)}
    </span>
  );
}

function DocItemRow({
  doc,
  favorite = false,
  onClick,
}: {
  doc: Doc;
  favorite?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const iconColor = favorite ? DOC_BLUE : 'rgb(120,120,120)';
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        minHeight: 32,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: hover ? HOVER : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: 'rgb(70,70,70)',
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: doc.emoji ? 15 : undefined,
          color: iconColor,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {doc.emoji ?? <DocGlyphIcon size={15} />}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {doc.name}
      </span>
    </button>
  );
}

function MoreRow({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        minHeight: 32,
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: hover ? HOVER : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        color: MUTED,
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          display: 'inline-flex',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          letterSpacing: 1,
        }}
      >
        …
      </span>
      <span>More</span>
    </button>
  );
}

function PopularWikisCard() {
  return (
    <div
      style={{
        position: 'relative',
        margin: '6px 4px 0',
        padding: '26px 18px 22px',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        background: 'var(--cu-bg-menu, #fff)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 14, opacity: 0.35, marginBottom: 14 }}>
        <span style={dotStyle} />
        <span style={dotStyle} />
        <span style={{ ...dotStyle, marginLeft: 'auto' }}>
          <CheckBadge />
        </span>
      </div>
      <div style={{ color: MUTED, fontSize: 12.5, lineHeight: 1.5, textAlign: 'left' }}>
        Most viewed and active Wikis appear here
      </div>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'var(--cu-bg-hover, rgb(238,238,238))',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

function CheckBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgb(60,60,60)" />
      <path
        d="m8.5 12 2.3 2.3 4.7-4.7"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: '12px 8px' }} />;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '16px 10px 6px',
        color: MUTED,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </div>
  );
}

function EmptyHint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        color: MUTED,
        fontSize: 13,
      }}
    >
      <span style={{ display: 'inline-flex', color: MUTED, flexShrink: 0 }}>{icon}</span>
      {children}
    </div>
  );
}
