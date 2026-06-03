'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/**
 * ClickUp-style popover menu primitive.
 *
 * Matches the live `cdk-menu` / `cu3-menu` overlay styling captured on
 * 2026-06-01 (docs/research/crawl/.../2026-06-01-home-deep/states/*):
 *   - popover: white bg, 1px border rgb(232,232,232), radius 8px,
 *     shadow 0 8px 24px rgba(0,0,0,.16), 6px vertical padding
 *   - item: 32px row, 8px h-padding, 8px gap, 13px label,
 *     icon 16px muted, right-aligned postscript / submenu chevron
 *   - heading: 11px uppercase-ish muted "Create" group label
 *   - divider: 1px rgb(232,232,232), 4px vertical margin
 *
 * Opens on trigger click, closes on outside-click / Escape. Leaf clicks call
 * `onSelect` then close. Submenu items open a nested flyout to the right.
 */

const MENU_BG = 'var(--cu-bg-menu, #fff)';
const MENU_BORDER = 'var(--cu-border-divider, rgb(232,232,232))';
const MENU_SHADOW = 'var(--cu-shadow-lg, 0 8px 24px rgba(0,0,0,.16))';
const TEXT_PRIMARY = 'var(--cu-text-primary, rgb(32,32,32))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(130,130,130))';
const HOVER_BG = 'var(--cu-bg-hover, rgb(244,244,244))';
const ACCENT = 'var(--cu-accent, #4ecdc4)';

// ── Popover positioning ──────────────────────────────────────────────────

type Placement = 'below' | 'above';

interface Anchor {
  rect: DOMRect;
  placement: Placement;
  align: 'left' | 'right';
}

const MenuCloseContext = createContext<() => void>(() => {});

function useOutsideClose(
  open: boolean,
  refs: Array<React.RefObject<HTMLElement | null>>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      for (const ref of refs) {
        if (ref.current?.contains(target)) return;
      }
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, refs, close]);
}

interface MenuProps {
  /** Render-prop trigger. Receives the ref + click handler to attach. */
  trigger: (args: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: (e: React.MouseEvent) => void;
    open: boolean;
  }) => ReactNode;
  children: ReactNode;
  /** Popover width in px. ClickUp create menu is ~280, section menus ~210. */
  width?: number;
  /** Horizontal edge to align the popover to the trigger. */
  align?: 'left' | 'right';
  /** Force placement; otherwise auto-flips when there's no room below. */
  placement?: Placement;
  /** Extra style for the popover surface. */
  surfaceStyle?: CSSProperties;
}

export function Menu({
  trigger,
  children,
  width = 240,
  align = 'left',
  placement,
  surfaceStyle,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, [triggerRef, surfaceRef], close);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const auto: Placement = spaceBelow < 320 ? 'above' : 'below';
    setAnchor({ rect, placement: placement ?? auto, align });
  }, [placement, align]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  const onTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  let surfacePos: CSSProperties = {};
  if (anchor) {
    const { rect, placement: pl, align: al } = anchor;
    const left = al === 'left' ? rect.left : rect.right - width;
    surfacePos =
      pl === 'below'
        ? { top: rect.bottom + 6, left }
        : { bottom: window.innerHeight - rect.top + 6, left };
  }

  return (
    <>
      {trigger({ ref: triggerRef, onClick: onTriggerClick, open })}
      {open && anchor && (
        <MenuCloseContext.Provider value={close}>
          <div
            ref={surfaceRef}
            role="menu"
            style={{
              position: 'fixed',
              zIndex: 9999,
              width,
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto',
              background: MENU_BG,
              border: `1px solid ${MENU_BORDER}`,
              borderRadius: 8,
              boxShadow: MENU_SHADOW,
              padding: '6px 0',
              boxSizing: 'border-box',
              font: 'var(--cu-font, -apple-system, "Segoe UI", Roboto, sans-serif)',
              animation: 'cuMenuIn 110ms ease',
              ...surfacePos,
              ...surfaceStyle,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </MenuCloseContext.Provider>
      )}
      <style>{`@keyframes cuMenuIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </>
  );
}

// ── Menu building blocks ─────────────────────────────────────────────────

export function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 14px 4px',
        fontSize: 12,
        fontWeight: 500,
        color: TEXT_MUTED,
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

export function MenuDivider() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `1px solid ${MENU_BORDER}`,
        margin: '4px 0',
      }}
    />
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  label: ReactNode;
  /** Right-aligned secondary text (keyboard shortcut, count). */
  postscript?: ReactNode;
  /** Sub-label beneath the main label. */
  description?: string;
  /** Right-side trailing element (badge / tag). */
  trailing?: ReactNode;
  /** Renders a submenu chevron and opens `submenu` to the right on hover/click. */
  submenu?: ReactNode;
  onSelect?: () => void;
  /** Skip auto-close after select (used by sticky toggles). */
  keepOpen?: boolean;
  /** Initial-highlight (matches captured `active` create-menu row). */
  active?: boolean;
}

export function MenuItem({
  icon,
  label,
  postscript,
  description,
  trailing,
  submenu,
  onSelect,
  keepOpen,
  active,
}: MenuItemProps) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (submenu) {
      setSubOpen((v) => !v);
      return;
    }
    onSelect?.();
    if (!keepOpen) close();
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => {
        setHover(true);
        if (submenu) setSubOpen(true);
      }}
      onMouseLeave={() => {
        setHover(false);
        if (submenu) setSubOpen(false);
      }}
    >
      <button
        ref={rowRef}
        role="menuitem"
        onClick={handle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: description ? 'flex-start' : 'center',
          gap: 8,
          padding: description ? '6px 14px' : '0 14px',
          minHeight: description ? 'auto' : 32,
          background: hover || active ? HOVER_BG : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: TEXT_PRIMARY,
          fontSize: 13,
          fontWeight: 400,
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        {icon != null && (
          <span
            style={{
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: TEXT_MUTED,
              marginTop: description ? 2 : 0,
            }}
          >
            {icon}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
            {trailing}
          </span>
          {description && (
            <span
              style={{
                display: 'block',
                fontSize: 12,
                color: TEXT_MUTED,
                marginTop: 1,
                whiteSpace: 'normal',
              }}
            >
              {description}
            </span>
          )}
        </span>
        {postscript != null && (
          <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>
            {postscript}
          </span>
        )}
        {submenu && (
          <span style={{ display: 'flex', color: TEXT_MUTED, flexShrink: 0 }}>
            <ChevronRightIcon />
          </span>
        )}
      </button>
      {submenu && subOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: -6,
            left: '100%',
            marginLeft: 4,
            minWidth: 200,
            background: MENU_BG,
            border: `1px solid ${MENU_BORDER}`,
            borderRadius: 8,
            boxShadow: MENU_SHADOW,
            padding: '6px 0',
            zIndex: 10000,
          }}
        >
          {submenu}
        </div>
      )}
    </div>
  );
}

interface MenuToggleProps {
  icon?: ReactNode;
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}

export function MenuToggle({ icon, label, checked, onChange }: MenuToggleProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        minHeight: 32,
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TEXT_PRIMARY,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {icon != null && (
        <span
          style={{
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: TEXT_MUTED,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      <Switch checked={checked} />
    </button>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 28,
        height: 16,
        borderRadius: 9999,
        background: checked ? ACCENT : 'var(--cu-border-strong, rgb(208,208,208))',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 140ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 14 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 140ms ease',
        }}
      />
    </span>
  );
}

// ── Bottom button row (Import / Templates) ───────────────────────────────

export function MenuButtonRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 12px 2px' }}>
      {children}
    </div>
  );
}

export function MenuOutlineButton({
  icon,
  label,
  onSelect,
}: {
  icon?: ReactNode;
  label: string;
  onSelect?: () => void;
}) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
        close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 32,
        background: hover ? HOVER_BG : 'transparent',
        border: `1px solid ${MENU_BORDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
    >
      {icon != null && (
        <span style={{ display: 'flex', color: TEXT_MUTED }}>{icon}</span>
      )}
      {label}
    </button>
  );
}

// ── Inline icons (sprite lacks most of these) ────────────────────────────

export function ChevronRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
