'use client';

/**
 * EmbedCard — surfaces an external URL inside the dashboard. When a URL is set
 * (card.config.url) it renders live in a sandboxed iframe; otherwise it shows an
 * in-card form to add one, which persists to the card config via the store. The
 * URL is normalised (https:// prefixed) before saving so bare hosts still load.
 */

import { useState } from 'react';
import { useDashboardActions } from '@/store/dashboard/hooks';
import { DASH } from '../tokens';
import type { CardRenderProps } from './card-props';

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function UrlForm({
  onSave,
  initial = '',
}: {
  onSave: (url: string) => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  const valid = normalizeUrl(value) !== null;

  function submit() {
    const url = normalizeUrl(value);
    if (url) onSave(url);
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 18,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: DASH.textSecondary }}>
        Embed a page
      </span>
      <span style={{ fontSize: 12, color: DASH.textMuted }}>
        Paste a URL to render it inside this card.
      </span>
      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="https://example.com"
          aria-label="Embed URL"
          style={{
            flex: 1,
            height: 30,
            padding: '0 10px',
            fontSize: 13,
            color: DASH.textPrimary,
            background: DASH.bg,
            border: `1px solid ${DASH.border}`,
            borderRadius: DASH.radiusSm,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submit}
          disabled={!valid}
          style={{
            height: 30,
            padding: '0 14px',
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            background: DASH.accent,
            border: 'none',
            borderRadius: DASH.radiusSm,
            cursor: valid ? 'pointer' : 'not-allowed',
            opacity: valid ? 1 : 0.5,
            fontFamily: 'inherit',
          }}
        >
          Embed
        </button>
      </div>
    </div>
  );
}

export function EmbedCard({ card, viewId }: CardRenderProps) {
  const { updateCardConfig } = useDashboardActions();
  const url = card.config?.url?.trim();

  const save = (next: string) =>
    updateCardConfig(viewId, card.id, { url: next });

  if (!url) {
    return <UrlForm onSave={save} />;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          minHeight: 30,
          borderBottom: `1px solid ${DASH.border}`,
          flexShrink: 0,
        }}
      >
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1,
            fontSize: 11,
            color: DASH.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </a>
        <button
          onClick={() => save('')}
          aria-label="Change embed URL"
          style={{
            fontSize: 11,
            color: DASH.accent,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Change
        </button>
      </div>
      <iframe
        src={url}
        title={card.title}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
      />
    </div>
  );
}
