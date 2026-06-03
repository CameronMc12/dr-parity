'use client';

/**
 * Overlay shown when an embedded site appears to block framing (no `load` fired
 * within the timeout). Non-destructive: it floats over the still-mounted iframe
 * so a slow-but-allowed site keeps loading underneath, while a genuinely blocked
 * one gets a clear open-in-new-tab fallback and a retry.
 */

import { useState } from 'react';
import { AlertIcon, ExternalLinkIcon } from './embed-icons';
import { EMBED } from './tokens';

export function EmbedBlockedNote({ href, onRetry }: { href: string; onRetry: () => void }) {
  return (
    <div
      data-testid="embed-blocked"
      role="status"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: EMBED.bg,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          textAlign: 'center',
        }}
      >
        <span style={{ color: EMBED.textMuted }}>
          <AlertIcon size={34} />
        </span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: EMBED.textPrimary }}>
          This site can&rsquo;t be embedded
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: EMBED.textMuted, lineHeight: 1.5 }}>
          Some pages block being shown inside another app. You can still open it in a new tab.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <OpenInTabButton href={href} />
          <RetryButton onClick={onRetry} />
        </div>
      </div>
    </div>
  );
}

function OpenInTabButton({ href }: { href: string }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      data-testid="embed-blocked-open"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 34,
        padding: '0 16px',
        background: EMBED.accent,
        border: 'none',
        borderRadius: 6,
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        cursor: 'pointer',
        opacity: hover ? 0.9 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <ExternalLinkIcon size={14} />
      Open in new tab
    </a>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 34,
        padding: '0 16px',
        background: hover ? EMBED.hover : 'transparent',
        border: `1px solid ${EMBED.border}`,
        borderRadius: 6,
        color: EMBED.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: EMBED.transition,
      }}
    >
      Try again
    </button>
  );
}
