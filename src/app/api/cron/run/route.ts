import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { runExpirationScan } from '@/lib/jobs/check-expirations';
import { toErrorResponse, UnauthorizedError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/run
 *
 * Trigger manual do scanner. Protegido por header `X-Cron-Secret` (compara
 * com CRON_SECRET do env). É o ÚNICO endpoint da app sem sessão de usuário.
 *
 * Em DEV usado pra forçar varredura sem esperar o scheduler.
 * Em PROD serverless é o endpoint que o cron HTTP externo (Vercel Cron,
 * cron-job.org, GitHub Actions) bate periodicamente.
 *
 * Aceita query params opcionais:
 *   - companyId=<id>   → escaneia só essa empresa
 *   - slot=HH:mm       → escaneia só empresas com alertTime=slot
 *                        (usado pelos cron HTTP — bater de 15 em 15 min e passar
 *                        o slot atual evita varredura desnecessária)
 *
 * Sem query params: escaneia TODAS as empresas com alertEnabled=true.
 */
export async function POST(req: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const provided = req.headers.get('x-cron-secret');
    if (!expected || !provided || provided !== expected) {
      logger.warn({ event: 'cron.auth_fail' }, 'tentativa de acesso a /api/cron/run sem secret correto');
      throw new UnauthorizedError('Secret inválido.');
    }

    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId') ?? undefined;
    const slot = url.searchParams.get('slot') ?? undefined;

    const summary = await runExpirationScan({
      onlyCompanyId: companyId,
      slotHHmm: slot,
    });

    return NextResponse.json({
      ok: true,
      startedAt: summary.startedAt.toISOString(),
      finishedAt: summary.finishedAt.toISOString(),
      scanned: summary.scanned,
      results: summary.results,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
