import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { prisma } from '../prisma';
import { logger } from '../logger';
import { todayCivilSP } from '../utils/today';
import { countByStatus, getBatchStatus, criticalThreshold, daysUntilExpiration } from '../utils/batch-status';
import { getChannelsForCompany, type CompanyPlan } from '../notifications/registry';
import type { NotificationChannel } from '../notifications/channel';
import type { ExpirationDigestPayload, DigestBatch } from '../notifications/types';

/**
 * MOTOR DE ALERTAS — coração da Fase 4.
 *
 * INVARIANTES (decisões de design, NÃO os toque sem pensar):
 *
 *   I1. IDEMPOTÊNCIA VIA RESERVA-ANTES-DE-ENVIAR.
 *       Para cada (batch, hoje), tentamos `prisma.alert.create({ status: PENDING })`.
 *       O @@unique([batchId, alertDate]) age como LOCK distribuído:
 *         - quem ganha o create → entra na lista "vou enviar"
 *         - quem leva P2002 → desiste em silêncio (outro processo/execução já reservou)
 *       SÓ ENTÃO disparamos o WhatsApp para os Alerts que GANHAMOS no create.
 *       Sem isso, duas execuções concorrentes mandariam mensagem duplicada
 *       ANTES de a unique constraint se manifestar.
 *
 *   I2. UMA MENSAGEM POR EMPRESA, N LOTES POR MENSAGEM.
 *       Não enviamos 1 mensagem por Alert — agrupamos. Retry é no GRUPO inteiro.
 *       Update final (SENT/FAILED) opera em TODOS os Alerts do grupo com o
 *       mesmo messageId.
 *
 *   I3. TELEMETRIA DO PAINEL ATUALIZADA EM TODA VARREDURA.
 *       Mesmo quando a empresa não tem lotes para alertar:
 *         - Company.lastScanAt = now
 *         - DailySnapshot do dia atualizado (counts + needsAttention)
 *       Senão o painel ("Última varredura há X min", "vs ontem") fica null.
 *
 *   I4. JANELA DE ALERTA = expirationDate - alertDaysBefore.
 *       Batch é candidato quando seu vencimento está dentro da janela personalizada
 *       dele (cada lote tem seu próprio alertDaysBefore). Vencidos também alertam.
 *
 *   I5. BATCHES COM quantity=0 OU deletedAt!=null NÃO ALERTAM.
 *       Estoque zerado / lote removido não geram comunicação ao gerente.
 */

type CompanyForScan = {
  id: string;
  name: string;
  whatsappPhone: string;
  alertEnabled: boolean;
  alertTime: string;
  plan: CompanyPlan;
};

type BatchCandidate = {
  id: string;
  productId: string;
  lotNumber: string;
  quantity: number;
  expirationDate: Date;
  alertDaysBefore: number;
  product: { name: string; ean: string | null };
};

export type CompanyScanResult = {
  companyId: string;
  companyName: string;
  candidates: number;
  newlyReserved: number; // quantos Alerts PENDING criamos (i.e., quantos vamos enviar)
  alreadyAlertedToday: number; // candidatos que já tinham Alert hoje (P2002 no create)
  // Status por canal — cada canal é independente.
  channels: Record<string, { kind: string; success: boolean; messageId?: string; deduplicated?: boolean; error?: string }>;
  // Quantos canais reportaram sucesso (inclui in-app dedup).
  channelsOk: number;
  sent: number;   // quantos Alerts marcados como SENT (pelo menos um canal ok)
  failed: number; // quantos Alerts marcados como FAILED (todos canais falharam)
  skipped?: 'alertEnabled_off' | 'no_candidates' | 'no_phone' | 'no_channels';
  errors?: string[];
};

export type RunSummary = {
  startedAt: Date;
  finishedAt: Date;
  scanned: number;
  results: CompanyScanResult[];
};

/** Opções: por padrão escaneia TODAS as empresas com alertEnabled=true. */
export type RunOptions = {
  /** Limita a UM companyId. Útil pra trigger manual de teste. */
  onlyCompanyId?: string;
  /** Filtra empresas cujo alertTime bate com este HH:mm (usado pelo scheduler). */
  slotHHmm?: string;
};

/**
 * Orquestrador principal. Roda por empresa, sequencialmente — provedor de
 * WhatsApp não é rate-limited a ponto disso virar gargalo no MVP.
 * Em escala, paralelizar com `Promise.allSettled` é trivial.
 */
export async function runExpirationScan(opts: RunOptions = {}): Promise<RunSummary> {
  const startedAt = new Date();

  const where: Prisma.CompanyWhereInput = { alertEnabled: true };
  if (opts.onlyCompanyId) where.id = opts.onlyCompanyId;
  if (opts.slotHHmm) where.alertTime = opts.slotHHmm;

  const companies = await prisma.company.findMany({
    where,
    select: { id: true, name: true, whatsappPhone: true, alertEnabled: true, alertTime: true, plan: true },
  });

  logger.info(
    { event: 'scan.start', companies: companies.length, slot: opts.slotHHmm ?? null, onlyCompanyId: opts.onlyCompanyId ?? null },
    `varredura iniciada (${companies.length} empresa(s))`,
  );

  const results: CompanyScanResult[] = [];
  for (const c of companies) {
    try {
      results.push(await processCompany(c));
    } catch (err) {
      logger.error({ event: 'scan.company_fatal', companyId: c.id, err }, 'falha fatal em empresa');
      results.push({
        companyId: c.id,
        companyName: c.name,
        candidates: 0,
        newlyReserved: 0,
        alreadyAlertedToday: 0,
        channels: {},
        channelsOk: 0,
        sent: 0,
        failed: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  const finishedAt = new Date();
  logger.info(
    {
      event: 'scan.finish',
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      summary: results.map((r) => ({ companyId: r.companyId, sent: r.sent, failed: r.failed, reserved: r.newlyReserved, skipped: r.skipped })),
    },
    'varredura concluída',
  );

  return { startedAt, finishedAt, scanned: companies.length, results };
}

async function processCompany(company: CompanyForScan): Promise<CompanyScanResult> {
  const today = todayCivilSP();

  // --- Telemetria base: counts + needsAttention — sempre persistidos no fim,
  // mesmo em skip.
  const allActiveBatches = await prisma.batch.findMany({
    where: { companyId: company.id, deletedAt: null },
    select: { expirationDate: true, alertDaysBefore: true, quantity: true },
  });
  const counts = countByStatus(allActiveBatches);
  const needsAttention = counts.CRITICAL + counts.WARNING + counts.EXPIRED;

  // --- Passo 1: candidatos (filtro de janela em TS pra preservar fonte única).
  const candidates = await collectCandidates(company.id, today);
  if (candidates.length === 0) {
    await persistTelemetry(company.id, today, counts, needsAttention);
    return baseResult(company, 0, 0, 0, 'no_candidates');
  }

  // --- Passo 2: descobrir canais ATIVOS pra esta empresa.
  // InApp é sempre presente. Premium (WhatsApp) depende de plan=PRO e da env.
  // Se não tem nenhum canal, ainda assim "rodamos" — porque telemetria pra
  // painel não pode ficar parada — mas reportamos skipped: no_channels.
  const channels = getChannelsForCompany(company.plan);
  if (channels.length === 0) {
    await persistTelemetry(company.id, today, counts, needsAttention);
    return baseResult(company, candidates.length, 0, 0, 'no_channels');
  }

  // --- Passo 3: RESERVA via PENDING-first (invariante I1 — LOCK distribuído).
  // Quem ganha o create dispara. P2002 = outro processo/execução já reservou,
  // pula em silêncio. Esta é a única coisa que PROTEGE side-effects externos
  // contra duplicação concorrente. Sem isso, dois cron tickando ao mesmo
  // segundo enviariam o WhatsApp duas vezes.
  const { reserved, alreadyExisted } = await reserveAlerts(company.id, candidates, today);
  if (reserved.length === 0) {
    // Tudo já tinha Alert hoje — nada a enviar. Idempotência funcionando.
    await persistTelemetry(company.id, today, counts, needsAttention);
    const r = baseResult(company, candidates.length, 0, alreadyExisted);
    return r;
  }

  // --- Passo 4: monta payload ESTRUTURADO único.
  // Cada canal renderiza do seu jeito a partir desse payload.
  const reservedBatchById = new Map(candidates.map((c) => [c.id, c]));
  const digestBatches: DigestBatch[] = reserved.map((r) => {
    const c = reservedBatchById.get(r.batchId)!;
    return {
      batchId: c.id,
      productId: c.productId,
      productName: c.product.name,
      ean: c.product.ean,
      lotNumber: c.lotNumber,
      quantity: c.quantity,
      expirationDate: toIsoDate(c.expirationDate),
      status: getBatchStatus({ expirationDate: c.expirationDate, alertDaysBefore: c.alertDaysBefore }),
      daysUntilExpiration: daysUntilExpiration(c.expirationDate),
    };
  });
  const payload: ExpirationDigestPayload = {
    kind: 'expiration_digest',
    alertDate: toIsoDate(today),
    batches: digestBatches,
  };
  const dedupKey = `expdigest:${toIsoDate(today)}`;

  // --- Passo 5: despachar pra CADA canal (independentes).
  // Falha de um canal NÃO bloqueia outro. Por exemplo: in-app sempre funciona
  // (escrita local), WhatsApp pode falhar se Evolution estiver fora — o usuário
  // ainda vê a notificação no sino.
  const channelResults: CompanyScanResult['channels'] = {};
  let channelsOk = 0;

  for (const ch of channels) {
    const result = await dispatchToChannel(ch, {
      companyId: company.id,
      dedupKey,
      payload,
    });
    channelResults[ch.name] = result;
    if (result.success) channelsOk += 1;
  }

  // --- Passo 6: marcar Alerts no banco em grupo.
  // Regra: pelo menos UM canal sucesso → SENT (o usuário foi avisado).
  // Todos falharam → FAILED.
  const reservedIds = reserved.map((r) => r.alertId);
  if (channelsOk > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: reservedIds } },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    });
  } else {
    const firstErr = Object.values(channelResults).find((r) => !r.success)?.error ?? 'all channels failed';
    await prisma.alert.updateMany({
      where: { id: { in: reservedIds } },
      data: { status: 'FAILED', errorMessage: firstErr.slice(0, 240) },
    });
  }

  // --- Passo 7: telemetria final.
  await persistTelemetry(company.id, today, counts, needsAttention);

  const failedCount = channelsOk > 0 ? 0 : reserved.length;
  const sentCount = channelsOk > 0 ? reserved.length : 0;

  return {
    companyId: company.id,
    companyName: company.name,
    candidates: candidates.length,
    newlyReserved: reserved.length,
    alreadyAlertedToday: alreadyExisted,
    channels: channelResults,
    channelsOk,
    sent: sentCount,
    failed: failedCount,
  };
}

function baseResult(
  company: CompanyForScan,
  candidates: number,
  reserved: number,
  alreadyExisted: number,
  skipped?: CompanyScanResult['skipped'],
): CompanyScanResult {
  return {
    companyId: company.id,
    companyName: company.name,
    candidates,
    newlyReserved: reserved,
    alreadyAlertedToday: alreadyExisted,
    channels: {},
    channelsOk: 0,
    sent: 0,
    failed: 0,
    skipped,
  };
}

/**
 * Despacha pra um canal com retry exponencial APENAS pra canais transacionais
 * (não in-app). In-app é escrita local: ou funciona, ou falha por erro de DB
 * — retry não ajuda.
 */
async function dispatchToChannel(
  channel: NotificationChannel,
  args: { companyId: string; dedupKey: string; payload: ExpirationDigestPayload },
): Promise<CompanyScanResult['channels'][string]> {
  const isTransactional = channel.kind === 'whatsapp' || channel.kind === 'email';
  const delays = isTransactional ? [0, 1000, 2000, 4000] : [0];
  let lastError = 'desconhecido';

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]! > 0) await sleep(delays[attempt]!);
    const r = await channel.send(args);
    if (r.success) {
      return {
        kind: channel.kind,
        success: true,
        messageId: r.messageId,
        deduplicated: r.deduplicated,
      };
    }
    lastError = r.error;
    if (r.timeoutAmbiguous) {
      // Risco residual conhecido — provedor pode ter recebido. Não retry.
      return { kind: channel.kind, success: false, error: 'TIMEOUT_AMBIGUO_SEM_RETRY' };
    }
  }
  return { kind: channel.kind, success: false, error: lastError };
}

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function collectCandidates(companyId: string, today: Date): Promise<BatchCandidate[]> {
  // Buscamos um superset (todos os ativos com qty>0) e filtramos em TS.
  // O filtro depende de alertDaysBefore por linha — fazer em SQL exigiria
  // CASE WHEN repetindo a regra. Custo: O(N) por empresa, negligível no MVP.
  const todayMs = today.getTime();
  const allActive = await prisma.batch.findMany({
    where: {
      companyId,
      deletedAt: null,
      quantity: { gt: 0 },
    },
    include: { product: { select: { name: true, ean: true } } },
  });

  return allActive.filter((b) => {
    const daysUntil = Math.round((b.expirationDate.getTime() - todayMs) / 86_400_000);
    // janela do alerta: dentro de [-∞, alertDaysBefore]
    // - vencidos (diff < 0) também alertam até o estoque zerar
    // - 0 ≤ diff ≤ alertDaysBefore alerta normalmente
    return daysUntil <= b.alertDaysBefore;
  });
}

/**
 * Reserva via create individual. Retorna os Alert criados (= "ganhei") e quantos
 * já existiam (P2002 — alguém já reservou, possivelmente esta mesma varredura
 * sendo executada concorrentemente, ou uma anterior do dia).
 */
async function reserveAlerts(
  companyId: string,
  candidates: BatchCandidate[],
  alertDate: Date,
): Promise<{
  reserved: Array<{ alertId: string; batchId: string }>;
  alreadyExisted: number;
}> {
  const reserved: Array<{ alertId: string; batchId: string }> = [];
  let alreadyExisted = 0;

  for (const c of candidates) {
    try {
      const alert = await prisma.alert.create({
        data: {
          companyId,
          batchId: c.id,
          status: 'PENDING',
          alertDate,
          attempts: 0,
        },
        select: { id: true, batchId: true },
      });
      reserved.push({ alertId: alert.id, batchId: alert.batchId });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        alreadyExisted += 1;
      } else {
        // Erro inesperado — propaga (vai ser capturado no catch do processCompany).
        throw err;
      }
    }
  }

  return { reserved, alreadyExisted };
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function persistTelemetry(
  companyId: string,
  today: Date,
  counts: { CRITICAL: number; WARNING: number; SAFE: number; EXPIRED: number; all: number },
  needsAttention: number,
): Promise<void> {
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { lastScanAt: new Date() },
    }),
    prisma.dailySnapshot.upsert({
      where: { companyId_snapshotDate: { companyId, snapshotDate: today } },
      create: {
        companyId,
        snapshotDate: today,
        needsAttention,
        criticalCount: counts.CRITICAL,
        warningCount: counts.WARNING,
        safeCount: counts.SAFE,
        expiredCount: counts.EXPIRED,
      },
      update: {
        needsAttention,
        criticalCount: counts.CRITICAL,
        warningCount: counts.WARNING,
        safeCount: counts.SAFE,
        expiredCount: counts.EXPIRED,
      },
    }),
  ]);
}

// Exports auxiliares para testes diretos.
export const __internals = {
  collectCandidates,
  reserveAlerts,
  criticalThreshold,
  // util pra criar id aleatório quando precisamos
  uuid: () => randomUUID(),
};
