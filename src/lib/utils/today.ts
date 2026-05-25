/**
 * "Hoje" como data civil em America/Sao_Paulo, expressa como Date à meia-noite UTC.
 *
 * Por que isto existe:
 *  - `expirationDate` é `@db.Date` no Postgres (data civil, sem hora).
 *  - O cálculo de `daysUntilExpiration` precisa comparar contra um "hoje" que
 *    NÃO depende do timezone do processo. Em UTC, o dia muda às 21h SP — se
 *    usássemos `new Date()` direto, lotes que vencem "amanhã" virariam "hoje"
 *    entre 21h e 00h.
 *  - Usando Intl.DateTimeFormat com timeZone='America/Sao_Paulo' extraímos o
 *    ano/mês/dia local de SP em qualquer host, e construímos um Date à 00:00 UTC
 *    representando esse dia civil. A comparação fica unidimensional (Date-Date)
 *    e fechada na fronteira do dia civil de SP.
 *
 * Este helper é compartilhado por:
 *  - prisma/seed.ts (gera expirationDate por offset relativo a hoje SP)
 *  - src/lib/utils/batch-status.ts (calcula status e dias restantes)
 *  - src/lib/jobs/check-expirations.ts (Fase 4 — varre lotes cuja data ≤ hoje + alertDays)
 *
 * Manter um único helper é DEFESA contra divergência: se seed planta um
 * "EXPIRED em -1d" e o status calcular contra outro "hoje", a UI mentiria.
 */

const SP_TIMEZONE = 'America/Sao_Paulo';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayCivilSP(): Date {
  const parts = partsFormatter.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '01';
  const iso = `${get('year')}-${get('month')}-${get('day')}T00:00:00Z`;
  return new Date(iso);
}

/**
 * Diferença em dias civis entre `date` (uma data Postgres já carregada como Date)
 * e hoje em SP. Negativo = passado, 0 = hoje, positivo = futuro.
 *
 * Truncamos a data alvo para meia-noite UTC para anular qualquer hora residual
 * que o driver possa retornar. A subtração é em milissegundos, mas a divisão
 * pelo dia em ms (86_400_000) é exata porque ambas as pontas estão em 00:00 UTC.
 */
export function diffInDaysFromTodaySP(date: Date): number {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0),
  );
  const today = todayCivilSP();
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
