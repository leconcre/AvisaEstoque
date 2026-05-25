import { logger } from '../logger';
import { EvolutionApiProvider } from './evolution';
import { MockProvider } from './mock';
import type { WhatsAppProvider } from './provider';

/**
 * @deprecated NÃO USAR. Substituído pelo NotificationChannel registry
 * em src/lib/notifications/registry.ts.
 *
 * Este módulo fica preservado para reativação futura do canal WhatsApp;
 * por ora nenhum caminho quente do app o importa.
 *
 * Resolve o provider a partir do env (era usado na Fase 4 antes do refactor).
 */
let cached: WhatsAppProvider | undefined;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  const choice = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase();

  if (choice === 'evolution') {
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instance = process.env.EVOLUTION_INSTANCE;
    if (!baseUrl || !apiKey || !instance) {
      throw new Error(
        'WHATSAPP_PROVIDER=evolution exige EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.',
      );
    }
    cached = new EvolutionApiProvider({ baseUrl, apiKey, instance });
    logger.info({ provider: 'evolution' }, 'WhatsAppProvider iniciado');
    return cached;
  }

  cached = new MockProvider();
  logger.info({ provider: 'mock' }, 'WhatsAppProvider iniciado');
  return cached;
}

export type { WhatsAppProvider, SendArgs, SendResult } from './provider';
