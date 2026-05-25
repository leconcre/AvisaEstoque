import type { CompanyPlan } from '@/lib/notifications/registry';

/**
 * Limites diários do assistente por plano.
 *
 * Aplicados mesmo em modo Mock (provider sem custo real) — o motivo é que
 * a régua precisa funcionar JÁ, pra quando trocarmos pra LLM real o
 * enforcement não vire surpresa. UX e código de bloqueio prontos.
 *
 * Quotas conservadoras pra MVP — Anthropic Haiku custa centavos por 1k tokens
 * e usuários PRO em poucos clientes ficam folgados.
 */
export const ASSISTANT_DAILY_LIMIT: Record<CompanyPlan, number> = {
  BASIC: 10,
  PRO: 100,
};

export function limitForPlan(plan: CompanyPlan): number {
  return ASSISTANT_DAILY_LIMIT[plan];
}
