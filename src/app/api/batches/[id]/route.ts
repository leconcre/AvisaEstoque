import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireCompanyContext, findInTenant } from '@/lib/tenant';
import { NotFoundError, toErrorResponse } from '@/lib/errors';
import { updateBatchSchema } from '@/lib/validations/batch';
import { serializeBatch } from '@/lib/utils/batch-status';

export const runtime = 'nodejs';

type Params = { params: { id: string } };

// Tipo do row vindo do findInTenant — Prisma model + include explícito.
type BatchRow = {
  id: string;
  companyId: string;
  lotNumber: string;
  quantity: number;
  expirationDate: Date;
  alertDaysBefore: number;
  createdAt: Date;
  deletedAt: Date | null;
  product: { id: string; name: string; ean: string | null };
};

/**
 * GET /api/batches/:id
 *
 * Padrão de leitura por id no MVP. findInTenant garante companyId no WHERE.
 * Inclui filtro deletedAt: null — lotes soft-deletados não vazam por ID conhecido.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireCompanyContext();

    const batch = await findInTenant<typeof prisma.batch, BatchRow>(
      prisma.batch,
      ctx,
      { id: params.id, deletedAt: null },
      { include: { product: { select: { id: true, name: true, ean: true } } } },
    );

    if (!batch) throw new NotFoundError('Lote não encontrado.');

    return NextResponse.json(serializeBatch(batch));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PATCH /api/batches/:id
 *
 * Updates parciais. Repete o padrão de tenant: primeiro findInTenant pra
 * confirmar existência (404 com vazamento zero), depois update por id.
 * Updates devolvem o batch hidratado — útil pra UI atualizar a linha in-place.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireCompanyContext();
    const input = updateBatchSchema.parse(await req.json());

    const existing = await findInTenant<typeof prisma.batch, { id: string }>(
      prisma.batch,
      ctx,
      { id: params.id, deletedAt: null },
    );
    if (!existing) throw new NotFoundError('Lote não encontrado.');

    const updated = await prisma.batch.update({
      where: { id: existing.id },
      data: input,
      include: { product: { select: { id: true, name: true, ean: true } } },
    });

    logger.info({ event: 'batch.update', companyId: ctx.companyId, batchId: updated.id }, 'batch atualizado');
    return NextResponse.json(serializeBatch(updated));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * DELETE /api/batches/:id
 *
 * SOFT DELETE: grava deletedAt = now. Nunca apaga a linha.
 * Motivo: preservar o audit trail de Alert para a métrica "Alertas (30d)".
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireCompanyContext();

    const existing = await findInTenant<typeof prisma.batch, { id: string }>(
      prisma.batch,
      ctx,
      { id: params.id, deletedAt: null },
    );
    if (!existing) throw new NotFoundError('Lote não encontrado.');

    await prisma.batch.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    logger.info({ event: 'batch.delete', companyId: ctx.companyId, batchId: existing.id }, 'batch (soft) removido');
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
