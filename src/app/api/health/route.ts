import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * Endpoint público (sem auth) usado pelo Coolify (e qualquer healthchecker
 * externo) para liveness/readiness. Faz um `SELECT 1` no banco — se o app
 * está de pé mas o banco caiu, retornamos 503 para que o orquestrador marque
 * unhealthy e tente reiniciar / não rotear tráfego.
 *
 * SEM segredo: o endpoint não revela nada além de "up/down".
 * SEM cache: dynamic=force-dynamic para o Coolify ver estado atual.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: 'ok',
        uptimeMs: process.uptime() * 1000,
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error({ event: 'health.db_fail', err }, 'healthcheck: DB inalcançável');
    return NextResponse.json(
      {
        status: 'degraded',
        error: 'database_unreachable',
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
