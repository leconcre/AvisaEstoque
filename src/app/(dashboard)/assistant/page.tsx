import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { getUsage } from '@/lib/assistant/usage';
import { limitForPlan } from '@/lib/assistant/plan-limits';
import { AssistantChat } from './AssistantChat';

export const metadata = { title: 'Assistente — AvisaEstoque' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const ctx = await requireCompanyContext();
  const company = await prisma.company.findFirst({
    where: { id: ctx.companyId },
    select: { plan: true },
  });
  const plan = company?.plan ?? 'BASIC';
  const cap = limitForPlan(plan);
  const usageSnap = await getUsage(ctx.companyId, cap);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">Assistente</h1>
        <p className="mt-1 text-sm text-muted">
          Pergunte sobre seu estoque em linguagem natural — eu consulto seus lotes diretamente.
        </p>
      </header>
      <AssistantChat
        initialUsage={{
          used: usageSnap.used,
          limit: cap,
          remaining: usageSnap.remaining,
          plan,
        }}
      />
    </div>
  );
}
