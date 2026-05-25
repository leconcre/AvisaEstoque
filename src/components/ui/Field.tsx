'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  kbd?: ReactNode;
  children: ReactNode;
}

export function Field({ label, hint, error, kbd, children }: FieldProps) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-2">
          {label}
        </span>
        {kbd}
      </div>
      <div
        className={[
          'rounded-md border bg-surface transition-[box-shadow,border-color] duration-150 ease-out',
          'focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]',
          error
            ? 'border-[var(--crit-border)] focus-within:border-[var(--crit)] focus-within:shadow-[0_0_0_3px_var(--crit-soft)]'
            : 'border-border',
        ].join(' ')}
      >
        {children}
      </div>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-[var(--crit)]" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[
        'block w-full bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-muted-2',
        'outline-none focus:outline-none focus-visible:!shadow-none',
        mono ? 'font-mono' : '',
        className,
      ].join(' ')}
      {...rest}
    />
  );
});
