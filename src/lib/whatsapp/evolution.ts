import { logger } from '../logger';
import type { SendArgs, SendResult, WhatsAppProvider } from './provider';

/**
 * Provedor Evolution API (https://doc.evolution-api.com).
 *
 * Endpoint usado: POST {EVOLUTION_API_URL}/message/sendText/{instance}
 *   Headers: apikey: {EVOLUTION_API_KEY}
 *   Body: { number, text, options?: { delay, presence, linkPreview } }
 *
 * O cliente envia clientMessageId no body (campo `id` em algumas versões;
 * 'externalAttributes' em outras). Repassamos como `clientMessageId` no body
 * — provedor que ignora apenas descarta. Isso NUNCA causa erro de envio.
 *
 * Timeouts:
 *   - request: 15s. WhatsApp BSP típico responde em 1-3s; 15s é o limite
 *     pragmático antes de assumir que a rede comeu a resposta.
 *   - timeoutAmbiguous: quando AbortController dispara, retornamos com a flag
 *     pra que o caller decida se é seguro retry (idealmente não, porque o
 *     servidor pode já ter entregue — log warning).
 */
export class EvolutionApiProvider implements WhatsAppProvider {
  readonly name = 'evolution';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;

  constructor(config: { baseUrl: string; apiKey: string; instance: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.instance = config.instance;
  }

  async send(args: SendArgs): Promise<SendResult> {
    const url = `${this.baseUrl}/message/sendText/${encodeURIComponent(this.instance)}`;
    const body = {
      number: args.to.replace(/^\+/, ''), // Evolution prefere número sem '+'
      text: args.message,
      clientMessageId: args.clientMessageId,
    };

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          success: false,
          error: `HTTP ${res.status}: ${errText.slice(0, 240)}`,
          errorCode: `HTTP_${res.status}`,
        };
      }

      const payload = (await res.json().catch(() => null)) as {
        key?: { id?: string };
        messageId?: string;
      } | null;

      const messageId = payload?.key?.id ?? payload?.messageId ?? `evo_${Date.now()}`;
      return { success: true, messageId };
    } catch (err) {
      clearTimeout(timer);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        logger.warn(
          {
            event: 'whatsapp.timeout_ambiguous',
            provider: this.name,
            clientMessageId: args.clientMessageId,
          },
          'envio com timeout — provedor pode ter recebido. Não fazer retry sem dedup.',
        );
        return { success: false, error: 'TIMEOUT', errorCode: 'TIMEOUT', timeoutAmbiguous: true };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, errorCode: 'NETWORK' };
    }
  }
}
