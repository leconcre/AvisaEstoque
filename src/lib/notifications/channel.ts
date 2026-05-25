import type { NotificationPayload } from './types';

/**
 * NotificationChannel — abstração genérica de canal (in-app, WhatsApp, e-mail).
 *
 * Cada canal recebe o MESMO payload estruturado e renderiza/entrega do seu jeito.
 * Idempotência por canal é responsabilidade da implementação:
 *   - InAppChannel    → @@unique([companyId, dedupKey]) no Notification
 *   - EvolutionChannel→ Alert @@unique([batchId, alertDate]) na camada superior
 *                       + clientMessageId opcional do provider
 *   - MockChannel     → sem persistência; depende do lock PENDING-first acima
 *
 * Sucesso/falha de um canal NÃO trava os outros. O motor de alertas registra
 * status por canal individualmente.
 */

export type ChannelKind = 'in_app' | 'whatsapp' | 'email';

export type ChannelSendArgs = {
  /** Empresa-alvo. Canal deve usar pra rotear (in-app grava com companyId; WhatsApp pega phone da company). */
  companyId: string;
  /** Chave de dedup específica da PRIMITIVA do canal (ex: "expdigest:2026-05-20"). */
  dedupKey: string;
  /** Conteúdo estruturado da notificação. */
  payload: NotificationPayload;
};

export type ChannelSendResult =
  | { success: true; messageId?: string; deduplicated?: boolean }
  | { success: false; error: string; errorCode?: string; timeoutAmbiguous?: boolean };

export interface NotificationChannel {
  /** Curto, pra log: "in-app", "evolution", "mock". */
  readonly name: string;
  /** Tipo do canal pra UI/planos diferenciarem. */
  readonly kind: ChannelKind;
  send(args: ChannelSendArgs): Promise<ChannelSendResult>;
}
