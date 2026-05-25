import type { ToolName } from './tools';

/**
 * Interface única do assistente — espelha NotificationChannel.
 *
 * `ask(ctx, message)` retorna:
 *   - reply: texto pro usuário (já formatado em pt-BR)
 *   - toolCalls: lista do que foi consultado pra montar o reply
 *
 * INVARIANTE: toda afirmação factual em `reply` precisa ter vindo de uma
 * tool em `toolCalls`. Nenhum provider deve responder número de cabeça.
 * O motivo é cravar contra alucinação quando trocarmos pra LLM real — o
 * endpoint pode auditar essa correspondência futuramente.
 */

export type AssistantContext = {
  companyId: string;
  companyName: string;
  userName: string;
};

export type AssistantToolCall = {
  name: ToolName;
  args: unknown;
  result: unknown;
};

export type AssistantResponse = {
  reply: string;
  toolCalls: AssistantToolCall[];
  /** Hint pra UI: provider devolveu "não sei" (não roteou pra tool). */
  unanswered?: boolean;
};

export interface AssistantProvider {
  readonly name: string;
  ask(ctx: AssistantContext, message: string): Promise<AssistantResponse>;
}
