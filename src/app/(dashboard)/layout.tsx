import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { contextFromSession } from '@/lib/tenant';
import { AppShell } from '@/components/shell/AppShell';
import { GlobalShortcuts } from '@/components/shell/GlobalShortcuts';

export const dynamic = 'force-dynamic';

/**
 * Gate de autenticação. Defesa em profundidade: o middleware já redireciona,
 * mas se chegou até aqui sem session.user.companyId, redirect manual.
 *
 * Buscamos o NOME da empresa FRESH no banco (não do token). Motivo: quando o
 * usuário edita o nome em /settings, o JWT carrega o nome antigo até expirar.
 * Lendo aqui no layout, qualquer mudança aparece no próximo render — sem
 * precisar invalidar/regenerar token.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login');
  }
  const ctx = contextFromSession(session);

  // Fonte de verdade do nome: a tabela, não o token.
  const company = await prisma.company.findFirst({
    where: { id: ctx.companyId },
    select: { name: true },
  });

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <AppShell
      user={{ name: ctx.name, companyName: company?.name ?? ctx.companyName }}
      signOutAction={doSignOut}
    >
      <GlobalShortcuts />
      {children}
    </AppShell>
  );
}
