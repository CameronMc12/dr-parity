'use client';

/**
 * Slim bar shown above an active embed. Displays the current source and real
 * actions: Reload (key-remount the iframe), Open in new tab (URL sources only),
 * and Edit source (reopen the source-config popover). Every button has a hover
 * state + tooltip.
 */

import { useState, type ReactNode } from 'react';
import { GlobeIcon, ReloadIcon, ExternalLinkIcon, PencilIcon } from './embed-icons';
import { EMBED } from './tokens';

export function EmbedUrlBar({
  display,
  href,
  isUrl,
  onReload,
  onEdit,
}: {
  display: string;
  href: string;
  isUrl: boolean;
  onReload: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      data-testid="embed-url-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: EMBED.urlBarHeight,
        padding: '0 12px 0 16px',
        borderBottom: `1px solid ${EMBED.border}`,
        background: EMBED.bg,
        flexShrink: 0,
      }}
    >
      <span style={{ color: EMBED.textMuted, display: 'inline-flex', flexShrink: 0 }}>
        <GlobeIcon size={14} />
      </span>

      <span
        title={href}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: EMBED.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {display}
      </span>

      <BarButton label="Reload" onClick={onReload}>
        <ReloadIcon />
      </BarButton>
      {isUrl && (
        <BarLink label="Open in new tab" href={href}>
          <ExternalLinkIcon />
        </BarLink>
      )}
      <BarButton label="Edit source" onClick={onEdit}>
        <PencilIcon />
      </BarButton>
    </div>
  );
}

function barStyle(hover: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: hover ? EMBED.hover : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: hover ? EMBED.textPrimary : EMBED.textSecondary,
    transition: EMBED.transition,
    flexShrink: 0,
    textDecoration: 'none',
  };
}

function BarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={barStyle(hover)}
    >
      {children}
    </button>
  );
}

function BarLink({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <a
      aria-label={label}
      title={label}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={barStyle(hover)}
    >
      {children}
    </a>
  );
}
