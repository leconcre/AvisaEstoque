import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse, AppError } from '@/lib/errors';
import { ensureRateLimit } from '@/lib/rate-limit';
import { getChannelsForCompany } from '@/lib/notifications/registry';
import type { TestPayload } from '@/lib/notifications/types';

export const runtime = 'nodejs';

/**
 * POST /api/alerts/test
 *
 * Dispara uma notificação de TESTE em todos os canais ATIVOS do plano.
 * No MVP atual, "todos os canais ativos" = APENAS in-app (canal WhatsApp
 * desligado em channels/_disabled/). O resultado retorna "in-app: ok" e
 * a notif aparece no sino na próxima atualização.
 *
 * Quando o canal premium voltar (reativar via registry), este endpoint
 * automaticamente passa a despachar também por ele — sem mudar contrato.
 *
 * NÃO cria Alert, NÃO conta em métricas. Rate limit: 5/h por empresa.
 * Respeita Company.alertEnabled.
 */
export async function POST() {
  try {
    const ctx = await requireCompanyContext();
    ensureRateLimit({
      key: `alerts.test:${ctx.companyId}`,
      limit: 5,
      windowMs: 60 * 60_000, // 1h
    });

    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: { name: true, alertEnabled: true, plan: true },
    });
    if (!company) throw new AppError('Empresa não encontrada.', 404, 'NOT_FOUND');
    if (!company.alertEnabled) {
      throw new AppError(
        'Os alertas estão desativados. Reative em Configurações antes de testar.',
        409,
        'ALERTS_DISABLED',
      );
    }

    const channels = getChannelsForCompany(company.plan);
    if (channels.length === 0) {
      throw new AppError('Nenhum canal de notificação disponível no seu plano.', 409, 'NO_CHANNELS');
    }

    const payload: TestPayload = {
      kind: 'test',
      triggeredBy: ctx.name,
    };
    // dedupKey com timestamp — propósito é justamente RE-disparar o teste,
    // não dedupicar. Cada clique gera uma notificação nova.
    const dedupKey = `test:${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const channelResults: Record<string, { kind: string; success: boolean; error?: string }> = {};
    let anyOk = false;
    for (const ch of channels) {
      const r = await ch.send({ companyId: ctx.companyId, dedupKey, payload });
      channelResults[ch.name] = {
        kind: ch.kind,
        success: r.success,
        ...(r.success ? {} : { error: r.error }),
      };
      if (r.success) anyOk = true;
    }

    if (!anyOk) {
      logger.error({ event: 'alerts.test.all_failed', companyId: ctx.companyId, channels: channelResults }, 'teste falhou em todos canais');
      throw new AppError('Falha no envio em todos os canais.', 502, 'ALL_CHANNELS_FAILED');
    }

    logger.info(
      { event: 'alerts.test.ok', companyId: ctx.companyId, plan: company.plan, channels: channelResults },
      'mensagem de teste despachada',
    );
    return NextResponse.json({
      success: true,
      sentAt: new Date().toISOString(),
      plan: company.plan,
      channels: channelResults,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
