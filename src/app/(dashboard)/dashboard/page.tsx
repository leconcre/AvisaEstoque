import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { countByStatus, serializeBatch } from '@/lib/utils/batch-status';
import { todayCivilSP } from '@/lib/utils/today';
import { StatCard } from '@/components/dashboard/StatCard';
import { StatusBar } from '@/components/batches/StatusBadge';

export const metadata = { title: 'Painel — AvisaEstoque' };
export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});
const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function dayLabel(diff: number): string {
  if (diff < 0) return `${Math.abs(diff)} d. vencido`;
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'em 1 dia';
  return `em ${diff} dias`;
}

export default async function DashboardPage() {
  const ctx = await requireCompanyContext();

  // Lê tudo em paralelo. Um round-trip Prisma resolve cada um.
  const [batches, company, yesterdaySnap, alerts30dCount] = await Promise.all([
    prisma.batch.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      include: { product: { select: { id: true, name: true, ean: true } } },
      orderBy: { expirationDate: 'asc' },
    }),
    prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: { whatsappPhone: true, alertEnabled: true, alertTime: true, lastScanAt: true },
    }),
    (async () => {
      const yesterday = new Date(todayCivilSP());
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      return prisma.dailySnapshot.findUnique({
        where: { companyId_snapshotDate: { companyId: ctx.companyId, snapshotDate: yesterday } },
        select: { needsAttention: true },
      });
    })(),
    (async () => {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);
      return prisma.alert.count({
        where: { companyId: ctx.companyId, status: 'SENT', sentAt: { gte: since } },
      });
    })(),
  ]);

  const counts = countByStatus(batches);
  const needsAttention = counts.CRITICAL + counts.WARNING + counts.EXPIRED;
  const vsYesterday = yesterdaySnap ? needsAttention - yesterdaySnap.needsAttention : null;

  // Top 5 próximas expirações (já vem ordenado por expirationDate asc).
  const upcoming = batches.slice(0, 5).map(serializeBatch);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-fg">Painel</h1>
          <p className="mt-1 text-sm text-muted">
            Bem-vindo de volta, <span className="text-fg-2">{ctx.name}</span>.
          </p>
        </div>
      </header>

      {/* Hero: needsAttention + delta vsYesterday */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-2">
          Precisam de atenção hoje
        </p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-mono text-[58px] font-semibold leading-none tracking-tight text-fg lg:text-[68px]">
            {needsAttention}
          </span>
          {vsYesterday !== null && vsYesterday !== 0 && (
            <span
              className={[
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                vsYesterday > 0
                  ? 'border-[var(--crit-border)] bg-[var(--crit-soft)] text-[var(--crit)]'
                  : 'border-[var(--safe-border)] bg-[var(--safe-soft)] text-[var(--safe)]',
              ].join(' ')}
            >
              {vsYesterday > 0 ? '↑' : '↓'} {Math.abs(vsYesterday)} vs. ontem
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          {needsAttention === 0
            ? 'Nada exige sua atenção agora. ✓'
            : 'Lotes em CRÍTICO, ATENÇÃO ou VENCIDOS.'}
        </p>
      </section>

      {/* StatCards × 4 */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard status="CRITICAL" count={counts.CRITICAL} label="Crítico"  desc="Vencem em ≤ 7 dias"           href="/batches?status=CRITICAL" />
        <StatCard status="WARNING"  count={counts.WARNING}  label="Atenção"  desc="Vencem em ≤ 30 dias"          href="/batches?status=WARNING" />
        <StatCard status="SAFE"     count={counts.SAFE}     label="Seguro"   desc="Vencem em > 30 dias"          href="/batches?status=SAFE" />
        <StatCard status="EXPIRED"  count={counts.EXPIRED}  label="Vencidos" desc="Lotes que já passaram do prazo" href="/batches?status=EXPIRED" />
      </section>

      {/* Canal de alerta + próximas expirações */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Canal de alerta */}
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <header className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Canal de alerta</h2>
              <p className="mt-0.5 text-xs text-muted">WhatsApp configurado</p>
            </div>
            <span
              className={[
                'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium',
                company?.alertEnabled
                  ? 'border-[var(--safe-border)] bg-[var(--safe-soft)] text-[var(--safe)]'
                  : 'border-[var(--exp-border)] bg-[var(--exp-soft)] text-[var(--muted)]',
              ].join(' ')}
            >
              <span className={['h-1.5 w-1.5 rounded-full', company?.alertEnabled ? 'bg-[var(--safe)]' : 'bg-[var(--exp)]'].join(' ')} />
              {company?.alertEnabled ? 'Ativo' : 'Pausado'}
            </span>
          </header>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Telefone</dt>
              <dd className="font-mono text-fg-2">{company?.whatsappPhone}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Próximo envio</dt>
              <dd className="font-mono text-fg-2">
                amanhã, {company?.alertTime}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Última varredura</dt>
              <dd className="text-fg-2">
                {company?.lastScanAt
                  ? `${timeFmt.format(company.lastScanAt)} (${dateFmt.format(company.lastScanAt)})`
                  : 'ainda não rodou'}
              </dd>
            </div>
          </dl>

          <div className="my-4 border-t border-border" />

          <div className="grid grid-cols-3 gap-3">
            <Metric label="Alertas (30d)" value={alerts30dCount.toString()} />
            <Metric label="Resp. taxa" value="—" preview />
            <Metric label="Economia" value="—" preview />
          </div>
        </div>

        {/* Próximas expirações */}
        <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-fg">Próximas expirações</h2>
              <p className="mt-0.5 text-xs text-muted">Top 5 por proximidade</p>
            </div>
            <Link href="/batches" className="text-xs font-medium text-[var(--brand-fg)] hover:underline">
              Ver todos
            </Link>
          </header>

          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Sem lotes cadastrados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-stretch gap-3 py-2.5">
                  <span className="flex w-1 shrink-0">
                    <StatusBar status={b.status} />
                  </span>
                  <div className="flex flex-1 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{b.product.name}</p>
                      <p className="font-mono text-xs text-muted">
                        Lote {b.lotNumber} · {b.quantity} un
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-xs text-fg-2">{dayLabel(b.daysUntilExpiration)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, preview }: { label: string; value: string; preview?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-2">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-fg">{value}</p>
      {preview && (
        <span
          className="mt-1 inline-block rounded-full bg-[oklch(0.95_0.005_95)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted"
          title="Estimativa — relatório completo em breve"
        >
          prévia
        </span>
      )}
    </div>
  );
}
