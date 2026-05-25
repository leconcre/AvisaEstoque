import { NewBatchForm } from './NewBatchForm';

export const metadata = { title: 'Cadastrar lote — AvisaEstoque' };
export const dynamic = 'force-dynamic';

export default function NewBatchPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-fg">Cadastrar lote</h1>
        <p className="mt-1 text-sm text-muted">
          Comece pelo código de barras. Se o produto já existe, preenchemos o resto.
        </p>
      </header>
      <NewBatchForm />
    </div>
  );
}
