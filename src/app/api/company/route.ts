import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse, NotFoundError } from '@/lib/errors';
import { updateCompanySchema } from '@/lib/validations/company';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/company
 * Retorna os dados da empresa do tenant logado.
 */
export async function GET() {
  try {
    const ctx = await requireCompanyContext();
    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        alertEnabled: true,
        alertTime: true,
        plan: true,
        lastScanAt: true,
        createdAt: true,
      },
    });
    if (!company) throw new NotFoundError('Empresa não encontrada.');
    return NextResponse.json(company);
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * PATCH /api/company
 * Atualiza dados da empresa. Aplica isolamento — só atualiza a do tenant.
 *
 * Nota: o JWT carrega o companyName antigo até expirar. O layout do dashboard
 * já lê o nome FRESH no Server Component (não confia no token), então a UI
 * reflete imediatamente.
 */
export async function PATCH(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const input = updateCompanySchema.parse(await req.json());

    // updateMany com WHERE companyId = ctx.companyId — não há como vazar pro tenant errado.
    const result = await prisma.company.updateMany({
      where: { id: ctx.companyId },
      data: input,
    });
    if (result.count === 0) throw new NotFoundError('Empresa não encontrada.');

    const updated = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        alertEnabled: true,
        alertTime: true,
        plan: true,
        lastScanAt: true,
      },
    });

    logger.info({ event: 'company.update', companyId: ctx.companyId, fields: Object.keys(input) }, 'empresa atualizada');
    return NextResponse.json(updated);
  } catch (err) {
    return toErrorResponse(err);
  }
}
