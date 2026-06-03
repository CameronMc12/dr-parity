'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/**
 * Lightweight click-anchored popover for the task panel's meta-field editors
 * (status / priority / assignee / date). Mirrors the styling of the shared
 * `Menu` primitive but exposes a controlled open/close so each field can render
 * arbitrary content (lists, a calendar, a member picker).
 */

interface PopoverProps {
  trigger: (args: { onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  align?: 'left' | 'right';
}

export function Popover({ trigger, children, width = 240, align = 'left' }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLSpanElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const measure = useCallback(() => {
    const el = triggerRef.current?.firstElementChild ?? triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const left = align === 'left' ? rect.left : rect.right - width;
    setPos(
      spaceBelow < 300
        ? { bottom: window.innerHeight - rect.top + 6, left }
        : { top: rect.bottom + 6, left },
    );
  }, [align, width]);

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

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || surfaceRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  return (
    <>
      <span ref={triggerRef} style={{ display: 'contents' }}>
        {trigger({ onClick: (e) => { e.stopPropagation(); setOpen((v) => !v); }, open })}
      </span>
      {open && (
        <div
          ref={surfaceRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            zIndex: 9999,
            width,
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
            background: 'var(--cu-bg-menu, #222)',
            border: '1px solid var(--cu-border-divider, #333)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
            padding: '6px 0',
            boxSizing: 'border-box',
            animation: 'cuMenuIn 110ms ease',
            ...pos,
          }}
        >
          {children(close)}
        </div>
      )}
    </>
  );
}
