'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, ShieldCheck, XCircle } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

import type { BatchStatus } from '@/lib/utils/batch-status';

interface StatCardProps {
  status: BatchStatus;
  count: number;
  label: string;
  desc: string;
  href: string;
}

const cfg: Record<BatchStatus, {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  soft: string;
  border: string;
  solid: string;
  iconColor: string;
  numberColor: string;
}> = {
  CRITICAL: {
    icon: AlertTriangle,
    soft: 'bg-[var(--crit-soft)]',
    border: 'border-[var(--crit-border)]',
    solid: 'bg-[var(--crit)]',
    iconColor: 'text-[var(--crit)]',
    numberColor: 'text-[var(--crit)]',
  },
  WARNING: {
    icon: Clock,
    soft: 'bg-[var(--warn-soft)]',
    border: 'border-[var(--warn-border)]',
    solid: 'bg-[var(--warn)]',
    iconColor: 'text-[oklch(0.45_0.17_75)]',
    numberColor: 'text-[oklch(0.45_0.17_75)]',
  },
  SAFE: {
    icon: ShieldCheck,
    soft: 'bg-[var(--safe-soft)]',
    border: 'border-[var(--safe-border)]',
    solid: 'bg-[var(--safe)]',
    iconColor: 'text-[var(--safe)]',
    numberColor: 'text-[var(--safe)]',
  },
  EXPIRED: {
    icon: XCircle,
    soft: 'bg-[var(--exp-soft)]',
    border: 'border-[var(--exp-border)]',
    solid: 'bg-[var(--exp)]',
    iconColor: 'text-[var(--exp)]',
    numberColor: 'text-[var(--exp)]',
  },
};

export function StatCard({ status, count, label, desc, href }: StatCardProps) {
  const c = cfg[status];
  const Icon = c.icon;
  const showCritDot = status === 'CRITICAL' && count > 0;

  return (
    <Link
      href={href}
      className="group relative block rounded-lg border border-border bg-surface p-5 shadow-sm transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-md focus-visible:outline-none"
    >
      {/* Crit badge: ancorado em -5/-5 com anel duplo (HANDOFF §4.14) */}
      {showCritDot && (
        <span
          aria-hidden
          className="pulse-crit absolute -top-[5px] -right-[5px] h-3 w-3 rounded-full bg-[var(--crit)]"
          style={{ boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px var(--crit-border)' }}
        />
      )}

      <div className="flex items-start gap-3">
        <span
          className={['flex h-[34px] w-[34px] items-center justify-center rounded-lg border', c.soft, c.border].join(' ')}
          aria-hidden
        >
          <Icon className={[c.iconColor, 'h-[18px] w-[18px]'].join(' ')} strokeWidth={1.75} />
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-2">
            {label}
          </span>
          <span className={['mt-1 font-mono text-3xl font-semibold tabular-nums', c.numberColor].join(' ')}>
            {count}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-snug text-muted">{desc}</p>
    </Link>
  );
}
