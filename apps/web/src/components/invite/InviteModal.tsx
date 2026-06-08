'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useUiStore } from '@/store/ui-store';

const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const BORDER_STRONG = 'var(--cu-border-strong, rgb(200,200,200))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const APP_BG = 'var(--cu-bg-app, #fff)';
const PRIMARY_BTN_BG = 'var(--cu-text-primary, rgb(24,24,24))';

type Role = 'member' | 'admin' | 'guest';

const ROLES: { value: Role; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
  { value: 'guest', label: 'Guest' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_LINK = 'https://app.clickup.com/invite/90152566819';

/**
 * Global Invite-members modal. ClickUp-style centered card: email input that
 * collects multiple addresses as chips, a role select, a "Copy invite link"
 * row, and a Send button. UI-only — wired to ui-store, no backend.
 */
export function InviteModal() {
  const open = useUiStore((s) => s.inviteOpen);
  const close = useUiStore((s) => s.closeInvite);

  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEmails([]);
    setDraft('');
    setRole('member');
    setCopied(false);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!open) return null;

  function addEmail(raw: string) {
    const value = raw.trim().replace(/,$/, '');
    if (!value) return;
    if (!EMAIL_RE.test(value)) return;
    setEmails((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setDraft('');
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  function onDraftKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addEmail(draft);
    } else if (e.key === 'Backspace' && draft === '' && emails.length > 0) {
      const last = emails[emails.length - 1];
      if (last) removeEmail(last);
    }
  }

  function copyLink() {
    void navigator.clipboard?.writeText(INVITE_LINK);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const pending = draft.trim() ? 1 : 0;
  const canSend = emails.length + pending > 0;

  function send() {
    if (draft.trim()) addEmail(draft);
    // UI-only: no backend. Close after "sending".
    close();
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10060,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      <div
        role="dialog"
        aria-label="Invite members"
        aria-modal="true"
        data-testid="invite-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--cu-bg-menu, #fff)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          border: `1px solid ${BORDER}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 18px 8px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>
            Invite people to your Workspace
          </h2>
          <span style={{ flex: 1 }} />
          <button
            aria-label="Close"
            onClick={close}
            style={iconBtn}
            onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <CloseGlyph />
          </button>
        </div>

        {/* Email chips + input + role */}
        <div style={{ padding: '6px 18px 4px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div
            onClick={() => inputRef.current?.focus()}
            style={{
              flex: 1,
              minHeight: 40,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              border: `1px solid ${BORDER_STRONG}`,
              borderRadius: 8,
              cursor: 'text',
            }}
          >
            {emails.map((email) => (
              <span
                key={email}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 24,
                  padding: '0 6px 0 10px',
                  background: HOVER_BG,
                  borderRadius: 6,
                  fontSize: 13,
                  color: TEXT_PRIMARY,
                }}
              >
                {email}
                <button
                  aria-label={`Remove ${email}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEmail(email);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: TEXT_MUTED,
                    display: 'inline-flex',
                    padding: 0,
                  }}
                >
                  <CloseGlyph size={12} />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onDraftKeyDown}
              onBlur={() => addEmail(draft)}
              placeholder={emails.length === 0 ? 'Enter email addresses' : ''}
              aria-label="Email address"
              data-testid="invite-email-input"
              style={{
                flex: 1,
                minWidth: 140,
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: TEXT_PRIMARY,
                background: 'transparent',
                fontFamily: 'inherit',
                height: 24,
              }}
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            aria-label="Role"
            data-testid="invite-role-select"
            style={{
              height: 40,
              padding: '0 10px',
              border: `1px solid ${BORDER_STRONG}`,
              borderRadius: 8,
              background: APP_BG,
              color: TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Copy invite link row */}
        <div style={{ padding: '8px 18px 4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
            }}
          >
            <span style={{ color: TEXT_MUTED, display: 'inline-flex' }}>
              <LinkGlyph />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                Invite link
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 12,
                  color: TEXT_MUTED,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {INVITE_LINK}
              </span>
            </span>
            <button
              onClick={copyLink}
              data-testid="invite-copy-link"
              style={ghostBtn}
              onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            marginTop: 6,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span style={{ flex: 1 }} />
          <button onClick={close} style={ghostBtn}>
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!canSend}
            data-testid="invite-send"
            style={{
              ...primaryBtn,
              opacity: canSend ? 1 : 0.45,
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
          >
            Send invite
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: TEXT_MUTED,
};

const ghostBtn: CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  cursor: 'pointer',
  color: TEXT_PRIMARY,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
  height: 34,
  padding: '0 16px',
  borderRadius: 8,
  border: 'none',
  background: PRIMARY_BTN_BG,
  color: APP_BG,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
};

function CloseGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function LinkGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
