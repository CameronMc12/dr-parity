import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--cu-accent)] text-white hover:bg-[var(--cu-accent-dark)] active:bg-[var(--cu-accent-dark)]',
  secondary:
    'bg-[var(--cu-bg-strong)] text-[var(--cu-text-primary)] hover:bg-[var(--cu-bg-hover)] border border-[var(--cu-border)]',
  ghost:
    'bg-transparent text-[var(--cu-text-secondary)] hover:bg-[var(--cu-bg-hover)] hover:text-[var(--cu-text-primary)]',
  danger:
    'bg-[var(--cu-status-red)] text-white hover:bg-red-700 active:bg-red-800',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-[11px] rounded-[var(--cu-radius-sm)]',
  md: 'h-8 px-4 text-xs rounded-[var(--cu-radius-md)]',
  lg: 'h-9 px-5 text-sm rounded-[var(--cu-radius-md)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-1.5 font-medium
        transition-colors duration-150 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';
