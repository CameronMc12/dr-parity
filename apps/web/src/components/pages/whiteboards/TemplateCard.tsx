'use client';

import { useState, type ReactNode } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_MUTED } from '../page-primitives';

interface TemplateCardProps {
  illo: ReactNode;
  title: string;
  description: string;
}

/** A single Templates-row card: tinted icon badge + title + one-line description. */
export function TemplateCard({ illo, title, description }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flex: 1,
        minWidth: 0,
        padding: '14px 18px',
        background: hovered ? 'rgb(250, 250, 251)' : 'rgb(255, 255, 255)',
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          background: 'rgb(247, 247, 248)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {illo}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12.5,
            color: TEXT_MUTED,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </span>
      </span>
    </button>
  );
}
