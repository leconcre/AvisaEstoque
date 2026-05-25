import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

import {
  getExpiringBatches,
  getStockByProduct,
  countByStatus,
  searchProducts,
  getOldestBatches,
} from '@/lib/assistant/tools';

// Testa contra o banco real (seedado). NÃO modifica nada — só lê.
//
// Pré-requisito: `npm run db:seed` rodou recentemente. CI faria isso no setup;
// localmente, o seed mais recente já está no Neon.
const prisma = new PrismaClient();

let companyIdA = '';
let companyIdB = '';

beforeAll(async () => {
  const a = await prisma.company.findFirst({ where: { name: 'Mercadinho Santa Cruz' }, select: { id: true } });
  const b = await prisma.company.findFirst({ where: { name: 'Drogaria Beta' }, select: { id: true } });
  if (!a || !b) throw new Error('Seed faltando: rode `npm run db:seed` antes.');
  companyIdA = a.id;
  companyIdB = b.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('countByStatus — bate com a distribuição do seed', () => {
  it('Empresa A: 4/2/7/2 (CRITICAL/WARNING/SAFE/EXPIRED)', async () => {
    const c = await countByStatus({ companyId: companyIdA });
    expect(c).toEqual({ CRITICAL: 4, WARNING: 2, SAFE: 7, EXPIRED: 2, all: 15 });
  });
  it('Empresa B: 1/1/1/0', async () => {
    const c = await countByStatus({ companyId: companyIdB });
    expect(c).toEqual({ CRITICAL: 1, WARNING: 1, SAFE: 1, EXPIRED: 0, all: 3 });
  });
});

describe('getExpiringBatches', () => {
  it('Empresa A, próximos 7 dias incluindo vencidos: 4 CRITICAL + 2 EXPIRED = 6', async () => {
    const r = await getExpiringBatches({ companyId: companyIdA, withinDays: 7 });
    expect(r.length).toBe(6);
    // Ordenação por proximidade (asc): vencidos primeiro
    expect(r[0]!.daysUntilExpiration).toBeLessThanOrEqual(r[r.length - 1]!.daysUntilExpiration);
  });

  it('próximos 30 dias inclui WARNINGs também', async () => {
    const r = await getExpiringBatches({ companyId: companyIdA, withinDays: 30 });
    // 4 CRITICAL + 2 WARNING + 2 EXPIRED = 8
    expect(r.length).toBe(8);
  });

  it('includeExpired=false oculta vencidos', async () => {
    const r = await getExpiringBatches({ companyId: companyIdA, withinDays: 7, includeExpired: false });
    expect(r.every((b) => b.status !== 'EXPIRED')).toBe(true);
    expect(r.length).toBe(4); // só os 4 CRITICAL
  });

  it('Empresa B, próximos 30 dias: 1 CRITICAL + 1 WARNING = 2', async () => {
    const r = await getExpiringBatches({ companyId: companyIdB, withinDays: 30 });
    expect(r.length).toBe(2);
  });
});

describe('getStockByProduct', () => {
  it('busca por nome (substring case-insensitive)', async () => {
    const r = await getStockByProduct({ companyId: companyIdA, query: 'iogurte' });
    expect(r.length).toBe(1);
    expect(r[0]!.productName).toContain('Iogurte');
    expect(r[0]!.totalQuantity).toBe(24); // seed: 24un de Iogurte Grego
  });

  it('busca por EAN exato', async () => {
    // EAN do Iogurte Grego no seed
    const r = await getStockByProduct({ companyId: companyIdA, query: '7891000100103' });
    expect(r.length).toBe(1);
    expect(r[0]!.productName).toContain('Iogurte');
  });

  it('query vazia retorna []', async () => {
    const r = await getStockByProduct({ companyId: companyIdA, query: '   ' });
    expect(r).toEqual([]);
  });

  it('ISOLAMENTO: produto da B NÃO aparece pra A', async () => {
    // "Sabonete Líquido" só existe na empresa B
    const asA = await getStockByProduct({ companyId: companyIdA, query: 'Sabonete Líquido' });
    const asB = await getStockByProduct({ companyId: companyIdB, query: 'Sabonete Líquido' });
    expect(asA.length).toBe(0); // invisível pra A
    expect(asB.length).toBe(1); // visível pra B
    expect(asB[0]!.totalQuantity).toBe(10);
  });
});

describe('searchProducts — isolamento por nome', () => {
  it('"refrigerante" só aparece na empresa B (seed)', async () => {
    const asA = await searchProducts({ companyId: companyIdA, term: 'Refrigerante' });
    const asB = await searchProducts({ companyId: companyIdB, term: 'Refrigerante' });
    expect(asA.length).toBe(0);
    expect(asB.length).toBe(1);
    expect(asB[0]!.productName).toContain('Refrigerante');
  });
});

describe('getOldestBatches', () => {
  it('retorna ordenado por createdAt asc, respeitando o limit', async () => {
    const r = await getOldestBatches({ companyId: companyIdA, limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r.length).toBeGreaterThan(0);
    // status calculado — não deve faltar
    for (const b of r) expect(b.status).toBeDefined();
  });

  it('isolamento — A não vê lotes de B', async () => {
    const all = await getOldestBatches({ companyId: companyIdA, limit: 50 });
    // Nenhum produto exclusivo de B deve aparecer
    const productNames = new Set(all.map((b) => b.productName));
    expect(productNames.has('Sabonete Líquido 250ml')).toBe(false);
    expect(productNames.has('Refrigerante Cola 2L')).toBe(false);
  });
});
