import { auth } from '@/auth';
import { UnauthorizedError } from './errors';
import type { Session } from 'next-auth';

/**
 * Contexto de tenant — companyId + dados do usuário logado.
 * Único ponto autorizado para obter o tenant ativo.
 */
export type TenantContext = {
  userId: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
};

/**
 * Extrai o tenant da sessão. Lança UnauthorizedError se não houver sessão.
 *
 * Uso típico em route handler:
 *   const ctx = await requireCompanyContext();
 *   const batches = await prisma.batch.findMany({ where: { companyId: ctx.companyId } });
 *
 * Em Server Component:
 *   const ctx = await requireCompanyContext();   // throw redireciona via middleware
 */
export async function requireCompanyContext(): Promise<TenantContext> {
  const session = await auth();
  return contextFromSession(session);
}

/**
 * Versão sync para quando você já tem a session em mãos (ex: Server Action
 * com session vinda do prop). Mesmo contrato.
 */
export function contextFromSession(session: Session | null): TenantContext {
  if (!session?.user?.companyId) {
    throw new UnauthorizedError('Sessão inválida ou expirada.');
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    companyId: session.user.companyId,
    companyName: session.user.companyName ?? '',
  };
}

/**
 * Helper que CIMENTA o padrão multi-tenant na leitura de recurso por ID.
 *
 * Use sempre que precisar buscar UM batch/product/alert por id. Garante que:
 *   - companyId entra no WHERE da query (não em checagem pós-busca);
 *   - retornar null vira 404 — sem vazar existência do recurso de outro tenant.
 *
 * Exemplo:
 *   const batch = await findInTenant<typeof prisma.batch, MeuShape>(
 *     prisma.batch, ctx, { id: params.id, deletedAt: null },
 *     { include: { product: true } },
 *   );
 *   if (!batch) throw new NotFoundError('Lote não encontrado.');
 *
 * Nota sobre tipos: Prisma delegates têm assinaturas genéricas muito específicas
 * (SelectSubset etc.) que não casam bem com um helper polimórfico. Aceitamos
 * `any` interno em troca de um contrato externo simples; o que importa é
 * forçar o padrão de chamada (where com companyId), e isso o helper faz.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDelegate = { findFirst: (args: any) => Promise<any> };

export async function findInTenant<_TDelegate extends AnyDelegate, TResult>(
  delegate: _TDelegate,
  ctx: Pick<TenantContext, 'companyId'>,
  where: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: { include?: any; select?: any },
): Promise<TResult | null> {
  return delegate.findFirst({
    where: { ...where, companyId: ctx.companyId },
    ...(options?.include ? { include: options.include } : {}),
    ...(options?.select ? { select: options.select } : {}),
  }) as Promise<TResult | null>;
}
