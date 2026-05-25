import {
  countByStatus,
  getExpiringBatches,
  getOldestBatches,
  getStockByProduct,
  searchProducts,
} from '../tools';
import type {
  AssistantContext,
  AssistantProvider,
  AssistantResponse,
  AssistantToolCall,
} from '../provider';

/**
 * AnthropicAssistantProvider — STUB. NÃO ATIVADO no MVP.
 *
 * Esqueleto pronto pra Claude API (modelo classe Haiku — mais barato e
 * suficiente para roteamento + redação curta). Quando trocarmos do Mock
 * pra LLM real, só é preciso:
 *   1. Adicionar ANTHROPIC_API_KEY no env de produção (vide deploy/.env.example)
 *   2. Adicionar @anthropic-ai/sdk no package.json:
 *      npm install @anthropic-ai/sdk
 *   3. Setar ASSISTANT_PROVIDER=anthropic
 *   4. (Opcional) Sobrescrever o modelo via ANTHROPIC_MODEL — default vai
 *      pra "claude-haiku-4-5" pelo custo/latência.
 *
 * O resto está pronto: schemas das tools (TOOL_SCHEMAS) e o executor
 * (executeTool) já são tenant-safe. O loop com tool_use → tool_result fica
 * aqui dentro quando ligar.
 *
 * Por que stub agora: economiza custo da API em dev e mantém o roteamento
 * Mock como linha-de-base testável. A troca é uma env, não uma refactor.
 */

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';

/**
 * Schemas JSON das tools no formato esperado pelo Claude tool use.
 * Mantidos próximos do schema das funções TS — uma fonte só de verdade
 * mental, mesmo que duplicados literalmente aqui.
 */
const TOOL_SCHEMAS = [
  {
    name: 'getExpiringBatches',
    description: 'Lotes que vencem dentro de uma janela de dias (inclui vencidos por padrão).',
    input_schema: {
      type: 'object',
      properties: {
        withinDays: { type: 'integer', description: 'Janela em dias a partir de hoje', minimum: 0, maximum: 365 },
        includeExpired: { type: 'boolean', description: 'Incluir lotes já vencidos. Default true.' },
      },
      required: ['withinDays'],
    },
  },
  {
    name: 'getStockByProduct',
    description: 'Estoque agregado (soma de todos os lotes) por produto cujo nome contém ou EAN é igual ao termo.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Nome (substring) ou EAN exato' } },
      required: ['query'],
    },
  },
  {
    name: 'countByStatus',
    description: 'Contadores de lotes ativos por status (CRITICAL/WARNING/SAFE/EXPIRED).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'searchProducts',
    description: 'Verifica se um produto está cadastrado (sem agregar estoque).',
    input_schema: {
      type: 'object',
      properties: { term: { type: 'string' } },
      required: ['term'],
    },
  },
  {
    name: 'getOldestBatches',
    description: 'Lotes ativos mais antigos por data de cadastro.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
    },
  },
];

/**
 * Executor tenant-safe — recebe nome da tool + args do LLM e despacha pra
 * função TS correspondente, injetando o companyId. ESSA é a barreira de
 * isolamento: o LLM nunca vê companyId, e nunca consegue executar query
 * livre. Só pode chamar tools registradas, e o executor força o tenant.
 */
async function executeTool(
  companyId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'getExpiringBatches':
      return getExpiringBatches({
        companyId,
        withinDays: Number(args.withinDays ?? 7),
        includeExpired: typeof args.includeExpired === 'boolean' ? args.includeExpired : true,
      });
    case 'getStockByProduct':
      return getStockByProduct({ companyId, query: String(args.query ?? '') });
    case 'countByStatus':
      return countByStatus({ companyId });
    case 'searchProducts':
      return searchProducts({ companyId, term: String(args.term ?? '') });
    case 'getOldestBatches':
      return getOldestBatches({ companyId, limit: Number(args.limit ?? 5) });
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}

export class AnthropicAssistantProvider implements AssistantProvider {
  readonly name = 'anthropic';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async ask(ctx: AssistantContext, message: string): Promise<AssistantResponse> {
    void ctx;
    void message;
    void ANTHROPIC_MODEL;
    void TOOL_SCHEMAS;
    void this.apiKey;
    void executeTool;

    // ============================================================
    // TODO: ligar API real do Claude.
    //
    // Passos de implementação quando reativar:
    //
    //   import Anthropic from '@anthropic-ai/sdk';
    //   const client = new Anthropic({ apiKey: this.apiKey });
    //
    //   const systemPrompt =
    //     `Você é o assistente de estoque da empresa "${ctx.companyName}".\n` +
    //     `Responda em pt-BR, conciso. SEMPRE use uma tool antes de afirmar ` +
    //     `qualquer número sobre o estoque. Se nenhuma tool cobre a pergunta, ` +
    //     `diga "não sei responder isso" — NUNCA invente quantidades.`;
    //
    //   const toolCalls: AssistantToolCall[] = [];
    //   const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = [
    //     { role: 'user', content: message },
    //   ];
    //
    //   // Loop tool_use → tool_result, máx 3 iterações pra evitar runaway.
    //   for (let i = 0; i < 3; i++) {
    //     const res = await client.messages.create({
    //       model: ANTHROPIC_MODEL,
    //       max_tokens: 1024,
    //       system: systemPrompt,
    //       tools: TOOL_SCHEMAS as never,
    //       messages,
    //     });
    //
    //     if (res.stop_reason === 'tool_use') {
    //       // executar tool_use blocks
    //       const toolUseBlocks = res.content.filter((b: any) => b.type === 'tool_use');
    //       const toolResults: any[] = [];
    //       for (const tu of toolUseBlocks) {
    //         const result = await executeTool(ctx.companyId, tu.name, tu.input);
    //         toolCalls.push({ name: tu.name as ToolName, args: tu.input, result });
    //         toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
    //       }
    //       messages.push({ role: 'assistant', content: res.content });
    //       messages.push({ role: 'user', content: toolResults });
    //       continue;
    //     }
    //
    //     const textBlocks = (res.content as any[]).filter((b) => b.type === 'text');
    //     const reply = textBlocks.map((b) => b.text).join('\n').trim();
    //     return { reply, toolCalls, unanswered: toolCalls.length === 0 };
    //   }
    //
    //   return {
    //     reply: 'Não consegui responder com as ferramentas disponíveis.',
    //     toolCalls,
    //     unanswered: true,
    //   };
    // ============================================================

    throw new Error(
      'AnthropicAssistantProvider não está ativado neste build. ' +
        'Vide src/lib/assistant/providers/anthropic.ts (TODO).',
    );
  }
}
