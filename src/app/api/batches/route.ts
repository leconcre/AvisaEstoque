import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse, NotFoundError } from '@/lib/errors';
import { createBatchSchema, listBatchesQuerySchema } from '@/lib/validations/batch';
import {
  serializeBatch,
  getBatchStatus,
  countByStatus,
  type BatchStatus,
  type SerializedBatch,
} from '@/lib/utils/batch-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/batches
 *
 * Filtros via querystring: status, search, sort, limit.
 * Retorna { data: SerializedBatch[], counts: {all, CRITICAL, WARNING, SAFE, EXPIRED} }.
 *
 * IMPORTANTE: counts é calculado em memória sobre o conjunto COMPLETO do tenant
 * (filtro de status NÃO altera os counts — eles refletem o universo, e os chips
 * de filtro do protótipo usam isso pra mostrar quantos lotes há em cada status).
 *
 * Não há paginação no MVP — milhares de lotes por empresa estão dentro do
 * regime de "todo no payload é OK".
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const url = new URL(req.url);
    const query = listBatchesQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    // companyId no WHERE — invariante de isolamento.
    // deletedAt: null — soft delete: lotes removidos não voltam na listagem.
    const where: Record<string, unknown> = {
      companyId: ctx.companyId,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { lotNumber: { contains: query.search, mode: 'insensitive' } },
        { product: { name: { contains: query.search, mode: 'insensitive' } } },
        { product: { ean: { contains: query.search } } },
      ];
    }

    // Ordenação no banco. Status é derivado → ordenar por expiration é o proxy
    // natural para "ordene por proximidade do problema" (que o protótipo usa).
    const orderBy =
      query.sort === 'created'
        ? { createdAt: 'desc' as const }
        : query.sort === 'product'
        ? { product: { name: 'asc' as const } }
        : { expirationDate: 'asc' as const };

    const raw = await prisma.batch.findMany({
      where,
      include: { product: { select: { id: true, name: true, ean: true } } },
      orderBy,
    });

    const counts = countByStatus(raw);
    let data = raw.map(serializeBatch);

    // Aplica filtro de status DEPOIS de calcular counts. Filtrar em SQL exigiria
    // replicar o CASE WHEN de getBatchStatus — proibido (fonte única).
    if (query.status !== 'all') {
      const target = query.status as BatchStatus;
      data = data.filter((b) => b.status === target);
    }

    if (query.limit) {
      data = data.slice(0, query.limit);
    }

    return NextResponse.json({
      data,
      counts: {
        all: counts.all,
        critical: counts.CRITICAL,
        warning: counts.WARNING,
        safe: counts.SAFE,
        expired: counts.EXPIRED,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/batches
 *
 * Cria lote (e cria Product se EAN informado não existir no tenant).
 * Retorna o objeto Batch HIDRATADO (com product, status, daysUntilExpiration)
 * — o protótipo usa o objeto retornado para o row-flash sem refetch (HANDOFF §4.2).
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const body = (await req.json()) as unknown;
    const input = createBatchSchema.parse(body);

    // Resolve productId. Três caminhos:
    //   1. Veio productId: confirma que pertence ao tenant.
    //   2. Veio EAN + name: tenta achar Product (companyId, ean) — cria se não houver.
    //   3. Veio só name (sem EAN): cria Product novo.
    let productId: string;

    if (input.productId) {
      const existing = await prisma.product.findFirst({
        where: { id: input.productId, companyId: ctx.companyId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundError('Produto não encontrado.');
      }
      productId = existing.id;
    } else if (input.ean) {
      const found = await prisma.product.findFirst({
        where: { companyId: ctx.companyId, ean: input.ean },
        select: { id: true },
      });
      if (found) {
        productId = found.id;
      } else {
        const created = await prisma.product.create({
          data: { companyId: ctx.companyId, name: input.productName!, ean: input.ean },
          select: { id: true },
        });
        productId = created.id;
      }
    } else {
      const created = await prisma.product.create({
        data: { companyId: ctx.companyId, name: input.productName! },
        select: { id: true },
      });
      productId = created.id;
    }

    const created = await prisma.batch.create({
      data: {
        companyId: ctx.companyId,
        productId,
        lotNumber: input.lotNumber,
        quantity: input.quantity,
        expirationDate: input.expirationDate,
        alertDaysBefore: input.alertDaysBefore,
      },
      include: { product: { select: { id: true, name: true, ean: true } } },
    });

    const serialized: SerializedBatch = serializeBatch(created);

    logger.info(
      {
        event: 'batch.create',
        companyId: ctx.companyId,
        batchId: created.id,
        status: serialized.status,
      },
      'batch criado',
    );

    return NextResponse.json(serialized, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// Helper: dado a UI quer também `nextStatusInfo`, mas adicionar agora seria
// over-engineering. Quando aparecer, soma aqui sem mudar contrato.
export type { SerializedBatch };
export { getBatchStatus };
