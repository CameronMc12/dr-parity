import * as Tooltip from '@radix-ui/react-tooltip';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active = false, size = 'md', className = '', children, ...props }, ref) => {
    const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
    const activeClass = active
      ? 'bg-[var(--cu-bg-active)] text-[var(--cu-text-primary)]'
      : 'text-[var(--cu-text-muted)] hover:bg-[var(--cu-bg-hover)] hover:text-[var(--cu-text-primary)]';

    return (
      <Tooltip.Provider delayDuration={400}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              ref={ref}
              aria-label={label}
              className={`
                ${sizeClass} flex items-center justify-center rounded-[var(--cu-radius-md)]
                transition-colors duration-150 cursor-pointer shrink-0
                ${activeClass}
                ${className}
              `.trim()}
              {...props}
            >
              {children}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              className="
                z-50 px-2 py-1 text-xs rounded-[var(--cu-radius-sm)]
                bg-[var(--cu-bg-tooltip)] text-[var(--cu-text-primary)]
                shadow-[var(--cu-shadow-md)] select-none
                animate-in fade-in-0 zoom-in-95
              "
            >
              {label}
              <Tooltip.Arrow className="fill-[var(--cu-bg-tooltip)]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }
);

IconButton.displayName = 'IconButton';
