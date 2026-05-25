import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mockamos prisma ANTES de importar o MockProvider — as tools que ele chama
// internamente caem nesse mock. Isso isola o teste do banco real, validando
// SÓ o roteamento (qual tool foi chamada com quais args).
vi.mock('@/lib/prisma', () => {
  return {
    prisma: {
      batch: {
        findMany: vi.fn(async () => []),
      },
      product: {
        findMany: vi.fn(async () => []),
      },
      // searchProductIds usa $queryRaw (tagged template); mock vazio basta
      // pra validar o roteamento (queremos saber QUAL tool foi chamada,
      // não o que ela devolveu).
      $queryRaw: vi.fn(async () => []),
    },
  };
});

import { MockAssistantProvider } from '@/lib/assistant/providers/mock';

const SP_NOON = new Date('2026-05-20T15:00:00Z');

const ctx = {
  companyId: 'company_test',
  companyName: 'Empresa Teste',
  userName: 'Tester',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SP_NOON);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('MockAssistantProvider — roteamento por palavra-chave', () => {
  const provider = new MockAssistantProvider();

  it('saudação retorna help sem chamar tools', async () => {
    const r = await provider.ask(ctx, 'oi');
    expect(r.toolCalls).toEqual([]);
    expect(r.reply).toContain('Posso te ajudar');
    expect(r.unanswered).toBeFalsy();
  });

  it('"o que vence essa semana?" → getExpiringBatches(withinDays=7)', async () => {
    const r = await provider.ask(ctx, 'O que vence essa semana?');
    expect(r.toolCalls.length).toBe(1);
    expect(r.toolCalls[0]!.name).toBe('getExpiringBatches');
    const args = r.toolCalls[0]!.args as { withinDays: number };
    expect(args.withinDays).toBe(7);
  });

  it('"o que vence amanhã" → withinDays=1', async () => {
    const r = await provider.ask(ctx, 'O que vence amanhã?');
    expect(r.toolCalls[0]!.name).toBe('getExpiringBatches');
    expect((r.toolCalls[0]!.args as { withinDays: number }).withinDays).toBe(1);
  });

  it('"em 15 dias" → withinDays=15', async () => {
    const r = await provider.ask(ctx, 'O que vence em 15 dias?');
    expect((r.toolCalls[0]!.args as { withinDays: number }).withinDays).toBe(15);
  });

  it('"quantos lotes críticos?" → countByStatus + texto específico de CRITICAL', async () => {
    const r = await provider.ask(ctx, 'quantos lotes críticos?');
    expect(r.toolCalls[0]!.name).toBe('countByStatus');
    expect(r.reply).toMatch(/crítico/i);
  });

  it('"quanto tenho de iogurte" → getStockByProduct com query', async () => {
    const r = await provider.ask(ctx, 'quanto tenho de iogurte?');
    expect(r.toolCalls[0]!.name).toBe('getStockByProduct');
    expect((r.toolCalls[0]!.args as { query: string }).query.toLowerCase()).toContain('iogurte');
  });

  it('"tem refrigerante cadastrado?" → searchProducts', async () => {
    const r = await provider.ask(ctx, 'tem refrigerante cadastrado?');
    expect(r.toolCalls[0]!.name).toBe('searchProducts');
  });

  it('"qual lote está parado há mais tempo?" → getOldestBatches', async () => {
    const r = await provider.ask(ctx, 'qual lote está parado há mais tempo?');
    expect(r.toolCalls[0]!.name).toBe('getOldestBatches');
  });

  it('pergunta sem padrão → unanswered=true e ZERO tool calls (NÃO inventa)', async () => {
    const r = await provider.ask(ctx, 'qual a previsão do tempo amanhã?');
    expect(r.toolCalls).toEqual([]);
    expect(r.unanswered).toBe(true);
    expect(r.reply).toContain('Ainda não sei');
  });
});
