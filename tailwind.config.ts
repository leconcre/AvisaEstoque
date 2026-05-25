import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        fg: 'var(--fg)',
        'fg-2': 'var(--fg-2)',
        muted: 'var(--muted)',
        'muted-2': 'var(--muted-2)',
        brand: 'var(--brand)',
        'brand-hover': 'var(--brand-hover)',
        'brand-soft': 'var(--brand-soft)',
        'brand-fg': 'var(--brand-fg)',
        crit: 'var(--crit)',
        'crit-soft': 'var(--crit-soft)',
        'crit-border': 'var(--crit-border)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        'warn-border': 'var(--warn-border)',
        safe: 'var(--safe)',
        'safe-soft': 'var(--safe-soft)',
        'safe-border': 'var(--safe-border)',
        exp: 'var(--exp)',
        'exp-soft': 'var(--exp-soft)',
        'exp-border': 'var(--exp-border)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};

export default config;
