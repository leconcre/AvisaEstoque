import cron from 'node-cron';

import { logger } from '../logger';
import { runExpirationScan } from './check-expirations';

/**
 * SCHEDULER INTERNO (node-cron) — DEV / VPS APENAS.
 *
 * Em deploy serverless (Vercel, AWS Lambda, etc.) NÃO há processo persistente
 * para sustentar node-cron. Lá, o agendamento deve ser feito por um trigger
 * HTTP externo (Vercel Cron, GitHub Actions, cron-job.org) batendo em
 *   POST /api/cron/run
 * com o header X-Cron-Secret. Vide README §"Rodar o cron manualmente".
 *
 * Esquema: rodamos a cada 15 minutos e disparamos APENAS para empresas cujo
 * Company.alertTime bate com o slot atual em America/Sao_Paulo. Isso permite
 * horário configurável por empresa (adendo v2 B) sem precisar de Redis/BullMQ
 * no MVP. Trade-off: precisão de até 15 min — aceitável e documentado.
 *
 * Para ligar: CRON_ENABLED=true no .env. Em dev, mantenha false e use o trigger
 * manual via /api/cron/run.
 */

const TZ = 'America/Sao_Paulo';

let started = false;

export function startScheduler(): void {
  if (started) return;
  if (process.env.CRON_ENABLED !== 'true') {
    logger.info({ event: 'scheduler.disabled' }, 'CRON_ENABLED!=true — scheduler interno desligado');
    return;
  }

  cron.schedule(
    '*/15 * * * *', // a cada 15 minutos
    async () => {
      const slot = currentSlotHHmm();
      if (!slot) return; // só dispara nos quartos de hora (cron já garante, mas dupla checagem)
      logger.info({ event: 'scheduler.tick', slot }, `tick do scheduler (slot ${slot})`);
      try {
        await runExpirationScan({ slotHHmm: slot });
      } catch (err) {
        logger.error({ err }, 'falha não tratada no scan agendado');
      }
    },
    { timezone: TZ },
  );

  started = true;
  logger.info({ event: 'scheduler.started', tz: TZ }, 'scheduler interno iniciado');
}

/**
 * HH:mm atual em America/Sao_Paulo, ARREDONDADO para o quarto de hora.
 * Exemplo: 08:13 → "08:00", 08:23 → "08:15", 08:32 → "08:30", 08:46 → "08:45".
 *
 * Uma empresa com alertTime="08:00" só dispara no tick das 08:00.
 * Uma com "08:30" dispara só no tick das 08:30, e assim por diante.
 * Se o gerente colocou "08:07", a varredura só rodaria pra ele às 08:00 — não
 * fizemos arredondamento para o MAIS PRÓXIMO porque preferimos atraso de até
 * 15min a alerta antes da hora. Documentar no /settings ao expor o campo.
 */
function currentSlotHHmm(): string | null {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === 'hour')?.value;
  const mm = parts.find((p) => p.type === 'minute')?.value;
  if (!hh || !mm) return null;
  const minute = Number(mm);
  const slotMin = Math.floor(minute / 15) * 15;
  return `${hh}:${slotMin.toString().padStart(2, '0')}`;
}

// Permite rodar como `npm run cron:start` em VPS.
if (require.main === module) {
  startScheduler();
  // Mantém o processo vivo
  setInterval(() => {}, 1 << 30);
}
