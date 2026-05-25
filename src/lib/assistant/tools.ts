import { prisma } from '@/lib/prisma';
import { todayCivilSP } from '@/lib/utils/today';
import {
  countByStatus as countByStatusUtil,
  getBatchStatus,
  daysUntilExpiration,
  type BatchStatus,
} from '@/lib/utils/batch-status';

/**
 * TOOLS DO ASSISTENTE — funções TS determinísticas, tenant-safe e testáveis.
 *
 * INVARIANTES (não-negociáveis):
 *   - TODA query passa companyId no WHERE. Não há "tools globais".
 *   - Filtro deletedAt: null em tudo que envolve Batch (soft delete).
 *   - getBatchStatus é a ÚNICA fonte da regra de status (reusa do core).
 *   - Funções retornam dados ESTRUTURADOS (não strings) — quem renderiza
 *     pra texto é o AssistantProvider. Permite o LLM real fazer
 *     formatação rica sem reparsing.
 *
 * ANTI-ALUCINAÇÃO:
 *   - Toda resposta sobre estoque vem do RETORNO DESSAS FUNÇÕES.
 *   - Se nenhuma cobre a pergunta, o assistente diz "não sei" — não
 *     improvisa números. Isso é o que torna o assistente confiável num
 *     produto de estoque.
 *
 * Como integrar com LLM real (quando ligar Anthropic):
 *   - Expor cada função como tool com schema JSON.
 *   - O LLM decide qual chamar e com que args.
 *   - O EXECUTOR continua sendo o código abaixo — tenant-safe garantido.
 */

export type ToolName =
  | 'getExpiringBatches'
  | 'getStockByProduct'
  | 'countByStatus'
  | 'searchProducts'
  | 'getOldestBatches';

/** Subset de Batch suficiente pra qualquer resposta — sem expor IDs internos do produto além do necessário. */
export type ToolBatch = {
  productName: string;
  ean: string | null;
  lotNumber: string;
  quantity: number;
  expirationDate: string; // YYYY-MM-DD
  status: BatchStatus;
  daysUntilExpiration: number;
};

export type ToolProduct = {
  productName: string;
  ean: string | null;
  totalQuantity: number;
  activeBatches: number;
};

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function serialize(b: {
  expirationDate: Date;
  alertDaysBefore: number;
  lotNumber: string;
  quantity: number;
  product: { name: string; ean: string | null };
}): ToolBatch {
  return {
    productName: b.product.name,
    ean: b.product.ean,
    lotNumber: b.lotNumber,
    quantity: b.quantity,
    expirationDate: toIsoDate(b.expirationDate),
    status: getBatchStatus({ expirationDate: b.expirationDate, alertDaysBefore: b.alertDaysBefore }),
    daysUntilExpiration: daysUntilExpiration(b.expirationDate),
  };
}

/**
 * Lotes que vencem nos próximos `withinDays` dias. Vencidos inclusos por padrão
 * (`includeExpired=true`) — gerente quer ver tudo que demanda ação.
 */
export async function getExpiringBatches(args: {
  companyId: string;
  withinDays: number;
  includeExpired?: boolean;
  limit?: number;
}): Promise<ToolBatch[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
  const today = todayCivilSP();
  const upperBound = new Date(today);
  upperBound.setUTCDate(upperBound.getUTCDate() + Math.max(0, args.withinDays));

  const lowerBound = args.includeExpired === false ? today : undefined;

  const batches = await prisma.batch.findMany({
    where: {
      companyId: args.companyId,
      deletedAt: null,
      quantity: { gt: 0 },
      expirationDate: {
        lte: upperBound,
        ...(lowerBound ? { gte: lowerBound } : {}),
      },
    },
    include: { product: { select: { name: true, ean: true } } },
    orderBy: { expirationDate: 'asc' },
    take: limit,
  });

  return batches.map(serialize);
}

/**
 * Estoque agregado por produto que case com `query` (nome ou EAN).
 * Soma quantidades de TODOS os lotes ativos (não-deletados, qty > 0).
 */
export async function getStockByProduct(args: {
  companyId: string;
  query: string;
  limit?: number;
}): Promise<ToolProduct[]> {
  const term = args.query.trim();
  if (!term) return [];
  const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
  const productIds = await searchProductIds(args.companyId, term, limit);
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId: args.companyId },
    include: {
      batches: {
        where: { deletedAt: null, quantity: { gt: 0 } },
        select: { quantity: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    productName: p.name,
    ean: p.ean,
    totalQuantity: p.batches.reduce((sum, b) => sum + b.quantity, 0),
    activeBatches: p.batches.length,
  }));
}

/**
 * Busca por nome/EAN com unaccent (accent-insensitive) — necessário em pt-BR
 * porque "Sabonete Líquido" no banco NÃO casa "sabonete liquido" no input
 * via ILIKE puro. Retorna apenas IDs do tenant correto (companyId no WHERE).
 *
 * Usamos $queryRaw pra invocar unaccent(); Prisma não tem builder declarativo
 * pra isso. Bind seguro via Prisma.sql — sem SQL injection.
 */
async function searchProductIds(companyId: string, term: string, limit: number): Promise<string[]> {
  if (/^\d{8}$|^\d{13}$/.test(term)) {
    // EAN: comparação exata, sem unaccent (números não têm acento).
    const rows = await prisma.product.findMany({
      where: { companyId, ean: term },
      select: { id: true },
      take: limit,
    });
    return rows.map((r) => r.id);
  }
  // Nome: substring com unaccent dos dois lados.
  const pattern = `%${term}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Product"
    WHERE "companyId" = ${companyId}
      AND unaccent("name") ILIKE unaccent(${pattern})
    ORDER BY "name" ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

/**
 * Contadores por status — mesma regra do painel/lista. Útil pra perguntas
 * tipo "quantos lotes críticos eu tenho?" sem inventar.
 */
export async function countByStatus(args: { companyId: string }): Promise<{
  CRITICAL: number;
  WARNING: number;
  SAFE: number;
  EXPIRED: number;
  all: number;
}> {
  const batches = await prisma.batch.findMany({
    where: { companyId: args.companyId, deletedAt: null },
    select: { expirationDate: true, alertDaysBefore: true },
  });
  const c = countByStatusUtil(batches);
  return {
    CRITICAL: c.CRITICAL,
    WARNING: c.WARNING,
    SAFE: c.SAFE,
    EXPIRED: c.EXPIRED,
    all: c.all,
  };
}

/**
 * Busca produto por nome (substring case-insensitive) ou EAN. Diferente de
 * getStockByProduct: retorna info do produto SEM agregar estoque (mais leve,
 * útil para "Tem cadastrado X?").
 */
export async function searchProducts(args: {
  companyId: string;
  term: string;
  limit?: number;
}): Promise<Array<{ productName: string; ean: string | null }>> {
  const term = args.term.trim();
  if (!term) return [];
  const limit = Math.max(1, Math.min(args.limit ?? 10, 30));
  const ids = await searchProductIds(args.companyId, term, limit);
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, companyId: args.companyId },
    select: { name: true, ean: true },
    orderBy: { name: 'asc' },
  });
  return products.map((p) => ({ productName: p.name, ean: p.ean }));
}

/**
 * Lotes mais antigos AINDA EM ESTOQUE — útil pra responder "qual lote está
 * parado há mais tempo?". Ordena por createdAt asc.
 */
export async function getOldestBatches(args: {
  companyId: string;
  limit?: number;
}): Promise<ToolBatch[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
  const batches = await prisma.batch.findMany({
    where: { companyId: args.companyId, deletedAt: null, quantity: { gt: 0 } },
    include: { product: { select: { name: true, ean: true } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return batches.map(serialize);
}
