import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireCompanyContext } from '@/lib/tenant';
import { toErrorResponse, AppError } from '@/lib/errors';
import { askAssistantSchema } from '@/lib/validations/assistant';
import { getAssistantProvider } from '@/lib/assistant';
import { getUsage, incrementUsage } from '@/lib/assistant/usage';
import { limitForPlan } from '@/lib/assistant/plan-limits';

export const runtime = 'nodejs';

/**
 * POST /api/assistant/ask
 *
 * Recebe { message }, devolve { reply, toolCalls, usage }.
 *
 * Fluxo:
 *   1. requireCompanyContext (isolamento)
 *   2. Lê plano da empresa + uso do dia
 *   3. Se atingiu cap → 429 com mensagem amigável
 *   4. Chama provider.ask() — Mock por padrão; Anthropic/Ollama via env
 *   5. Incrementa uso DEPOIS do sucesso (resposta falha não consome quota)
 *   6. Retorna resposta + snapshot de uso (UI mostra "X/Y restantes")
 *
 * O incremento atômico no upsert do Prisma serializa requests do mesmo
 * companyId — em corrida estreita, máx 1 query extra além do cap, vide
 * comentário em usage.ts.
 */
export async function POST(req: Request) {
  try {
    const ctx = await requireCompanyContext();
    const { message } = askAssistantSchema.parse(await req.json());

    // Plano + cap.
    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: { plan: true },
    });
    if (!company) throw new AppError('Empresa não encontrada.', 404, 'NOT_FOUND');

    const cap = limitForPlan(company.plan);
    const usage = await getUsage(ctx.companyId, cap);

    if (usage.remaining <= 0) {
      logger.info(
        { event: 'assistant.quota_exceeded', companyId: ctx.companyId, plan: company.plan, used: usage.used, cap },
        'usuário excedeu cota diária',
      );
      throw new AppError(
        `Você atingiu o limite diário de ${cap} perguntas do assistente no plano ${company.plan}. ` +
          `O contador zera amanhã.`,
        429,
        'ASSISTANT_QUOTA_EXCEEDED',
      );
    }

    // Chama o provider — passa contexto com companyId pra tools.
    const provider = getAssistantProvider();
    const startedAt = Date.now();
    const response = await provider.ask(
      {
        companyId: ctx.companyId,
        companyName: ctx.companyName,
        userName: ctx.name,
      },
      message,
    );
    const elapsed = Date.now() - startedAt;

    // Incrementa só APÓS sucesso. Se o provider lançar, a chamada não conta.
    const newCount = await incrementUsage(ctx.companyId);

    logger.info(
      {
        event: 'assistant.ask.ok',
        companyId: ctx.companyId,
        provider: provider.name,
        toolCalls: response.toolCalls.map((t) => t.name),
        unanswered: response.unanswered ?? false,
        elapsedMs: elapsed,
        usedToday: newCount,
      },
      'assistente respondeu',
    );

    return NextResponse.json({
      reply: response.reply,
      toolCalls: response.toolCalls,
      unanswered: response.unanswered ?? false,
      usage: {
        used: newCount,
        limit: cap,
        remaining: Math.max(0, cap - newCount),
        plan: company.plan,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * GET /api/assistant/ask
 *
 * Retorna só o snapshot de uso — usado pela UI pra renderizar "X/Y restantes"
 * sem precisar fazer uma pergunta.
 */
export async function GET() {
  try {
    const ctx = await requireCompanyContext();
    const company = await prisma.company.findFirst({
      where: { id: ctx.companyId },
      select: { plan: true },
    });
    if (!company) throw new AppError('Empresa não encontrada.', 404, 'NOT_FOUND');

    const cap = limitForPlan(company.plan);
    const usage = await getUsage(ctx.companyId, cap);

    return NextResponse.json({
      usage: {
        used: usage.used,
        limit: cap,
        remaining: usage.remaining,
        plan: company.plan,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
