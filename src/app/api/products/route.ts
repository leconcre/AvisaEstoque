import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse } from '@/lib/errors';
import { productsByEanQuerySchema } from '@/lib/validations/batch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/products?ean=<digits>
 *
 * Autocomplete para o cadastro de lote: digitou um EAN, devolvemos o produto
 * existente naquele tenant (ou 404).
 *
 * Como sempre: companyId no WHERE. Mesmo EAN pode existir em duas empresas
 * (vendedor diferente cadastrou o mesmo SKU) — cada empresa só vê o seu.
 */
export async function GET(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const url = new URL(req.url);
    const { ean } = productsByEanQuerySchema.parse({
      ean: url.searchParams.get('ean') ?? '',
    });

    const product = await prisma.product.findFirst({
      where: { companyId: ctx.companyId, ean },
      select: { id: true, name: true, ean: true },
    });

    if (!product) {
      // 200 com null em vez de 404 — é um endpoint de autocomplete; "não há"
      // é uma resposta normal do fluxo, não um erro.
      return NextResponse.json({ product: null });
    }

    return NextResponse.json({ product });
  } catch (err) {
    return toErrorResponse(err);
  }
}
