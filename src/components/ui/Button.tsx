'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};

const variants: Record<Variant, string> = {
  primary:
    'ray text-white font-medium ' +
    "bg-[linear-gradient(180deg,oklch(0.62_0.20_155),oklch(0.55_0.18_155))] " +
    'hover:brightness-105 active:translate-y-[0.5px] ' +
    'shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'ray text-fg bg-surface border border-border ' +
    'hover:bg-[var(--brand-soft)] hover:text-[var(--brand-fg)] hover:border-[var(--brand-border,var(--border-strong))] ' +
    'active:translate-y-[0.5px] disabled:opacity-50',
  ghost:
    'text-fg-2 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-fg)] ' +
    'active:translate-y-[0.5px] disabled:opacity-50',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, disabled, children, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md transition-[filter,box-shadow,transform,background-color,color,border-color] duration-150 ease-out',
        sizes[size],
        variants[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      ) : (
        icon
      )}
      <span>{children}</span>
      {iconRight}
    </button>
  );
});
