'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, PlusSquare, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Logo } from '@/components/brand/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface AppShellProps {
  children: ReactNode;
  user: { name: string; companyName: string; plan: 'BASIC' | 'PRO' };
  signOutAction: () => Promise<void> | void;
}

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Painel',     icon: LayoutDashboard },
  { href: '/batches',     label: 'Lotes',      icon: Package },
  { href: '/batches/new', label: 'Cadastrar',  icon: PlusSquare },
  { href: '/assistant',   label: 'Assistente', icon: Sparkles },
  { href: '/settings',    label: 'Configurações', icon: Settings },
];

export function AppShell({ children, user, signOutAction }: AppShellProps) {
  const pathname = usePathname();
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar — ≥1024px (HANDOFF §4.9) */}
      <aside className="hidden w-[232px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="px-5 pt-6 pb-3">
          <Logo size={28} withWordmark />
        </div>

        <div className="mx-4 mt-2 rounded-lg border border-border bg-[var(--brand-soft)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--brand-fg)]">Empresa</p>
            {user.plan === 'PRO' ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                <Sparkles className="h-2.5 w-2.5" /> PRO
              </span>
            ) : (
              <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
                BASIC
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium text-fg" title={user.companyName}>
            {user.companyName}
          </p>
        </div>

        <nav className="mt-4 flex-1 px-3">
          {NAV.map((it) => {
            const Icon = it.icon;
            const active = pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[var(--brand-soft)] font-semibold text-[var(--brand-fg)]'
                    : 'text-fg-2 hover:bg-[var(--brand-soft)]/60 hover:text-[var(--brand-fg)]',
                ].join(' ')}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.75} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="m-3 mt-4 rounded-md border border-border bg-background p-3 text-xs leading-snug text-muted">
          <p className="font-medium text-fg-2">Dica</p>
          <p className="mt-1">
            Pressione <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px] border border-border">N</kbd> em qualquer tela para cadastrar um lote rapidinho.
          </p>
        </div>

        <form action={signOutAction} className="border-t border-border p-3">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-muted hover:bg-background hover:text-fg-2"
          >
            Sair
          </button>
        </form>
      </aside>

      {/* Corpo */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* TopBar sticky */}
        <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between px-5 lg:px-8">
            <div className="lg:hidden">
              <Logo size={24} withWordmark />
            </div>
            <h2 className="hidden text-sm font-medium text-fg-2 lg:block">
              {/* placeholder — cada página seta o title via metadata; aqui é só ambientação */}
            </h2>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <span
                aria-hidden
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand-fg)] sm:flex"
              >
                {initials || 'U'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 pb-24 lg:px-8 lg:pb-8">{children}</main>

        {/* BottomNav — <1024px (HANDOFF §4.9) */}
        <nav className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-5 border-t border-border bg-surface lg:hidden">
          {NAV.map((it) => {
            const Icon = it.icon;
            const active = pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors',
                  active ? 'text-[var(--brand-fg)]' : 'text-muted hover:text-fg-2',
                ].join(' ')}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
