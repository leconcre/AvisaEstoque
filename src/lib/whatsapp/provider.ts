/**
 * Interface abstrata de envio de WhatsApp.
 *
 * Por que abstrair: queremos trocar de Evolution para qualquer outro provedor
 * (Twilio, BSP oficial Meta, etc.) sem mexer no check-expirations. O contrato
 * é minimalista de propósito — qualquer provedor que mande texto pra um número
 * encaixa.
 *
 * Sobre `clientMessageId`: alguns provedores (Evolution API tem um campo `key`
 * em parte das versões; Meta Cloud API aceita `biz_opaque_callback_data`)
 * permitem que o cliente passe um ID externo pra deduplicar requisições
 * repetidas. Passamos um ID derivado de `(companyId, alertDate)` — se o
 * provedor honra, ganhamos idempotência adicional contra o caso "timeout
 * ambíguo" (servidor recebeu, cliente não soube). Se ignora, o risco residual
 * fica restrito a esse cenário específico e a gente registra warning no log.
 */

export type SendArgs = {
  /** Número em E.164: +5511987654321 */
  to: string;
  message: string;
  /** ID idempotente opcional do lado do cliente. Provedor pode ignorar. */
  clientMessageId?: string;
};

export type SendResult =
  | { success: true; messageId: string }
  | { success: false; error: string; errorCode?: string; timeoutAmbiguous?: boolean };

export interface WhatsAppProvider {
  /** Nome curto pra log. */
  readonly name: string;
  send(args: SendArgs): Promise<SendResult>;
}
