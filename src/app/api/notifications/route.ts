import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse } from '@/lib/errors';
import type { NotificationPayload } from '@/lib/notifications/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 *
 * Lista as últimas N (default 30) notificações da empresa logada + contador
 * de não-lidas. Pensado pra alimentar o dropdown do sino e a página dedicada.
 *
 * Querystring:
 *   - limit: 1-100 (default 30)
 *   - unread: "true" filtra só não-lidas
 *
 * Isolamento: companyId no WHERE — invariante.
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const url = new URL(req.url);
    const limitParam = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 30)));
    const onlyUnread = url.searchParams.get('unread') === 'true';

    const where = {
      companyId: ctx.companyId,
      ...(onlyUnread ? { readAt: null } : {}),
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitParam,
        select: {
          id: true,
          type: true,
          payload: true,
          readAt: true,
          createdAt: true,
          dedupKey: true,
        },
      }),
      prisma.notification.count({ where: { companyId: ctx.companyId, readAt: null } }),
    ]);

    return NextResponse.json({
      unreadCount,
      data: items.map((n) => ({
        ...n,
        // payload é Json no Prisma; tipa pra ajudar consumidores TS.
        payload: n.payload as unknown as NotificationPayload,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
