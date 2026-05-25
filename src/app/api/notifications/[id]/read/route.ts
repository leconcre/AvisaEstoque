import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext, findInTenant } from '@/lib/tenant';
import { NotFoundError, toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/:id/read
 *
 * Marca uma notificação como lida. Idempotente — chamar 2x não faz mal,
 * só atualiza readAt para o timestamp atual no primeiro.
 *
 * Isolamento via findInTenant — 404 sem vazar existência entre tenants.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireCompanyContext();

    const existing = await findInTenant<typeof prisma.notification, { id: string; readAt: Date | null }>(
      prisma.notification,
      ctx,
      { id: params.id },
    );
    if (!existing) throw new NotFoundError('Notificação não encontrada.');

    // Já lida? Não regrava (preserva o timestamp original — primeira leitura é a verdadeira).
    if (existing.readAt) {
      return NextResponse.json({ id: existing.id, readAt: existing.readAt.toISOString() });
    }

    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true },
    });

    return NextResponse.json({
      id: updated.id,
      readAt: updated.readAt!.toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
