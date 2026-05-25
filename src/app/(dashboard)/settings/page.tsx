import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { NotFoundError } from '@/lib/errors';
import { SettingsForm } from './SettingsForm';

export const metadata = { title: 'Configurações — AvisaEstoque' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireCompanyContext();
  const company = await prisma.company.findFirst({
    where: { id: ctx.companyId },
    select: { name: true, whatsappPhone: true, alertEnabled: true, alertTime: true },
  });
  if (!company) throw new NotFoundError('Empresa não encontrada.');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">Configurações</h1>
        <p className="mt-1 text-sm text-muted">
          Empresa, contato e horário de disparo dos alertas.
        </p>
      </header>
      <SettingsForm initial={company} />
    </div>
  );
}
