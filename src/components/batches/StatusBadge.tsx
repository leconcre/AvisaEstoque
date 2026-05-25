import type { BatchStatus } from '@/lib/utils/batch-status';

interface StatusBadgeProps {
  status: BatchStatus;
  size?: 'sm' | 'md';
  /** default true; ignorado se status !== CRITICAL (HANDOFF §2). */
  withPulse?: boolean;
  /** default true. Se false, mostra só o dot. */
  withLabel?: boolean;
}

const labels: Record<BatchStatus, string> = {
  CRITICAL: 'Crítico',
  WARNING: 'Atenção',
  SAFE: 'Seguro',
  EXPIRED: 'Vencido',
};

const styles: Record<BatchStatus, { soft: string; border: string; solid: string; fg: string }> = {
  CRITICAL: { soft: 'bg-[var(--crit-soft)]', border: 'border-[var(--crit-border)]', solid: 'bg-[var(--crit)]', fg: 'text-[var(--crit)]' },
  WARNING:  { soft: 'bg-[var(--warn-soft)]', border: 'border-[var(--warn-border)]', solid: 'bg-[var(--warn)]', fg: 'text-[oklch(0.45_0.17_75)]' },
  SAFE:     { soft: 'bg-[var(--safe-soft)]', border: 'border-[var(--safe-border)]', solid: 'bg-[var(--safe)]', fg: 'text-[var(--safe)]' },
  EXPIRED:  { soft: 'bg-[var(--exp-soft)]',  border: 'border-[var(--exp-border)]',  solid: 'bg-[var(--exp)]',  fg: 'text-[var(--muted)]' },
};

/**
 * Pílula colorida com dot indicador. ÚNICA superfície com animação contínua
 * no produto (HANDOFF §2): pulse-crit roda só quando status === 'CRITICAL'.
 */
export function StatusBadge({
  status,
  size = 'md',
  withPulse = true,
  withLabel = true,
}: StatusBadgeProps) {
  const s = styles[status];
  const isCritical = status === 'CRITICAL';
  const pulsing = isCritical && withPulse;
  const dim = size === 'sm' ? 'h-5 text-[11px] px-2' : 'h-6 text-xs px-2.5';
  const dotDim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        dim,
        s.soft,
        s.border,
        s.fg,
      ].join(' ')}
    >
      <span className={[dotDim, 'rounded-full', s.solid, pulsing ? 'pulse-crit' : ''].join(' ')} />
      {withLabel && <span>{labels[status]}</span>}
    </span>
  );
}

/** Barra vertical fina de 3px para usar à esquerda de linhas de lista (HANDOFF §4.13). */
export function StatusBar({ status }: { status: BatchStatus }) {
  return <span className={['inline-block h-full w-[3px] rounded-full', styles[status].solid].join(' ')} />;
}
