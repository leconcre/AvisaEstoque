import { logger } from '../logger';
import type { SendArgs, SendResult, WhatsAppProvider } from './provider';

/**
 * Provedor Mock — usado em dev e em testes. Loga a mensagem como o usuário
 * veria no WhatsApp e retorna um messageId fake. Nunca falha (a menos que
 * algum teste injete falha futuramente).
 *
 * Em dev (LOG_LEVEL=debug) o output fica bonito no terminal via pino-pretty.
 */
export class MockProvider implements WhatsAppProvider {
  readonly name = 'mock';

  async send(args: SendArgs): Promise<SendResult> {
    const fakeId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info(
      {
        event: 'whatsapp.send',
        provider: this.name,
        // 'to' é PII — pino redact em logger.ts já protege a chave whatsappPhone,
        // mas como aqui o campo se chama 'to' precisamos blindar manualmente.
        toMasked: maskPhone(args.to),
        messageId: fakeId,
        clientMessageId: args.clientMessageId,
        chars: args.message.length,
      },
      'whatsapp(mock) enviado',
    );
    // Imprime a mensagem completa pra inspeção visual em dev.
    // (Em produção mantemos WHATSAPP_PROVIDER=evolution, então isto não roda.)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('\n──── [mock whatsapp] ────\n' + args.message + '\n────────────────────────\n');
    }
    return { success: true, messageId: fakeId };
  }
}

function maskPhone(phone: string): string {
  // +5511987654321 → +55119****4321
  if (phone.length < 6) return '****';
  return phone.slice(0, -4).replace(/\d/g, (d, i, s) => (i >= s.length - 8 ? '*' : d)) + phone.slice(-4);
}
