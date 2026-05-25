import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse, AppError } from '@/lib/errors';
import { ensureRateLimit } from '@/lib/rate-limit';
import { todayCivilSP } from '@/lib/utils/today';
import type { ExpirationDigestPayload } from '@/lib/notifications/types';

export const runtime = 'nodejs';

/**
 * POST /api/alerts/resend-today
 *
 * SEMÂNTICA NO MVP IN-APP:
 *   Como o canal WhatsApp está desativado (vide channels/_disabled/), não
 *   existe "reenviar por push externo". Em vez disso, este endpoint
 *   REINJETA ATENÇÃO sobre a notificação do dia:
 *     - se já está marcada como lida → desmarca (readAt = null)
 *     - se já está como não-lida → mantém (no-op com 200 e flag wasUnread)
 *
 *   O sino do TopBar volta a piscar e o usuário vê o digest de novo.
 *
 * Por que assim e não 409: "marcar pra ver de novo" é uma ação real de produto
 * que o usuário precisa (ele leu na pressa, fechou o popover e perdeu).
 * Manter o endpoint útil em vez de virar 409 mantém a UX coerente.
 *
 * Fonte do "digest de hoje" continua sendo o Notification gravado pelo motor
 * de alertas no caminho automático ou pelo /api/cron/run manual.
 *
 * Quando o canal premium voltar (reativar registry), este endpoint pode
 * passar a TAMBÉM redespachar pelo WhatsApp — sem quebrar contrato.
 *
 * Rate limit: 3/24h por empresa (evita o usuário ficar reaquecendo direto).
 */
export async function POST() {
  try {
    const ctx = await requireCompanyContext();
    ensureRateLimit({
      key: `alerts.resend:${ctx.companyId}`,
      limit: 3,
      windowMs: 24 * 60 * 60_000, // 24h
    });

    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: { alertEnabled: true },
    });
    if (!company) throw new AppError('Empresa não encontrada.', 404, 'NOT_FOUND');
    if (!company.alertEnabled) {
      throw new AppError('Os alertas estão desativados.', 409, 'ALERTS_DISABLED');
    }

    const today = todayCivilSP();
    const isoToday = today.toISOString().slice(0, 10);
    const dedupKey = `expdigest:${isoToday}`;

    const todaysDigest = await prisma.notification.findUnique({
      where: { companyId_dedupKey: { companyId: ctx.companyId, dedupKey } },
      select: { id: true, payload: true, readAt: true },
    });
    if (!todaysDigest) {
      throw new AppError(
        'Nenhum digest foi gerado hoje — não há o que destacar.',
        409,
        'NOTHING_TO_RESEND',
      );
    }

    const payload = todaysDigest.payload as unknown as ExpirationDigestPayload;
    const batchCount = payload.kind === 'expiration_digest' ? payload.batches.length : 0;
    const wasUnread = todaysDigest.readAt === null;

    if (!wasUnread) {
      // Desmarca → notif vira não-lida e o sino volta a piscar.
      await prisma.notification.update({
        where: { id: todaysDigest.id },
        data: { readAt: null },
      });
    }

    logger.info(
      {
        event: 'alerts.resend.ok',
        companyId: ctx.companyId,
        action: wasUnread ? 'noop_already_unread' : 'remarked_unread',
        batches: batchCount,
      },
      'digest do dia reinjetado no sino',
    );

    return NextResponse.json({
      success: true,
      sentAt: new Date().toISOString(),
      mode: 'in_app_unread',
      action: wasUnread ? 'already_unread' : 'remarked_unread',
      resentForBatches: batchCount,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
