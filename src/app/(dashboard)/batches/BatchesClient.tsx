'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Search, Trash2, PlusSquare } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/batches/StatusBadge';
import type { BatchStatus, SerializedBatch } from '@/lib/utils/batch-status';

type Counts = { all: number; critical: number; warning: number; safe: number; expired: number };
type FilterKey = 'all' | BatchStatus;

interface BatchesClientProps {
  initialData: SerializedBatch[];
  initialCounts: Counts;
  initialStatus: FilterKey;
  /** Se vier setado (vindo do row-flash pós-cadastro), aplica destaque por 2s. */
  flashId?: string | null;
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function dayLabel(diff: number): string {
  if (diff < 0) return `${Math.abs(diff)} d. vencido`;
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'em 1 dia';
  return `em ${diff} dias`;
}

export function BatchesClient({ initialData, initialCounts, initialStatus, flashId }: BatchesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState(initialData);
  const [counts, setCounts] = useState(initialCounts);
  const [status, setStatus] = useState<FilterKey>(initialStatus);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(flashId ?? null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Row-flash: 2s e some.
  useEffect(() => {
    if (!highlightedId) return;
    const t = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightedId]);

  // Atalho global: '/' foca a busca (HANDOFF §4.8). Só fora de input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Recarrega via fetch quando filtro/busca mudam — counts são reusados (não pedimos de novo).
  async function fetchData(nextStatus: FilterKey, nextSearch: string) {
    const url = new URL('/api/batches', window.location.origin);
    if (nextStatus !== 'all') url.searchParams.set('status', nextStatus);
    if (nextSearch) url.searchParams.set('search', nextSearch);
    const res = await fetch(url.toString());
    if (!res.ok) return;
    const body = (await res.json()) as { data: SerializedBatch[]; counts: Counts };
    setData(body.data);
    setCounts(body.counts);
  }

  function applyStatus(next: FilterKey) {
    setStatus(next);
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 'all') sp.delete('status');
    else sp.set('status', next);
    startTransition(() => {
      router.replace(`/batches${sp.toString() ? `?${sp.toString()}` : ''}`);
      void fetchData(next, search);
    });
  }

  function applySearch(next: string) {
    setSearch(next);
    void fetchData(status, next);
  }

  async function doDelete(id: string) {
    const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      // Otimismo: remove localmente. Counts recarregam no próximo filtro/refresh.
      setData((prev) => prev.filter((b) => b.id !== id));
      setConfirmId(null);
      // Atualiza counts sumindo 1 do bucket certo (heurística — alternativa seria refetch).
      const removed = data.find((b) => b.id === id);
      if (removed) {
        setCounts((c) => {
          const map: Record<BatchStatus, keyof Counts> = {
            CRITICAL: 'critical', WARNING: 'warning', SAFE: 'safe', EXPIRED: 'expired',
          };
          return { ...c, all: c.all - 1, [map[removed.status]]: c[map[removed.status]] - 1 } as Counts;
        });
      }
    }
  }

  const chips: Array<{ key: FilterKey; label: string; count: number; cls: string }> = useMemo(() => [
    { key: 'all',      label: 'Todos',    count: counts.all,      cls: 'border-border-strong text-fg-2' },
    { key: 'CRITICAL', label: 'Crítico',  count: counts.critical, cls: 'border-[var(--crit-border)] text-[var(--crit)]' },
    { key: 'WARNING',  label: 'Atenção',  count: counts.warning,  cls: 'border-[var(--warn-border)] text-[oklch(0.45_0.17_75)]' },
    { key: 'SAFE',     label: 'Seguro',   count: counts.safe,     cls: 'border-[var(--safe-border)] text-[var(--safe)]' },
    { key: 'EXPIRED',  label: 'Vencidos', count: counts.expired,  cls: 'border-[var(--exp-border)] text-[var(--muted)]' },
  ], [counts]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">Lotes</h1>
          <p className="mt-1 text-sm text-muted">
            {counts.all} {counts.all === 1 ? 'lote ativo' : 'lotes ativos'} no estoque.
          </p>
        </div>
        <Link href="/batches/new">
          <Button icon={<PlusSquare className="h-4 w-4" />}>Cadastrar lote</Button>
        </Link>
      </header>

      {/* Chips de filtro */}
      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {chips.map((c) => {
          const active = c.key === status;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => applyStatus(c.key)}
              className={[
                'inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium transition-colors',
                active ? c.cls + ' shadow-sm' : 'border-border text-muted hover:text-fg-2',
              ].join(' ')}
              aria-pressed={active}
            >
              <span>{c.label}</span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
        <Search className="h-4 w-4 text-muted" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => applySearch(e.target.value)}
          placeholder="Buscar por produto, lote ou EAN…"
          className="block w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-2"
        />
        <kbd className="hidden rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline border border-border">/</kbd>
      </div>

      {/* Tabela */}
      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          Nenhum lote {status === 'all' ? 'cadastrado' : 'neste filtro'}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/60 text-xs uppercase tracking-wider text-muted-2">
              <tr>
                <th className="w-1 p-0" />
                <th className="px-4 py-2.5 text-left font-medium">Produto</th>
                <th className="px-4 py-2.5 text-left font-medium">Lote</th>
                <th className="px-4 py-2.5 text-right font-medium">Qtd</th>
                <th className="px-4 py-2.5 text-left font-medium">Vencimento</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((b) => {
                const flashing = highlightedId === b.id;
                return (
                  <tr
                    key={b.id}
                    className={[
                      'border-b border-border last:border-b-0 transition-colors',
                      flashing ? 'bg-[var(--brand-soft)]' : 'hover:bg-background/40',
                    ].join(' ')}
                    style={flashing ? { animation: 'rowflash 2s ease-out' } : undefined}
                  >
                    <td className="p-0">
                      <span
                        className={[
                          'block h-full w-[3px]',
                          b.status === 'CRITICAL' && 'bg-[var(--crit)]',
                          b.status === 'WARNING'  && 'bg-[var(--warn)]',
                          b.status === 'SAFE'     && 'bg-[var(--safe)]',
                          b.status === 'EXPIRED'  && 'bg-[var(--exp)]',
                        ].filter(Boolean).join(' ')}
                        style={{ minHeight: 40 }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{b.product.name}</p>
                      {b.product.ean && (
                        <p className="font-mono text-[11px] text-muted">EAN {b.product.ean}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-2">{b.lotNumber}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg-2">{b.quantity}</td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-fg-2">
                        {dateFmt.format(new Date(b.expirationDate + 'T00:00:00Z'))}
                      </p>
                      <p className="text-[11px] text-muted">{dayLabel(b.daysUntilExpiration)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmId === b.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void doDelete(b.id)}
                            className="rounded-md border border-[var(--crit-border)] bg-[var(--crit-soft)] px-2 py-1 text-[11px] font-medium text-[var(--crit)] hover:brightness-105"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="rounded-md px-2 py-1 text-[11px] text-muted hover:text-fg-2"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(b.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-[var(--crit-soft)] hover:text-[var(--crit)]"
                          aria-label="Excluir lote"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        @keyframes rowflash {
          0%   { background: var(--brand-soft); }
          70%  { background: var(--brand-soft); }
          100% { background: transparent; }
        }
      `}</style>
    </div>
  );
}
