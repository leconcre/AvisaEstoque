import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/read-all
 *
 * Marca TODAS as notificações não-lidas da empresa como lidas. Útil pro
 * botão "marcar todas como lidas" no dropdown do sino.
 *
 * Isolamento via WHERE companyId — updateMany respeitando tenant.
 */
export async function POST() {
  try {
    const ctx = await requireCompanyContext();

    const result = await prisma.notification.updateMany({
      where: { companyId: ctx.companyId, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ markedRead: result.count });
  } catch (err) {
    return toErrorResponse(err);
  }
}
