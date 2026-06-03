'use client';

/**
 * Share modal — 1:1 with ClickUp's "Share this List" dialog.
 *
 * Structure (top→bottom): scope title with caret ("Share this List ⌄") + close
 * X · subline "Sharing List with all views · <Project>" · full-width invite
 * input with an inline dark Invite button · "Private link" row + Copy link ·
 * "Default permission" row + Full edit select · "Share with" list (expandable
 * Team Space group with member avatar + access toggle) · Make Private. Below the
 * card sits the collapsed "Share this view (single view) ›" scope switcher.
 *
 * Wiring: Copy link writes the current URL to the clipboard (transient "Copied"
 * confirmation). Invite appends an email to a local shared-with list seeded from
 * workspace members. The default-permission select and per-member access
 * toggles update local state. Scope (List ↔ view) is local UI state. Nothing
 * leaves the page.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useMembers } from '@/store/workspace/hooks';
import {
  CenterModal,
  MemberBubble,
  Toggle,
  headerTokens,
} from './primitives';
import {
  CaretIcon,
  CaretRightIcon,
  CheckIcon,
  CloseIcon,
  InfoIcon,
  LinkIcon,
  ListGlyphIcon,
  LockIcon,
  PeopleIcon,
  PermissionIcon,
  ShareIcon,
} from './icons';

const { TEXT_MUTED, TEXT_PRIMARY, MENU_BORDER, ACCENT, HOVER_BG, INPUT_BG } = headerTokens;

type Permission = 'Full edit' | 'Can edit' | 'Can comment' | 'Can view';
const PERMISSIONS: Permission[] = ['Full edit', 'Can edit', 'Can comment', 'Can view'];

type Scope = 'list' | 'view';

interface ShareEntry {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  enabled: boolean;
}

const memberToEntry = (m: ReturnType<typeof useMembers>[number]): ShareEntry => ({
  id: m.id,
  name: m.name,
  email: m.email,
  initials: m.initials,
  color: m.color,
  enabled: true,
});

const SPACE_BLUE = 'var(--cu-status-purple, rgb(92,71,205))';

export function SharePanel({ projectName }: { projectName: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const members = useMembers();

  const [shared, setShared] = useState<ShareEntry[]>(() => members.map(memberToEntry));

  // The workspace store hydrates after mount (skipHydration), so `members` is
  // often empty on first render. Backfill the seeded list once it arrives.
  useEffect(() => {
    if (shared.length === 0 && members.length > 0) {
      setShared(members.map(memberToEntry));
    }
  }, [members, shared.length]);

  const [scope, setScope] = useState<Scope>('list');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState<Permission>('Full edit');
  const [permMenuOpen, setPermMenuOpen] = useState(false);
  const [spaceExpanded, setSpaceExpanded] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard may be blocked; still show the confirmation for parity
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const invite = () => {
    const value = email.trim();
    if (!value) return;
    const local = value.split('@')[0] ?? value;
    const initials = local.slice(0, 2).toUpperCase();
    setShared((prev) => [
      ...prev,
      {
        id: `inv-${prev.length}-${Date.now()}`,
        name: value,
        email: value,
        initials,
        color: '#7b7b7b',
        enabled: true,
      },
    ]);
    setEmail('');
  };

  const toggleMember = (id: string) =>
    setShared((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));

  const scopeTitle = scope === 'list' ? 'Share this List' : 'Share this view';
  const scopeSub = scope === 'list' ? 'Sharing List with all views' : 'Sharing this view only';
  const enabledCount = shared.filter((s) => s.enabled).length;

  return (
    <>
      <button
        ref={triggerRef}
        aria-label="Share"
        onClick={() => setOpen(true)}
        style={{
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 9px',
          background: open ? HOVER_BG : ACCENT,
          color: open ? TEXT_PRIMARY : '#0c2b29',
          border: 'none',
          borderRadius: 5,
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: 600,
          fontFamily: 'inherit',
          flexShrink: 0,
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        <ShareIcon size={14} /> Share
      </button>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        width={460}
        labelledBy={titleId}
        footer={
          scope === 'list' ? (
            <ScopeSwitcher
              label="Share this view"
              hint="(single view)"
              onClick={() => {
                setScope('view');
                setScopeMenuOpen(false);
              }}
            />
          ) : (
            <ScopeSwitcher
              label="Share this List"
              hint="(all views)"
              onClick={() => {
                setScope('list');
                setScopeMenuOpen(false);
              }}
            />
          )
        }
      >
        <div style={{ padding: 18 }}>
          {/* Header: scope title + caret + close */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <button
                onClick={() => setScopeMenuOpen((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: TEXT_PRIMARY,
                  fontFamily: 'inherit',
                }}
              >
                <span id={titleId} style={{ fontSize: 18, fontWeight: 700 }}>
                  {scopeTitle}
                </span>
                <span style={{ display: 'flex', color: TEXT_MUTED }}>
                  <CaretIcon size={14} />
                </span>
              </button>

              {scopeMenuOpen && (
                <ScopeMenu
                  active={scope}
                  onPick={(next) => {
                    setScope(next);
                    setScopeMenuOpen(false);
                  }}
                  onClose={() => setScopeMenuOpen(false)}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                  fontSize: 13.5,
                  color: TEXT_MUTED,
                }}
              >
                {scopeSub}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: TEXT_PRIMARY, fontWeight: 600 }}>
                  <span style={{ display: 'flex', color: TEXT_MUTED }}>
                    <ListGlyphIcon size={15} />
                  </span>
                  {projectName}
                </span>
              </div>
            </div>

            <button
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={{
                width: 26,
                height: 26,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: HOVER_BG,
                borderRadius: '50%',
                cursor: 'pointer',
                color: TEXT_MUTED,
                flexShrink: 0,
              }}
            >
              <CloseIcon size={15} />
            </button>
          </div>

          {/* Invite input with inline dark Invite button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 18,
              padding: '5px 5px 5px 12px',
              border: `1px solid ${MENU_BORDER}`,
              borderRadius: 8,
              background: INPUT_BG,
            }}
          >
            <input
              type="text"
              placeholder="Invite by name or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') invite();
              }}
              style={{
                flex: 1,
                height: 32,
                border: 'none',
                background: 'transparent',
                color: TEXT_PRIMARY,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              onClick={invite}
              style={{
                height: 32,
                padding: '0 16px',
                background: 'var(--cu-text-primary, #eee)',
                color: 'var(--cu-bg-menu, #222)',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Invite
            </button>
          </div>

          {/* Private link row */}
          <Row
            icon={<LinkIcon size={17} />}
            label="Private link"
            info
            trailing={
              <button
                onClick={copy}
                style={{
                  height: 30,
                  padding: '0 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: copied ? 'transparent' : 'transparent',
                  color: copied ? 'var(--cu-status-green, #2bc46d)' : TEXT_PRIMARY,
                  border: `1px solid ${MENU_BORDER}`,
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {copied ? (
                  <>
                    <CheckIcon size={14} /> Copied
                  </>
                ) : (
                  'Copy link'
                )}
              </button>
            }
          />

          {/* Default permission row */}
          <Row
            icon={<PermissionIcon size={17} />}
            label="Default permission"
            info
            trailing={
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setPermMenuOpen((v) => !v)}
                  style={{
                    height: 30,
                    padding: '0 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'transparent',
                    color: TEXT_PRIMARY,
                    border: `1px solid ${MENU_BORDER}`,
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {permission}
                  <span style={{ display: 'flex', color: TEXT_MUTED }}>
                    <CaretIcon size={12} />
                  </span>
                </button>
                {permMenuOpen && (
                  <DropdownList
                    items={PERMISSIONS}
                    active={permission}
                    onPick={(p) => {
                      setPermission(p);
                      setPermMenuOpen(false);
                    }}
                    onClose={() => setPermMenuOpen(false)}
                  />
                )}
              </div>
            }
          />

          {/* Share with */}
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED }}>Share with</span>

            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  aria-label={spaceExpanded ? 'Collapse' : 'Expand'}
                  onClick={() => setSpaceExpanded((v) => !v)}
                  style={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: TEXT_MUTED,
                    transform: spaceExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 120ms ease',
                    flexShrink: 0,
                  }}
                >
                  <CaretRightIcon size={12} />
                </button>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: SPACE_BLUE,
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PeopleIcon size={15} />
                </span>
                <span style={{ flex: 1, fontSize: 14, color: TEXT_PRIMARY, fontWeight: 500 }}>
                  Team Space
                </span>
                <MemberStack entries={shared} />
              </div>

              {spaceExpanded && (
                <div style={{ marginTop: 6, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {shared.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 6px', borderRadius: 6 }}>
                      <MemberBubble initials={s.initials} color={s.color} size={26} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.name}
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: TEXT_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {s.email}
                        </span>
                      </span>
                      <Toggle
                        checked={s.enabled}
                        onChange={() => toggleMember(s.id)}
                        label={`Access for ${s.name}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Make Private */}
          <button
            onClick={() => setIsPrivate((v) => !v)}
            style={{
              marginTop: 18,
              width: '100%',
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: HOVER_BG,
              color: TEXT_PRIMARY,
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <LockIcon size={16} />
            {isPrivate ? `Private · ${enabledCount} with access` : 'Make Private'}
          </button>
        </div>
      </CenterModal>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  info = false,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  info?: boolean;
  trailing: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        marginTop: 14,
        minHeight: 30,
      }}
    >
      <span style={{ display: 'flex', color: TEXT_MUTED }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, color: TEXT_PRIMARY, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {label}
        {info && (
          <span style={{ display: 'flex', color: TEXT_MUTED, opacity: 0.7 }}>
            <InfoIcon size={14} />
          </span>
        )}
      </span>
      {trailing}
    </div>
  );
}

function MemberStack({ entries }: { entries: ShareEntry[] }) {
  const shown = entries.filter((e) => e.enabled).slice(0, 3);
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      {shown.map((e, i) => (
        <span key={e.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <MemberBubble initials={e.initials} color={e.color} size={24} ring />
        </span>
      ))}
    </span>
  );
}

function ScopeSwitcher({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '14px 18px',
        background: 'var(--cu-bg-menu, #222)',
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 14,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        color: TEXT_PRIMARY,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13, color: TEXT_MUTED, flex: 1 }}>{hint}</span>
      <span style={{ display: 'flex', color: TEXT_MUTED }}>
        <CaretRightIcon size={14} />
      </span>
    </button>
  );
}

function ScopeMenu({
  active,
  onPick,
  onClose,
}: {
  active: Scope;
  onPick: (s: Scope) => void;
  onClose: () => void;
}) {
  return (
    <DropdownPanel onClose={onClose}>
      <ScopeOption label="Share this List" sub="All views" checked={active === 'list'} onClick={() => onPick('list')} />
      <ScopeOption label="Share this view" sub="Single view" checked={active === 'view'} onClick={() => onPick('view')} />
    </DropdownPanel>
  );
}

function ScopeOption({
  label,
  sub,
  checked,
  onClick,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13.5, color: TEXT_PRIMARY, fontWeight: 500 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: TEXT_MUTED }}>{sub}</span>
      </span>
      {checked && (
        <span style={{ display: 'flex', color: ACCENT }}>
          <CheckIcon size={15} />
        </span>
      )}
    </button>
  );
}

function DropdownList<T extends string>({
  items,
  active,
  onPick,
  onClose,
}: {
  items: readonly T[];
  active: T;
  onPick: (item: T) => void;
  onClose: () => void;
}) {
  return (
    <DropdownPanel onClose={onClose} align="right">
      {items.map((item) => {
        return <ListOption key={item} label={item} checked={item === active} onClick={() => onPick(item)} />;
      })}
    </DropdownPanel>
  );
}

function ListOption({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        fontSize: 13.5,
        color: TEXT_PRIMARY,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {checked && (
        <span style={{ display: 'flex', color: ACCENT }}>
          <CheckIcon size={15} />
        </span>
      )}
    </button>
  );
}

function DropdownPanel({
  children,
  onClose,
  align = 'left',
}: {
  children: React.ReactNode;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose]);
  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        [align]: 0,
        minWidth: 180,
        zIndex: 5,
        padding: 6,
        background: 'var(--cu-bg-menu, #222)',
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 10,
        boxShadow: 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.6))',
      }}
    >
      {children}
    </div>
  );
}
