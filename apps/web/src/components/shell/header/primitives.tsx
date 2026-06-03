'use client';

/**
 * Shared building blocks for the project-header action cluster: the 24px icon
 * button (matches TopBar's hit target + hover), a presence avatar bubble, a
 * fixed-anchored popover surface (reuses the Menu surface look + outside/Escape
 * close), plus small form controls reused inside the Share / Automations panels.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { CaretIcon } from './icons';

const POPOVER_KEYFRAMES =
  '@keyframes cuMenuIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}';

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';
const INPUT_BG = 'var(--cu-bg-input, #f7f7f7)';
const BORDER = 'var(--cu-border, rgb(232,232,232))';

// ── 24px icon button (mirrors TopBar IconButton) ─────────────────────────

export const HeaderIconButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    active?: boolean;
    caret?: boolean;
    width?: number;
    onClick?: (e: React.MouseEvent) => void;
    children: ReactNode;
  }
>(function HeaderIconButton(
  { label, active = false, caret = false, width = 24, onClick, children },
  ref,
) {
  const [hover, setHover] = useState(false);
  const lit = hover || active;
  return (
    <button
      ref={ref}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 24,
        minWidth: width,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: caret ? 2 : 0,
        padding: caret ? '0 4px' : 0,
        background: lit ? HOVER_BG : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: active ? TEXT_PRIMARY : lit ? TEXT_PRIMARY : TEXT_MUTED,
        flexShrink: 0,
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
      {caret && (
        <span style={{ display: 'flex', color: 'inherit' }}>
          <CaretIcon size={11} />
        </span>
      )}
    </button>
  );
});

// ── Presence avatar bubble (initials, member colour) ─────────────────────

export function MemberBubble({
  initials,
  color,
  size = 24,
  online = false,
  ring = false,
}: {
  initials: string;
  color: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontSize: Math.round(size * 0.42),
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: ring ? '0 0 0 2px var(--cu-bg-topbar, #fff)' : undefined,
          userSelect: 'none',
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
      {online && (
        <span
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: Math.max(7, Math.round(size * 0.3)),
            height: Math.max(7, Math.round(size * 0.3)),
            borderRadius: '50%',
            background: 'var(--cu-status-green, #2bc46d)',
            border: '2px solid var(--cu-bg-menu, #fff)',
          }}
        />
      )}
    </span>
  );
}

// ── Fixed-anchored popover surface ───────────────────────────────────────

type Align = 'left' | 'right';

interface AnchorRect {
  rect: DOMRect;
  align: Align;
}

/**
 * Anchors a fixed-position surface under a trigger ref, flipping/clamping into
 * the viewport, and closing on outside-pointerdown / Escape. Used by every
 * header popover and panel so they share one positioning + dismissal model.
 */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function HeaderPopover({
  open,
  onClose,
  triggerRef,
  width,
  align = 'right',
  children,
  surfaceStyle,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  width: number;
  align?: Align;
  children: ReactNode;
  surfaceStyle?: CSSProperties;
  labelledBy?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    setAnchor({ rect: el.getBoundingClientRect(), align });
  }, [triggerRef, align]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const handler = () => measure();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (surfaceRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, triggerRef]);

  // Move focus into the surface on open; restore to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const frame = requestAnimationFrame(() => {
      const first = surfaceRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [open, triggerRef]);

  if (!open || !anchor) return null;

  const { rect } = anchor;
  const rawLeft = align === 'left' ? rect.left : rect.right - width;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8));

  return (
    <>
      <style>{POPOVER_KEYFRAMES}</style>
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          zIndex: 9999,
          top: rect.bottom + 8,
          left,
          width,
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: MENU_BG,
          border: `1px solid ${MENU_BORDER}`,
          borderRadius: 10,
          boxShadow: MENU_SHADOW,
          boxSizing: 'border-box',
          fontFamily: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
          color: TEXT_PRIMARY,
          animation: 'cuMenuIn 110ms ease',
          ...surfaceStyle,
        }}
      >
        {children}
      </div>
    </>
  );
}

// ── Centered modal surface (backdrop-dimmed) ─────────────────────────────

/**
 * A screen-centered modal with a dimmed backdrop. Mirrors ClickUp's Share
 * dialog: not anchored to the trigger, closes on backdrop-click / Escape, and
 * traps initial focus inside. Restores focus to the trigger on close.
 */
export function CenterModal({
  open,
  onClose,
  triggerRef,
  width,
  children,
  labelledBy,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  width: number;
  children: ReactNode;
  labelledBy?: string;
  footer?: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const frame = requestAnimationFrame(() => {
      const first = surfaceRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [open, triggerRef]);

  if (!open) return null;

  return (
    <>
      <style>{POPOVER_KEYFRAMES}</style>
      <div
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--cu-overlay, rgba(0,0,0,.55))',
          fontFamily: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
          color: TEXT_PRIMARY,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width, maxWidth: '100%' }}>
          <div
            ref={surfaceRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: 'calc(100vh - 96px)',
              overflowY: 'auto',
              background: MENU_BG,
              border: `1px solid ${MENU_BORDER}`,
              borderRadius: 14,
              boxShadow: MENU_SHADOW,
              boxSizing: 'border-box',
              animation: 'cuMenuIn 120ms ease',
            }}
          >
            {children}
          </div>
          {footer}
        </div>
      </div>
    </>
  );
}

// ── Toggle switch (pill) ─────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 34,
        height: 20,
        flexShrink: 0,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        background: checked ? 'var(--cu-status-purple, rgb(92,71,205))' : 'var(--cu-border-strong, #555)',
        transition: 'background 120ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 120ms ease',
          boxShadow: '0 1px 2px rgba(0,0,0,.3)',
        }}
      />
    </button>
  );
}

// ── Small shared controls ────────────────────────────────────────────────

export function PanelHeader({
  icon,
  title,
  titleId,
  onClose,
}: {
  icon?: ReactNode;
  title: string;
  titleId?: string;
  onClose?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderBottom: `1px solid ${MENU_BORDER}`,
      }}
    >
      {icon && <span style={{ display: 'flex', color: TEXT_MUTED }}>{icon}</span>}
      <span id={titleId} style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
        {title}
      </span>
      {onClose && (
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            borderRadius: 4,
            cursor: 'pointer',
            color: TEXT_MUTED,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  full = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  full?: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: full ? '100%' : undefined,
        height: 32,
        padding: '0 14px',
        background: disabled ? 'var(--cu-border-strong, #d0d0d0)' : ACCENT,
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: hover && !disabled ? 0.92 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  active = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        background: active || hover ? HOVER_BG : 'transparent',
        color: TEXT_PRIMARY,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        height: 32,
        padding: '0 10px',
        background: INPUT_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        fontSize: 13,
        color: TEXT_PRIMARY,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}

export function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        height: 32,
        padding: '0 8px',
        background: INPUT_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        fontSize: 13,
        color: TEXT_PRIMARY,
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  );
}

export const headerTokens = {
  TEXT_PRIMARY,
  TEXT_MUTED,
  HOVER_BG,
  ACCENT,
  BORDER,
  MENU_BORDER,
  INPUT_BG,
};
