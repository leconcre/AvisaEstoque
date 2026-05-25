import { logger } from '@/lib/logger';
import type {
  NotificationChannel,
  ChannelSendArgs,
  ChannelSendResult,
} from '../channel';

/**
 * MockChannel — usado em testes e em dev quando WHATSAPP_PROVIDER=mock.
 *
 * Imprime o payload bruto no log; não persiste nada. Idempotência depende
 * inteiramente do lock PENDING-first do motor de alertas — este canal sozinho
 * NÃO dedupica.
 */
export class MockChannel implements NotificationChannel {
  readonly name = 'mock';
  readonly kind = 'whatsapp' as const; // simula o canal premium

  async send(args: ChannelSendArgs): Promise<ChannelSendResult> {
    const fakeId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info(
      {
        event: 'notif.mock.send',
        companyId: args.companyId,
        dedupKey: args.dedupKey,
        kind: args.payload.kind,
        messageId: fakeId,
      },
      'mock channel: simulando envio',
    );
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('\n──── [mock channel] ────');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(args.payload, null, 2));
      // eslint-disable-next-line no-console
      console.log('────────────────────────\n');
    }
    return { success: true, messageId: fakeId };
  }
}
