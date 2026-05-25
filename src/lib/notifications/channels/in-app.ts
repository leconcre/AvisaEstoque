import { Prisma, NotificationType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type {
  NotificationChannel,
  ChannelSendArgs,
  ChannelSendResult,
} from '../channel';
import type { NotificationPayload } from '../types';

/**
 * InAppChannel — grava no banco. Canal sempre ativo, no plano BASIC inclusive.
 *
 * Idempotência: o @@unique([companyId, dedupKey]) faz a inserção falhar com
 * P2002 se já existe um registro hoje. Tratamos como deduplicated=true (sucesso
 * silencioso), igual à semântica do Alert PENDING-first.
 *
 * Não faz retry — escrita local é atômica; falha aqui é erro de banco que o
 * caller já vai querer saber.
 */
export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';
  readonly kind = 'in_app' as const;

  async send(args: ChannelSendArgs): Promise<ChannelSendResult> {
    try {
      const created = await prisma.notification.create({
        data: {
          companyId: args.companyId,
          type: payloadToType(args.payload),
          payload: args.payload as unknown as Prisma.InputJsonValue,
          dedupKey: args.dedupKey,
        },
        select: { id: true },
      });
      logger.info(
        { event: 'notif.in_app.created', companyId: args.companyId, notifId: created.id, dedupKey: args.dedupKey },
        'notificação in-app criada',
      );
      return { success: true, messageId: created.id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.debug(
          { event: 'notif.in_app.dedup', companyId: args.companyId, dedupKey: args.dedupKey },
          'notificação in-app já existia hoje — dedup',
        );
        return { success: true, deduplicated: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ event: 'notif.in_app.fail', companyId: args.companyId, err }, 'falha gravando notificação');
      return { success: false, error: msg, errorCode: 'DB_ERROR' };
    }
  }
}

function payloadToType(p: NotificationPayload): NotificationType {
  switch (p.kind) {
    case 'expiration_digest':
      return NotificationType.EXPIRATION_DIGEST;
    case 'test':
      return NotificationType.TEST;
    case 'system':
      return NotificationType.SYSTEM;
  }
}
