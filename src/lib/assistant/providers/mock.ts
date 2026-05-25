import { logger } from '@/lib/logger';
import {
  countByStatus,
  getExpiringBatches,
  getOldestBatches,
  getStockByProduct,
  searchProducts,
  type ToolBatch,
} from '../tools';
import type {
  AssistantContext,
  AssistantProvider,
  AssistantResponse,
  AssistantToolCall,
} from '../provider';

/**
 * MockAssistantProvider — roteador determinístico por palavras-chave.
 *
 * É o provider ATIVO no MVP. Não usa LLM. Toda resposta é renderizada a
 * partir do retorno das tools, NUNCA inventa números — se nenhuma regra
 * casa, responde "não sei" com `unanswered: true` (a UI mostra dica de
 * reformular).
 *
 * Pensado para cobrir os ~10 padrões de pergunta mais comuns que o gerente
 * faz no dia a dia. A análise é feita por:
 *   1. normalização da mensagem (lowercase, sem acento)
 *   2. matching de regex/keywords ordenadas por especificidade
 *   3. extração de variáveis simples (janela de dias, nome de produto)
 *
 * Trocar isso por LLM real é "uma classe nova" (AnthropicAssistantProvider)
 * — esta camada de Mock continua útil como fallback offline e como base
 * dos testes determinísticos.
 */

export class MockAssistantProvider implements AssistantProvider {
  readonly name = 'mock';

  async ask(ctx: AssistantContext, message: string): Promise<AssistantResponse> {
    const norm = normalize(message);
    const toolCalls: AssistantToolCall[] = [];

    // ----- Atalhos rápidos -----

    // "oi" / "olá" / "ajuda" / "help"
    if (/^(oi|ola|ajuda|help|menu)\b/.test(norm)) {
      return reply(helpText(ctx), toolCalls);
    }

    // ----- Padrão: "quantos lotes criticos / em atencao / seguros / vencidos / no total" -----
    const statusKeywordMap: Array<{ re: RegExp; key: 'CRITICAL' | 'WARNING' | 'SAFE' | 'EXPIRED' | 'all' }> = [
      { re: /\b(critic|urgent)/, key: 'CRITICAL' },
      { re: /\b(atenc|aviso|alerta amarelo|warning)\b/, key: 'WARNING' },
      { re: /\b(seguro|safe|tranquilo)\b/, key: 'SAFE' },
      { re: /\b(vencid|expir)/, key: 'EXPIRED' },
      { re: /\b(total|tudo|todos os lotes|quantos lotes? (no )?(tot|geral|cadastrad))/, key: 'all' },
    ];
    if (/\bquant/.test(norm) && /\blotes?\b/.test(norm)) {
      const counts = await countByStatus({ companyId: ctx.companyId });
      toolCalls.push({ name: 'countByStatus', args: {}, result: counts });
      const match = statusKeywordMap.find(({ re }) => re.test(norm));
      if (match) {
        const n = counts[match.key];
        return reply(formatStatusCount(match.key, n), toolCalls);
      }
      // Sem qualificador → resumo dos 4
      return reply(formatCountsSummary(counts), toolCalls);
    }

    // ----- Padrão: "o que vence em X dias / essa semana / esse mes / amanha / hoje" -----
    const expiryMatch = matchExpiryWindow(norm);
    if (expiryMatch !== null) {
      const batches = await getExpiringBatches({
        companyId: ctx.companyId,
        withinDays: expiryMatch.withinDays,
        includeExpired: expiryMatch.includeExpired,
        limit: 30,
      });
      toolCalls.push({
        name: 'getExpiringBatches',
        args: { withinDays: expiryMatch.withinDays, includeExpired: expiryMatch.includeExpired },
        result: batches,
      });
      return reply(formatExpiringList(batches, expiryMatch.label), toolCalls);
    }

    // ----- Padrão: "quanto tenho de X" / "quanto de X em estoque" -----
    const stockMatch = matchStockQuery(norm, message);
    if (stockMatch !== null) {
      const products = await getStockByProduct({ companyId: ctx.companyId, query: stockMatch });
      toolCalls.push({ name: 'getStockByProduct', args: { query: stockMatch }, result: products });
      return reply(formatStockList(stockMatch, products), toolCalls);
    }

    // ----- Padrão: "tem X cadastrado" / "voce tem X" -----
    const searchMatch = matchSearchQuery(norm, message);
    if (searchMatch !== null) {
      const products = await searchProducts({ companyId: ctx.companyId, term: searchMatch });
      toolCalls.push({ name: 'searchProducts', args: { term: searchMatch }, result: products });
      return reply(formatSearch(searchMatch, products), toolCalls);
    }

    // ----- Padrão: "lote mais antigo / parado ha mais tempo" -----
    if (/\bmais antigo\b|parado h[áa]\b|parado por mais\b/.test(norm)) {
      const batches = await getOldestBatches({ companyId: ctx.companyId, limit: 5 });
      toolCalls.push({ name: 'getOldestBatches', args: { limit: 5 }, result: batches });
      return reply(formatOldest(batches), toolCalls);
    }

    // ----- Não casou nada — não inventar -----
    logger.debug({ event: 'assistant.unanswered', companyId: ctx.companyId, message: message.slice(0, 80) }, 'mock não roteou');
    return {
      reply:
        'Ainda não sei responder isso. Tente algo como:\n' +
        '• "o que vence essa semana?"\n' +
        '• "quanto tenho de iogurte?"\n' +
        '• "quantos lotes críticos?"\n' +
        '• "qual lote está parado há mais tempo?"',
      toolCalls,
      unanswered: true,
    };
  }
}

// ============================================================================
// Helpers de NLU básico (regex / heurística)
// ============================================================================

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim();
}

function matchExpiryWindow(
  norm: string,
): { withinDays: number; includeExpired: boolean; label: string } | null {
  // "hoje" → 0d
  if (/\b(o que )?vence (hoje|agora)\b/.test(norm)) {
    return { withinDays: 0, includeExpired: false, label: 'hoje' };
  }
  // "amanhã"
  if (/\b(o que )?vence amanha\b/.test(norm)) {
    return { withinDays: 1, includeExpired: false, label: 'até amanhã' };
  }
  // "essa semana / esta semana / próxima semana"
  if (/\b(o que |produtos? que )?(vence|vencer[aá]?|vai vencer) (n?essa|nesta|na proxima) semana\b/.test(norm) ||
      /\b(o que )?vence em uma semana\b/.test(norm)) {
    return { withinDays: 7, includeExpired: true, label: 'nos próximos 7 dias' };
  }
  // "esse mês / no mes"
  if (/\bvence (n?esse|neste|no proximo) mes\b/.test(norm) || /\bvence em 30 dias\b/.test(norm)) {
    return { withinDays: 30, includeExpired: true, label: 'nos próximos 30 dias' };
  }
  // "em X dias"
  const m = norm.match(/\b(em|nos? proximos?|dentro de) (\d{1,3}) dias?\b/);
  if (m) {
    const days = Math.min(365, Number.parseInt(m[2]!, 10));
    return { withinDays: days, includeExpired: true, label: `nos próximos ${days} dias` };
  }
  // genérico "o que vence" → 7 dias por padrão
  if (/\b(o que )?(vence|vai vencer)\b/.test(norm)) {
    return { withinDays: 7, includeExpired: true, label: 'nos próximos 7 dias' };
  }
  // "vencidos" / "lotes vencidos"
  if (/\b(lotes? )?vencid[oa]s?\b/.test(norm) && !/\bquantos? lotes?\b/.test(norm)) {
    return { withinDays: 0, includeExpired: true, label: 'vencidos' };
  }
  return null;
}

function matchStockQuery(norm: string, original: string): string | null {
  // "quanto tenho de X", "quanto de X", "quanto X em estoque"
  const patterns: RegExp[] = [
    /\bquant[oa] (tenho )?de (?<q>.+?)(?: em estoque)?(?:\?|$)/,
    /\bestoque de (?<q>.+?)(?:\?|$)/,
    /\btenho (de )?(?<q>.+?) em estoque(?:\?|$)/,
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (m?.groups?.q) {
      // Mapeia de volta pro texto original (preserva acento/case) usando posição.
      return extractOriginalSlice(norm, original, m.groups.q);
    }
  }
  return null;
}

function matchSearchQuery(norm: string, original: string): string | null {
  const patterns: RegExp[] = [
    /\btem (?<q>.+?) cadastrad/,
    /\bvoc[eê] tem (?<q>.+?)(?:\?|$)/,
    /\bproduto (?<q>.+?) existe/,
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (m?.groups?.q) return extractOriginalSlice(norm, original, m.groups.q);
  }
  return null;
}

function extractOriginalSlice(_norm: string, original: string, normSlice: string): string {
  // Heurística simples: pega tudo do original que casa com o tamanho do slice.
  // Pra MVP, devolve o slice normalizado em sí já serve pras buscas
  // case-insensitive das tools (contains mode insensitive).
  // (Manter o slice "iogurte" basta — sem acento — porque o LIKE %iogurte%
  // pega "Iogurte Grego".)
  const cleaned = normSlice.replace(/[?.,!]+$/, '').trim();
  // Se o slice for um EAN, usa direto.
  if (/^\d{8}$|^\d{13}$/.test(cleaned)) return cleaned;
  // Senão, tenta achar o trecho na string original ignorando acentos:
  // simplificação aceitável — pega só o cleaned mesmo.
  void original;
  return cleaned;
}

// ============================================================================
// Renderizadores de resposta
// ============================================================================

function helpText(ctx: AssistantContext): string {
  return (
    `Oi, ${ctx.userName}! Posso te ajudar com seu estoque. Tente perguntar:\n\n` +
    '• "O que vence essa semana?"\n' +
    '• "Quanto tenho de iogurte?"\n' +
    '• "Quantos lotes críticos?"\n' +
    '• "Qual lote está parado há mais tempo?"\n' +
    '• "Tem refrigerante cadastrado?"\n\n' +
    '_Só respondo com base em lotes do seu próprio estoque — sem chutar números._'
  );
}

function formatStatusCount(
  key: 'CRITICAL' | 'WARNING' | 'SAFE' | 'EXPIRED' | 'all',
  n: number,
): string {
  const labels = {
    CRITICAL: 'em estado *crítico* (≤7 dias para vencer)',
    WARNING: 'em *atenção* (≤30 dias)',
    SAFE: 'em estado *seguro* (>30 dias)',
    EXPIRED: '*vencidos*',
    all: 'cadastrados (ativos)',
  };
  return `Você tem *${n}* ${n === 1 ? 'lote' : 'lotes'} ${labels[key]}.`;
}

function formatCountsSummary(c: {
  CRITICAL: number; WARNING: number; SAFE: number; EXPIRED: number; all: number;
}): string {
  return (
    `📊 Resumo do seu estoque:\n\n` +
    `🚨 Críticos (≤7d): *${c.CRITICAL}*\n` +
    `⏰ Atenção (≤30d): *${c.WARNING}*\n` +
    `✅ Seguros (>30d): *${c.SAFE}*\n` +
    `⛔ Vencidos: *${c.EXPIRED}*\n\n` +
    `Total: *${c.all}* ${c.all === 1 ? 'lote' : 'lotes'}.`
  );
}

function formatExpiringList(batches: ToolBatch[], label: string): string {
  if (batches.length === 0) {
    return `Nenhum lote vencendo ${label}. 👌`;
  }
  const head = `*${batches.length}* ${batches.length === 1 ? 'lote' : 'lotes'} vencendo ${label}:`;
  const lines = batches.slice(0, 10).map((b) => {
    const when =
      b.daysUntilExpiration < 0
        ? `vencido há ${Math.abs(b.daysUntilExpiration)}d`
        : b.daysUntilExpiration === 0
        ? 'vence hoje'
        : b.daysUntilExpiration === 1
        ? 'em 1 dia'
        : `em ${b.daysUntilExpiration} dias`;
    const emoji = b.status === 'EXPIRED' ? '⛔' : b.status === 'CRITICAL' ? '🚨' : '⏰';
    return `${emoji} *${b.productName}* (lote ${b.lotNumber}, ${b.quantity}un) — ${when}`;
  });
  const overflow = batches.length > 10 ? `\n\n_+${batches.length - 10} ${batches.length - 10 === 1 ? 'lote' : 'lotes'} — abra a aba Lotes para ver todos._` : '';
  return `${head}\n\n${lines.join('\n')}${overflow}`;
}

function formatStockList(
  query: string,
  products: Array<{ productName: string; ean: string | null; totalQuantity: number; activeBatches: number }>,
): string {
  if (products.length === 0) {
    return `Não encontrei nenhum produto contendo "${query}" no seu estoque.`;
  }
  if (products.length === 1) {
    const p = products[0]!;
    const eanPart = p.ean ? ` (EAN ${p.ean})` : '';
    return (
      `Você tem *${p.totalQuantity}* ${p.totalQuantity === 1 ? 'unidade' : 'unidades'} de *${p.productName}*${eanPart}, ` +
      `${p.activeBatches === 1 ? 'em 1 lote ativo' : `distribuídas em ${p.activeBatches} lotes ativos`}.`
    );
  }
  const lines = products.slice(0, 8).map((p) => `• *${p.productName}*: ${p.totalQuantity}un (${p.activeBatches} ${p.activeBatches === 1 ? 'lote' : 'lotes'})`);
  return `Encontrei *${products.length}* ${products.length === 1 ? 'produto' : 'produtos'} contendo "${query}":\n\n${lines.join('\n')}`;
}

function formatSearch(query: string, products: Array<{ productName: string; ean: string | null }>): string {
  if (products.length === 0) return `Não encontrei nenhum produto contendo "${query}" no cadastro.`;
  if (products.length === 1) {
    const p = products[0]!;
    return `Sim — *${p.productName}*${p.ean ? ` (EAN ${p.ean})` : ''} está cadastrado.`;
  }
  const lines = products.slice(0, 8).map((p) => `• ${p.productName}${p.ean ? ` (EAN ${p.ean})` : ''}`);
  return `Sim, encontrei ${products.length} ${products.length === 1 ? 'produto' : 'produtos'}:\n\n${lines.join('\n')}`;
}

function formatOldest(batches: ToolBatch[]): string {
  if (batches.length === 0) return 'Você não tem lotes ativos cadastrados.';
  const lines = batches.slice(0, 5).map((b, i) => {
    const when =
      b.daysUntilExpiration < 0
        ? `vencido há ${Math.abs(b.daysUntilExpiration)}d`
        : `vence em ${b.daysUntilExpiration} dias`;
    return `${i + 1}. *${b.productName}* (lote ${b.lotNumber}, ${b.quantity}un) — ${when}`;
  });
  return `Lotes parados há mais tempo (mais antigos por data de cadastro):\n\n${lines.join('\n')}`;
}

function reply(text: string, toolCalls: AssistantToolCall[]): AssistantResponse {
  return { reply: text, toolCalls };
}
