import { prisma } from '@/lib/prisma';
import { todayCivilSP } from '@/lib/utils/today';

/**
 * Camada de leitura/incremento de AssistantUsage.
 *
 * INCREMENTO ATÔMICO: usamos upsert + update increment, dentro de uma única
 * chamada do Prisma. Isso é atômico no Postgres porque o @@unique([companyId, day])
 * garante linha única — duas requisições concorrentes serializam no nível do row.
 *
 * VERIFICAÇÃO DO LIMITE: feita ANTES de chamar o provider. Em corrida (duas
 * requests no mesmo ms), ambas podem passar pela verificação com count=N-1,
 * incrementar pra N e N+1 — o usuário ganha 1 query a mais que o cap. É
 * aceitável: o limite serve como ordem de grandeza, não fiscal. Pra ser
 * estrito-estrito, precisaria de SELECT FOR UPDATE.
 */

export type UsageSnapshot = {
  day: Date;       // hoje civil SP (00:00 UTC)
  used: number;    // perguntas já feitas
  remaining: number;
  limit: number;
};

export async function getUsage(companyId: string, limit: number): Promise<UsageSnapshot> {
  const day = todayCivilSP();
  const row = await prisma.assistantUsage.findUnique({
    where: { companyId_day: { companyId, day } },
    select: { count: true },
  });
  const used = row?.count ?? 0;
  return {
    day,
    used,
    remaining: Math.max(0, limit - used),
    limit,
  };
}

/** Incrementa o contador do dia. Cria a linha se não existir. */
export async function incrementUsage(companyId: string): Promise<number> {
  const day = todayCivilSP();
  const updated = await prisma.assistantUsage.upsert({
    where: { companyId_day: { companyId, day } },
    create: { companyId, day, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return updated.count;
}
