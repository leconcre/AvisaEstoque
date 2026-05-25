import { prisma } from '@/lib/prisma';
import { requireCompanyContext } from '@/lib/tenant';
import { countByStatus, serializeBatch, type BatchStatus } from '@/lib/utils/batch-status';
import { BatchesClient } from './BatchesClient';

export const metadata = { title: 'Lotes — AvisaEstoque' };
export const dynamic = 'force-dynamic';

type Search = { status?: string; search?: string; flash?: string };

const VALID_STATUS = new Set(['CRITICAL', 'WARNING', 'SAFE', 'EXPIRED']);

export default async function BatchesPage({ searchParams }: { searchParams: Search }) {
  const ctx = await requireCompanyContext();

  const statusParam =
    searchParams.status && VALID_STATUS.has(searchParams.status)
      ? (searchParams.status as BatchStatus)
      : 'all';

  // Server-side render do conjunto inicial. Subsequentes interações são via fetch().
  const allBatches = await prisma.batch.findMany({
    where: { companyId: ctx.companyId, deletedAt: null },
    include: { product: { select: { id: true, name: true, ean: true } } },
    orderBy: { expirationDate: 'asc' },
  });

  const counts = countByStatus(allBatches);

  let filtered = allBatches.map(serializeBatch);
  if (statusParam !== 'all') {
    filtered = filtered.filter((b) => b.status === statusParam);
  }
  if (searchParams.search) {
    const q = searchParams.search.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.product.name.toLowerCase().includes(q) ||
        b.lotNumber.toLowerCase().includes(q) ||
        (b.product.ean ?? '').includes(searchParams.search!),
    );
  }

  return (
    <BatchesClient
      initialData={filtered}
      initialCounts={{
        all: counts.all,
        critical: counts.CRITICAL,
        warning: counts.WARNING,
        safe: counts.SAFE,
        expired: counts.EXPIRED,
      }}
      initialStatus={statusParam}
      flashId={searchParams.flash ?? null}
    />
  );
}
