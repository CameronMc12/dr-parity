'use client';

import * as Switch from '@radix-ui/react-switch';

const ON = 'rgb(22, 199, 132)';
const OFF = 'var(--cu-border-strong, rgb(208,208,208))';

/** Right-aligned ClickUp-style toggle switch used in the ellipsis menu. */
export function SidebarToggle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      style={{
        all: 'unset',
        width: 30,
        height: 18,
        borderRadius: 9999,
        background: checked ? ON : OFF,
        position: 'relative',
        flexShrink: 0,
        cursor: 'pointer',
        transition: 'background 140ms ease',
        boxSizing: 'border-box',
      }}
    >
      <Switch.Thumb
        style={{
          display: 'block',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'transform 140ms ease',
          transform: checked ? 'translateX(14px)' : 'translateX(2px)',
          willChange: 'transform',
        }}
      />
    </Switch.Root>
  );
}
