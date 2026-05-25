import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { registerSchema } from '@/lib/validations/auth';
import { ConflictError, toErrorResponse } from '@/lib/errors';
import { ensureRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/auth/register
 *
 * Cria Company + User na MESMA transação. Se a criação do User falhar
 * (email duplicado → P2002), a transação faz rollback e a Company não fica
 * orfã no banco.
 *
 * Rate limit: 10 req/min por IP (compartilhado com login).
 * Idempotência: não tem — registro é operação singular. O cliente que repetir
 * com email igual recebe 409.
 */
export async function POST(req: Request) {
  try {
    // Rate limit antes de tudo. Custo de bcrypt + transação é alto demais
    // pra deixar passar uma sondagem.
    const ip = getClientIp(req);
    ensureRateLimit({ key: `register:${ip}`, limit: 10, windowMs: 60_000 });

    const body = (await req.json()) as unknown;
    const data = registerSchema.parse(body);

    const passwordHash = await bcrypt.hash(data.password, 12);

    // $transaction interativa: tudo-ou-nada. Mesmo timeout default (5s) é
    // generoso pra duas linhas — não há motivo pra customizar.
    const { company, user } = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          whatsappPhone: data.whatsappPhone,
          alertTime: data.alertTime,
          alertEnabled: true,
        },
      });

      // Se P2002 disparar aqui, o ROLLBACK derruba a Company criada acima.
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          companyId: company.id,
        },
      });

      return { company, user };
    });

    logger.info(
      { event: 'register.ok', userId: user.id, companyId: company.id },
      'novo cadastro',
    );

    // Resposta enxuta. NÃO incluímos email/telefone — LGPD (e desnecessário,
    // o cliente já tem esses dados).
    return NextResponse.json(
      {
        company: { id: company.id, name: company.name },
        user: { id: user.id, name: user.name },
      },
      { status: 201 },
    );
  } catch (err) {
    // P2002 = unique constraint violation. Mapeamos pro nosso 409 amigável.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = (err.meta?.target as string[] | undefined)?.join(',') ?? '';
      const friendly =
        target.includes('email')
          ? 'E-mail já cadastrado.'
          : 'Já existe um registro com esses dados.';
      return toErrorResponse(new ConflictError(friendly));
    }
    return toErrorResponse(err);
  }
}
