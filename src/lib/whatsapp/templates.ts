import { daysUntilExpiration, type BatchStatus } from '../utils/batch-status';

/**
 * Entrada que o template precisa de cada lote alertado.
 * Mantém o template desacoplado do modelo Prisma — facilita testar.
 */
export type AlertBatchInput = {
  productName: string;
  lotNumber: string;
  quantity: number;
  /** Date à meia-noite UTC — mesma representação do banco. */
  expirationDate: Date;
  status: BatchStatus;
};

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

function dayLabel(days: number): string {
  if (days < 0) return `vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence em 1 dia';
  return `vence em ${days} dias`;
}

/**
 * UMA mensagem por empresa agrupando N lotes (adendo 3.5 do spec).
 *
 * Decisões:
 *   - Ordenamos por proximidade (mais urgente primeiro).
 *   - Limitamos a 20 lotes por mensagem — acima disso a mensagem fica longa
 *     demais; o "+N restantes" preserva o sinal de urgência sem spam.
 *   - WhatsApp aceita asterisco para negrito (*texto*). Não usamos markdown
 *     além disso pra não estourar o parser de provedores estritos.
 *
 * O template é pt-BR (público brasileiro), direto, com sugestão de ação.
 * Evita jargão técnico (não diz "alertDaysBefore" pro gerente).
 */
export function renderAlertMessage(batches: AlertBatchInput[]): string {
  if (batches.length === 0) {
    throw new Error('renderAlertMessage: nenhum lote — não deveria ser chamado.');
  }

  const sorted = [...batches].sort(
    (a, b) => a.expirationDate.getTime() - b.expirationDate.getTime(),
  );

  const MAX = 20;
  const shown = sorted.slice(0, MAX);
  const omitted = sorted.length - shown.length;

  const lines = shown.map((b) => {
    const days = daysUntilExpiration(b.expirationDate);
    const dateStr = dateFmt.format(b.expirationDate).replace('.', '');
    const urgency = b.status === 'EXPIRED' ? '⛔' : b.status === 'CRITICAL' ? '🚨' : '⏰';
    return (
      `${urgency} *${b.productName}* (Lote ${b.lotNumber})\n` +
      `   ⏳ ${dayLabel(days)} (${dateStr})\n` +
      `   📊 Estoque: *${b.quantity}* un.`
    );
  });

  const header = '🚨 *AvisaEstoque — Alerta de Validade*\n\nGerente, atenção aos seguintes lotes:';
  const footer =
    `_${sorted.length} lote${sorted.length === 1 ? '' : 's'} ${sorted.length === 1 ? 'precisa' : 'precisam'} de atenção hoje._` +
    (omitted > 0 ? `\n_(+${omitted} ${omitted === 1 ? 'lote omitido' : 'lotes omitidos'} — veja todos no painel.)_` : '');
  const hint = '💡 *Sugestão:* priorizar exposição, criar promoção de queima ou dar baixa nos vencidos.';

  return [header, '', lines.join('\n\n'), '', '---', hint, '', footer].join('\n');
}

/**
 * Mensagem de teste — usada por POST /api/alerts/test no /settings.
 * NÃO cria Alert e NÃO conta na métrica de Alertas(30d).
 */
export function renderTestMessage(companyName: string): string {
  return [
    '✅ *AvisaEstoque — Teste de envio*',
    '',
    `Olá, ${companyName}! Esta é uma mensagem de teste.`,
    'Seu canal de WhatsApp está configurado corretamente.',
    '',
    'Quando algum lote chegar perto do vencimento, você vai receber um alerta como este.',
  ].join('\n');
}
