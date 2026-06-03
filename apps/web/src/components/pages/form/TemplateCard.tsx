'use client';

/**
 * A single template card on the "Create a Form" chooser. Renders a colour-tinted
 * icon tile, the template name, and a one-line blurb. The "Start from scratch"
 * variant reuses the same shell with a neutral dashed border and a + glyph.
 */

import { useState } from 'react';
import type { FormTemplate } from './form-templates';
import { TemplateGlyph, ScratchPlusGlyph } from './template-glyphs';
import { FORM_TOKENS as T, HOVER_TRANSITION } from './tokens';

interface CardShellProps {
  hover: boolean;
  dashed?: boolean;
  onClick: () => void;
  onHoverChange: (h: boolean) => void;
  children: React.ReactNode;
}

function CardShell({ hover, dashed, onClick, onHoverChange, children }: CardShellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        textAlign: 'left',
        padding: '18px 18px 20px',
        borderRadius: T.radiusLg,
        border: dashed ? `1.5px dashed ${T.borderStrong}` : `1px solid ${T.border}`,
        background: hover ? T.bgHover : T.bgCard,
        boxShadow: hover ? T.shadowMd : 'none',
        cursor: 'pointer',
        fontFamily: T.font,
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: `${HOVER_TRANSITION}, box-shadow 120ms ease, transform 120ms ease`,
      }}
    >
      {children}
    </button>
  );
}

function IconTile({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: `linear-gradient(160deg, color-mix(in srgb, ${color} 24%, #fff), color-mix(in srgb, ${color} 14%, #fff))`,
        color,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function CardText({ name, blurb }: { name: string; blurb?: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, lineHeight: 1.3 }}>{name}</span>
      {blurb ? (
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: T.textMuted }}>{blurb}</span>
      ) : null}
    </span>
  );
}

export function TemplateCard({ template, onSelect }: { template: FormTemplate; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <CardShell hover={hover} onClick={onSelect} onHoverChange={setHover}>
      <IconTile color={template.color}>
        <TemplateGlyph template={template.id as Exclude<typeof template.id, 'scratch'>} />
      </IconTile>
      <CardText name={template.name} blurb={template.blurb} />
    </CardShell>
  );
}

export function ScratchCard({ onSelect }: { onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <CardShell hover={hover} dashed onClick={onSelect} onHoverChange={setHover}>
      <IconTile color={T.textSecondary}>
        <ScratchPlusGlyph />
      </IconTile>
      <CardText name="Start from scratch" />
    </CardShell>
  );
}
