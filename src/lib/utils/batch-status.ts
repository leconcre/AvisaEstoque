import { diffInDaysFromTodaySP } from './today';

/**
 * Status de um lote — DERIVADO de expirationDate e alertDaysBefore.
 *
 * NUNCA persistir status no banco. O status muda com o avanço do calendário
 * mesmo sem o lote ser tocado; se materializássemos, ficaria stale.
 *
 * Regras (replicadas do HANDOFF §4.4 / §4.6 e do protótipo data.jsx):
 *   - EXPIRED   : diff < 0
 *   - CRITICAL  : 0 ≤ diff ≤ max(7, min(alertDaysBefore, 14))
 *                 → o limiar do badge VERMELHO é cap=14 dias, com piso=7 dias.
 *                 → mesmo que o usuário escolha alertDaysBefore=30 (recebe alerta
 *                   cedo), o badge crítico só aparece quando faltam ≤14 dias.
 *                 → mesmo que escolha alertDaysBefore=2, o badge fica vermelho
 *                   por pelo menos 7 dias (piso semântico).
 *   - WARNING   : limiar < diff ≤ 30
 *   - SAFE      : diff > 30
 *
 * FONTE ÚNICA de cálculo: counts no painel, badges na tabela e o filtro de
 * status em GET /api/batches todos chamam esta função sobre o mesmo Batch.
 */

export type BatchStatus = 'CRITICAL' | 'WARNING' | 'SAFE' | 'EXPIRED';

const CRITICAL_FLOOR = 7;
const CRITICAL_CAP = 14;
const WARNING_THRESHOLD = 30;

export function criticalThreshold(alertDaysBefore: number): number {
  return Math.max(CRITICAL_FLOOR, Math.min(alertDaysBefore, CRITICAL_CAP));
}

export function getBatchStatus(args: { expirationDate: Date; alertDaysBefore: number }): BatchStatus {
  const diff = diffInDaysFromTodaySP(args.expirationDate);
  if (diff < 0) return 'EXPIRED';
  if (diff <= criticalThreshold(args.alertDaysBefore)) return 'CRITICAL';
  if (diff <= WARNING_THRESHOLD) return 'WARNING';
  return 'SAFE';
}

export function daysUntilExpiration(expirationDate: Date): number {
  return diffInDaysFromTodaySP(expirationDate);
}

/**
 * Shape que o frontend (HANDOFF §3.7) espera para cada Batch serializado.
 * Os campos opcionais de `product` (name, ean) entram quando a query usa
 * include: { product: true } — todos os endpoints de leitura fazem isso.
 */
export type SerializedBatch = {
  id: string;
  product: { id: string; name: string; ean: string | null };
  lotNumber: string;
  quantity: number;
  expirationDate: string; // ISO YYYY-MM-DD
  alertDaysBefore: number;
  status: BatchStatus;
  daysUntilExpiration: number;
  createdAt: string;
};

type BatchRow = {
  id: string;
  lotNumber: string;
  quantity: number;
  expirationDate: Date;
  alertDaysBefore: number;
  createdAt: Date;
  product: { id: string; name: string; ean: string | null };
};

/**
 * Converte um Batch do Prisma (com product included) no shape do frontend.
 * Garante que tudo que sai da API tem `status` + `daysUntilExpiration` —
 * o frontend nunca recalcula, evita divergência client/server.
 */
export function serializeBatch(b: BatchRow): SerializedBatch {
  return {
    id: b.id,
    product: { id: b.product.id, name: b.product.name, ean: b.product.ean },
    lotNumber: b.lotNumber,
    quantity: b.quantity,
    expirationDate: toIsoDate(b.expirationDate),
    alertDaysBefore: b.alertDaysBefore,
    status: getBatchStatus({ expirationDate: b.expirationDate, alertDaysBefore: b.alertDaysBefore }),
    daysUntilExpiration: daysUntilExpiration(b.expirationDate),
    createdAt: b.createdAt.toISOString(),
  };
}

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Conta lotes por status em memória. Recebe a lista já filtrada por tenant +
 * deletedAt: null. Custo O(n); para milhares de lotes por empresa, irrelevante.
 *
 * Não escrever esta função em SQL (CASE WHEN). Manter a regra em UM lugar.
 */
export function countByStatus(
  batches: Array<{ expirationDate: Date; alertDaysBefore: number }>,
): Record<BatchStatus, number> & { all: number } {
  const counts = { CRITICAL: 0, WARNING: 0, SAFE: 0, EXPIRED: 0, all: 0 };
  for (const b of batches) {
    counts[getBatchStatus(b)] += 1;
    counts.all += 1;
  }
  return counts;
}
