/**
 * Payloads das notificações — estruturados, não renderizados.
 *
 * Por que estrutura > texto pronto:
 *   - Mudanças de cópia/UI viram release sem migration.
 *   - Cada canal renderiza do jeito que faz sentido pra ele: WhatsApp ganha
 *     emoji + asterisco-negrito; in-app ganha card clicável; e-mail (futuro)
 *     ganha HTML.
 *   - Tools do assistente (Fase 8) podem ler o payload bruto e responder
 *     "você teve N alertas ontem" sem reparsing de texto.
 *
 * Discriminated union via `kind` — TypeScript narrow funciona sem cast.
 */

import type { BatchStatus } from '@/lib/utils/batch-status';

/** Lote individual dentro de um digest — espelha o que veio do banco com tipos UI-friendly. */
export type DigestBatch = {
  batchId: string;
  productId: string;
  productName: string;
  ean: string | null;
  lotNumber: string;
  quantity: number;
  /** YYYY-MM-DD */
  expirationDate: string;
  status: BatchStatus;
  daysUntilExpiration: number;
};

export type ExpirationDigestPayload = {
  kind: 'expiration_digest';
  /** YYYY-MM-DD da varredura que gerou este digest. */
  alertDate: string;
  batches: DigestBatch[];
};

export type SystemPayload = {
  kind: 'system';
  title: string;
  body: string;
  /** Opcional: rota interna para ação ao clicar. */
  href?: string;
};

export type TestPayload = {
  kind: 'test';
  /** Quem testou (pra log). */
  triggeredBy: string;
};

export type NotificationPayload =
  | ExpirationDigestPayload
  | SystemPayload
  | TestPayload;
