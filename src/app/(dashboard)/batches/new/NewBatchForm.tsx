'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { StatusBadge } from '@/components/batches/StatusBadge';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { selectBarcodeStrategy } from '@/lib/scanner/detect';
import {
  getBatchStatus,
  daysUntilExpiration,
  type BatchStatus,
} from '@/lib/utils/batch-status';

const PRESETS = [7, 15, 30, 60] as const;

function isoDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultExpirationDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 30);
  return isoDate(d);
}

type FormErrors = Partial<Record<'productName' | 'ean' | 'lotNumber' | 'quantity' | 'expirationDate' | 'alertDaysBefore' | 'form', string>>;

export function NewBatchForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const eanRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [ean, setEan] = useState('');
  const [productName, setProductName] = useState('');
  const [foundProductId, setFoundProductId] = useState<string | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [expirationDate, setExpirationDate] = useState<string>(defaultExpirationDate());
  const [alertDaysBefore, setAlertDaysBefore] = useState<number>(30);
  const [errors, setErrors] = useState<FormErrors>({});
  const [autocompleteStatus, setAutocompleteStatus] = useState<'idle' | 'searching' | 'found' | 'new'>('idle');
  const [scannerOpen, setScannerOpen] = useState(false);
  // Scanner só é oferecido quando o ambiente suporta. Em SSR retorna
  // 'unavailable' (sem window), então o botão começa oculto e aparece no
  // primeiro effect — evita flash + zero CLS perceptível.
  const [scannerStrategy, setScannerStrategy] = useState<ReturnType<typeof selectBarcodeStrategy>>('unavailable');
  useEffect(() => {
    setScannerStrategy(selectBarcodeStrategy());
  }, []);
  const scannerAvailable = scannerStrategy !== 'unavailable';

  // Foco no EAN ao montar.
  useEffect(() => {
    eanRef.current?.focus();
  }, []);

  // Autocomplete: debounce 350ms quando EAN tem 8 ou 13 dígitos.
  useEffect(() => {
    if (!/^(\d{8}|\d{13})$/.test(ean)) {
      setAutocompleteStatus('idle');
      setFoundProductId(null);
      return;
    }
    let cancelled = false;
    setAutocompleteStatus('searching');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?ean=${ean}`);
        const body = (await res.json()) as { product: { id: string; name: string } | null };
        if (cancelled) return;
        if (body.product) {
          setFoundProductId(body.product.id);
          setProductName(body.product.name);
          setAutocompleteStatus('found');
        } else {
          setFoundProductId(null);
          setAutocompleteStatus('new');
        }
      } catch {
        if (!cancelled) setAutocompleteStatus('idle');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ean]);

  // Cmd/Ctrl + Enter submete; Esc cancela. Listener global enquanto montado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        router.push('/batches');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const preview = useMemo<{ status: BatchStatus; days: number } | null>(() => {
    if (!expirationDate) return null;
    const d = new Date(`${expirationDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return {
      status: getBatchStatus({ expirationDate: d, alertDaysBefore }),
      days: daysUntilExpiration(d),
    };
  }, [expirationDate, alertDaysBefore]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        lotNumber,
        quantity,
        expirationDate,
        alertDaysBefore,
      };
      if (foundProductId) {
        payload.productId = foundProductId;
      } else {
        payload.productName = productName;
        if (ean) payload.ean = ean;
      }

      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = (await res.json()) as { id: string };
        // row-flash via querystring (BatchesClient lê `flash=<id>` e destaca 2s).
        router.replace(`/batches?flash=${created.id}`);
        router.refresh();
        return;
      }

      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } } }
        | null;

      if (body?.error?.code === 'VALIDATION_ERROR') {
        const fe = body.error.details?.fieldErrors ?? {};
        const next: FormErrors = {};
        for (const [k, v] of Object.entries(fe)) {
          if (v?.[0]) next[k as keyof FormErrors] = v[0];
        }
        setErrors(next);
        return;
      }

      setErrors({ form: body?.error?.message ?? 'Falha ao cadastrar lote.' });
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]" noValidate>
      <div className="space-y-4">
        <Field
          label="Código de barras (EAN)"
          hint={
            autocompleteStatus === 'searching' ? 'Buscando produto…'
            : autocompleteStatus === 'found'    ? 'Produto encontrado no seu estoque.'
            : autocompleteStatus === 'new'      ? 'EAN novo — informe o nome abaixo para criar.'
            : scannerAvailable                  ? 'Opcional. 8 ou 13 dígitos. Ou clique em "Escanear".'
            : 'Opcional. 8 ou 13 dígitos.'
          }
          error={errors.ean}
          kbd={<kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted border border-border">Foco</kbd>}
        >
          <div className="flex items-stretch">
            <Input
              ref={eanRef}
              mono
              inputMode="numeric"
              value={ean}
              onChange={(e) => setEan(e.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder="7891000000000"
              autoComplete="off"
              className="flex-1"
            />
            {scannerAvailable && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="flex shrink-0 items-center gap-1.5 border-l border-border px-3 text-xs font-medium text-[var(--brand-fg)] hover:bg-[var(--brand-soft)] focus-visible:outline-none"
                aria-label="Escanear código de barras com a câmera"
              >
                <Camera className="h-3.5 w-3.5" />
                Escanear
              </button>
            )}
          </div>
        </Field>

        {/* Modal do scanner — montado sempre que disponível pra evitar
            re-criação do componente em cada open (preserva refs internas). */}
        {scannerAvailable && (
          <BarcodeScanner
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={(detected) => {
              // Preenche o input — o useEffect com debounce dispara
              // automaticamente o autocomplete de produto.
              setEan(detected);
              // Foco volta pro EAN pra eventual edição manual.
              eanRef.current?.focus();
            }}
          />
        )}

        <Field label="Nome do produto" error={errors.productName}>
          <Input
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Ex: Iogurte Grego Natural 170g"
            disabled={autocompleteStatus === 'found'}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Número do lote" error={errors.lotNumber}>
            <Input
              required
              mono
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
              placeholder="L240815A"
              autoComplete="off"
            />
          </Field>
          <Field label="Quantidade" error={errors.quantity}>
            <Input
              required
              type="number"
              inputMode="numeric"
              mono
              min={0}
              max={1000000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
        </div>

        <Field label="Data de vencimento" error={errors.expirationDate}>
          <Input
            required
            type="date"
            mono
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
          />
        </Field>

        <Field
          label="Avisar com antecedência de"
          hint="Determina quando o WhatsApp dispara. O badge crítico vira vermelho com até 14 dias, mesmo que você escolha mais."
          error={errors.alertDaysBefore}
        >
          <div className="px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAlertDaysBefore(p)}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    alertDaysBefore === p
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-fg)]'
                      : 'border-border text-muted hover:text-fg-2',
                  ].join(' ')}
                >
                  {p} dias
                </button>
              ))}
            </div>
            <input
              type="range"
              min={1}
              max={90}
              value={alertDaysBefore}
              onChange={(e) => setAlertDaysBefore(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--brand)]"
            />
            <p className="mt-1 text-center font-mono text-xs text-muted-2">
              {alertDaysBefore} dias antes
            </p>
          </div>
        </Field>

        {errors.form && (
          <div className="rounded-md border border-[var(--crit-border)] bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]" role="alert">
            {errors.form}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted">
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] border border-border">Ctrl</kbd>{' '}
            <span className="text-muted-2">+</span>{' '}
            <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] border border-border">Enter</kbd>{' '}
            para salvar, <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] border border-border">Esc</kbd> para cancelar.
          </p>
          <Button type="submit" loading={pending} size="lg">
            Cadastrar lote
          </Button>
        </div>
      </div>

      {/* Preview lateral — status + dias se atualiza em tempo real */}
      <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm h-fit sticky top-20">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-2">Pré-visualização</p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-2">Produto</p>
            <p className="mt-0.5 truncate text-sm font-medium text-fg">
              {productName || <span className="text-muted-2">—</span>}
            </p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-2">Qtd</p>
              <p className="mt-0.5 font-mono text-sm text-fg">{quantity}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-2">Lote</p>
              <p className="mt-0.5 font-mono text-sm text-fg">{lotNumber || <span className="text-muted-2">—</span>}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-2">Status</p>
            <div className="mt-1 flex items-center gap-2">
              {preview ? <StatusBadge status={preview.status} /> : <span className="text-sm text-muted-2">—</span>}
              {preview && (
                <span className="font-mono text-xs text-muted">
                  {preview.days < 0 ? `${Math.abs(preview.days)} d. vencido` : preview.days === 0 ? 'hoje' : `em ${preview.days} dias`}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
