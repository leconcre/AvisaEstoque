import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse } from '@/lib/errors';
import { countByStatus } from '@/lib/utils/batch-status';
import { todayCivilSP } from '@/lib/utils/today';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/summary
 *
 * Payload do painel (adendo v2, item D). Contrato exato com o frontend:
 *
 *   {
 *     needsAttention,
 *     vsYesterday,
 *     counts: { critical, warning, safe, expired, all },
 *     channel: {
 *       phone, enabled, nextDispatch, lastScanAt,
 *       metrics: {
 *         alerts30d,
 *         responseRate: { value: null, preview: true },
 *         savings:      { value: null, preview: true },
 *       },
 *     },
 *   }
 *
 * - counts: agregados em memória (regra do status única, ver batch-status.ts).
 * - needsAttention: CRITICAL + WARNING + EXPIRED (todo lote que NÃO está SAFE).
 * - vsYesterday: needsAttention - snapshot_de_ontem.needsAttention. null se não houver snapshot.
 * - channel.metrics.alerts30d: COUNT(*) Alert WHERE status=SENT AND sentAt >= now-30d.
 * - responseRate e savings: null + preview:true. NÃO simular dados.
 * - nextDispatch: próxima ocorrência do alertTime da empresa em SP.
 */
export async function GET() {
  try {
    const ctx = await requireCompanyContext();

    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: {
        id: true,
        whatsappPhone: true,
        alertEnabled: true,
        alertTime: true,
        lastScanAt: true,
      },
    });
    if (!company) {
      // Não deveria acontecer (a sessão tem companyId), mas defesa em profundidade.
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Empresa não encontrada.' } }, { status: 404 });
    }

    // Lê o universo de batches ativos (sem soft-deleted). Mesma listagem que o /api/batches
    // sem filtros — counts saem desta mesma fonte, garantindo coerência com a aba Lotes.
    const batches = await prisma.batch.findMany({
      where: { companyId: ctx.companyId, deletedAt: null },
      select: { expirationDate: true, alertDaysBefore: true },
    });

    const counts = countByStatus(batches);
    const needsAttention = counts.CRITICAL + counts.WARNING + counts.EXPIRED;

    // vsYesterday: lê snapshot de ontem (data civil SP).
    const today = todayCivilSP();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdaySnap = await prisma.dailySnapshot.findUnique({
      where: { companyId_snapshotDate: { companyId: ctx.companyId, snapshotDate: yesterday } },
      select: { needsAttention: true },
    });
    const vsYesterday = yesterdaySnap ? needsAttention - yesterdaySnap.needsAttention : null;

    // alerts30d real.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const alerts30d = await prisma.alert.count({
      where: {
        companyId: ctx.companyId,
        status: 'SENT',
        sentAt: { gte: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      needsAttention,
      vsYesterday,
      counts: {
        all: counts.all,
        critical: counts.CRITICAL,
        warning: counts.WARNING,
        safe: counts.SAFE,
        expired: counts.EXPIRED,
      },
      channel: {
        phone: company.whatsappPhone,
        enabled: company.alertEnabled,
        nextDispatch: nextDispatchIso(company.alertTime),
        lastScanAt: company.lastScanAt?.toISOString() ?? null,
        metrics: {
          alerts30d,
          // Métricas FORA do MVP — adendo v2, tabela D. NUNCA simular.
          responseRate: { value: null, preview: true } as const,
          savings: { value: null, preview: true } as const,
        },
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Próxima ocorrência de HH:mm em America/Sao_Paulo, retornada em ISO (com offset -03:00).
 * Se HH:mm de hoje ainda não passou (em SP), é hoje; senão é amanhã.
 *
 * Implementação simples (sem libs): pega a data civil de hoje SP, monta a string
 * `YYYY-MM-DDTHH:mm:00-03:00` e avança 1 dia se já no passado.
 */
function nextDispatchIso(alertTime: string): string {
  const today = todayCivilSP();
  const yyyy = today.getUTCFullYear().toString().padStart(4, '0');
  const mm = (today.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = today.getUTCDate().toString().padStart(2, '0');
  const candidateToday = new Date(`${yyyy}-${mm}-${dd}T${alertTime}:00-03:00`);
  if (candidateToday.getTime() <= Date.now()) {
    const next = new Date(candidateToday);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }
  return candidateToday.toISOString();
}
