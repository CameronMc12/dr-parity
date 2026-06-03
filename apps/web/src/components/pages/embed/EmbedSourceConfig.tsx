'use client';

/**
 * Source-config popover — the panel ClickUp opens from "Edit source" / "Connect
 * a URL or source". It anchors to its trigger, closes on outside-click / Escape,
 * and lets the user choose the embed mode and supply the source.
 *
 * Modes mirror ClickUp's embed source options:
 *   - "Website URL"  → paste an http(s) link, framed via an iframe `src`
 *   - "Embed code"   → paste raw HTML / an `<iframe …>` snippet, framed via srcdoc
 *
 * On apply the parent swaps the empty state for the live embed. Fully wired:
 * no dead controls.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeEmbedUrl } from './embed-url';
import { EMBED } from './tokens';

export type EmbedSourceKind = 'url' | 'html';

export interface EmbedSource {
  kind: EmbedSourceKind;
  /** For kind="url": the normalised http(s) href. For kind="html": raw markup. */
  value: string;
}

interface Anchor {
  top: number;
  left: number;
}

export function EmbedSourceConfig({
  anchorRef,
  initial,
  onClose,
  onApply,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  initial: EmbedSource | null;
  onClose: () => void;
  onApply: (source: EmbedSource) => void;
}) {
  const [kind, setKind] = useState<EmbedSourceKind>(initial?.kind ?? 'url');
  const [value, setValue] = useState(initial?.value ?? '');
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Position centered above the trigger button, like the capture's popover.
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAnchor({ top: r.top - 12, left: r.left + r.width / 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef]);

  // Outside-click + Escape close.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (surfaceRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchorRef, onClose]);

  const apply = () => {
    if (kind === 'url') {
      const normalized = normalizeEmbedUrl(value);
      if (!normalized) {
        setError('Enter a valid web address, like https://clickup.com');
        return;
      }
      onApply({ kind: 'url', value: normalized.href });
      return;
    }
    const markup = value.trim();
    if (!markup) {
      setError('Paste an embed code or HTML snippet');
      return;
    }
    onApply({ kind: 'html', value: markup });
  };

  if (anchor == null) return null;

  return createPortal(
    <div
      ref={surfaceRef}
      data-testid="embed-source-config"
      role="dialog"
      aria-label="Embed source"
      style={{
        position: 'fixed',
        top: anchor.top,
        left: anchor.left,
        transform: 'translate(-50%, -100%)',
        width: EMBED.configWidth,
        background: EMBED.panel,
        border: `1px solid ${EMBED.border}`,
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        padding: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: EMBED.textPrimary }}>Embed source</div>

      <SourceTabs
        kind={kind}
        onChange={(next) => {
          setKind(next);
          setError(null);
        }}
      />

      {kind === 'url' ? (
        <input
          data-testid="embed-url-input"
          autoFocus
          value={value}
          placeholder="https://example.com"
          aria-label="Website URL"
          aria-invalid={error != null}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
          style={inputStyle(error != null)}
        />
      ) : (
        <textarea
          data-testid="embed-html-input"
          autoFocus
          value={value}
          placeholder='Paste an <iframe …> or HTML snippet'
          aria-label="Embed code"
          aria-invalid={error != null}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          rows={5}
          style={{ ...inputStyle(error != null), height: 'auto', padding: 10, resize: 'vertical' }}
        />
      )}

      {error && (
        <span data-testid="embed-error" style={{ fontSize: 12, color: 'rgb(229, 84, 84)' }}>
          {error}
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <GhostButton label="Cancel" onClick={onClose} />
        <PrimaryButton label="Embed" onClick={apply} />
      </div>
    </div>,
    document.body,
  );
}

function SourceTabs({
  kind,
  onChange,
}: {
  kind: EmbedSourceKind;
  onChange: (kind: EmbedSourceKind) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        background: EMBED.input,
        border: `1px solid ${EMBED.border}`,
        borderRadius: 8,
      }}
    >
      <SourceTab label="Website URL" active={kind === 'url'} onClick={() => onChange('url')} />
      <SourceTab label="Embed code" active={kind === 'html'} onClick={() => onChange('html')} />
    </div>
  );
}

function SourceTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        height: 30,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: active ? EMBED.panel : 'transparent',
        color: active ? EMBED.textPrimary : EMBED.textSecondary,
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
        transition: EMBED.transition,
      }}
    >
      {label}
    </button>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: '100%',
    minWidth: 0,
    height: 36,
    padding: '0 12px',
    background: EMBED.input,
    border: `1px solid ${invalid ? 'rgb(229, 84, 84)' : EMBED.border}`,
    borderRadius: 6,
    outline: 'none',
    color: EMBED.textPrimary,
    fontSize: 13,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
}

function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="embed-submit"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 32,
        padding: '0 16px',
        background: EMBED.accent,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        opacity: hover ? 0.9 : 1,
        transition: 'opacity 120ms',
      }}
    >
      {label}
    </button>
  );
}

function GhostButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 32,
        padding: '0 14px',
        background: hover ? EMBED.hover : 'transparent',
        border: `1px solid ${EMBED.border}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: EMBED.textSecondary,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: EMBED.transition,
      }}
    >
      {label}
    </button>
  );
}
