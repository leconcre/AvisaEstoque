// === NEW BATCH FORM ===
const { useState, useEffect, useRef } = React;
const {
  I, Button, Field, Input, StatusBadge, STATUS_META,
  statusOf, ddays, fmtDate, dayLabel,
} = window;

const PRESETS = [7, 15, 30, 60];

const NewBatchScreen = ({ onCancel, onSave, knownProducts }) => {
  const eanRef = useRef(null);
  const productRef = useRef(null);
  const lotRef = useRef(null);
  const qtyRef = useRef(null);
  const dateRef = useRef(null);

  const [form, setForm] = useState({
    ean: '',
    product: '',
    lot: '',
    quantity: '',
    expirationDate: '',
    alertDaysBefore: 7,
  });
  const [focused, setFocused] = useState('ean');
  const [errors, setErrors] = useState({});

  useEffect(() => { eanRef.current?.focus(); }, []);

  // EAN autocomplete: if EAN matches existing, fill product name
  useEffect(() => {
    const match = knownProducts.find(p => p.ean === form.ean);
    if (match && !form.product) {
      setForm(f => ({ ...f, product: match.product }));
    }
  }, [form.ean, knownProducts]);

  // Cmd/Ctrl + Enter submits
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!form.ean.trim()) e.ean = 'Informe o EAN ou código interno';
    if (!form.product.trim()) e.product = 'Nome obrigatório';
    if (!form.lot.trim()) e.lot = 'Informe o número do lote';
    const q = parseInt(form.quantity, 10);
    if (!q || q < 1) e.quantity = 'Quantidade mínima: 1';
    if (!form.expirationDate) e.expirationDate = 'Selecione a data';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSave({
      id: String(Date.now()),
      ean: form.ean.trim(),
      product: form.product.trim(),
      lot: form.lot.trim(),
      quantity: parseInt(form.quantity, 10),
      expirationDate: form.expirationDate,
      alertDaysBefore: form.alertDaysBefore,
    });
  };

  // Enter advances fields
  const onEnter = (next) => (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      next?.current?.focus();
    }
  };

  // live preview status
  const previewStatus = form.expirationDate ? statusOf(form.expirationDate, form.alertDaysBefore) : null;
  const previewDays = form.expirationDate ? ddays(form.expirationDate) : null;

  return (
    <div className="screen-in">
      <div className="px-4 lg:px-8 py-6 lg:py-8 pb-28 max-w-[920px]">
        <div className="flex items-center gap-2 text-[12.5px] text-[color:var(--muted)] mb-3">
          <button onClick={onCancel} className="hover:text-[color:var(--fg)] transition-colors inline-flex items-center gap-1">
            <I.ArrowLeft size={13}/> Lotes
          </button>
          <span>/</span>
          <span style={{ color: 'var(--fg-2)' }}>Cadastrar lote</span>
        </div>

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--fg)' }}>
              Cadastrar lote
            </h1>
            <div className="text-[12.5px] text-[color:var(--muted)] mt-1">
              Pressione <kbd>Enter</kbd> para avançar campos · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> para salvar
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr,320px] gap-6">
          {/* Form column */}
          <div className="rounded-2xl border bg-white p-5 lg:p-6 ray space-y-5"
            style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <FormRow num={1} label="EAN ou código">
              <Field label="Código de barras" hint="Bipe o produto ou digite manualmente." error={errors.ean}>
                <Input
                  ref={eanRef}
                  mono
                  value={form.ean}
                  onChange={set('ean')}
                  onFocus={() => setFocused('ean')}
                  onKeyDown={onEnter(productRef)}
                  placeholder="7891000100103"
                  inputMode="numeric"
                />
              </Field>
            </FormRow>

            <FormRow num={2} label="Produto">
              <Field label="Nome do produto" hint={knownProducts.some(p => p.ean === form.ean) ? '✓ Produto reconhecido — nome preenchido automaticamente.' : 'Use o nome exato da embalagem.'} error={errors.product}>
                <Input
                  ref={productRef}
                  value={form.product}
                  onChange={set('product')}
                  onFocus={() => setFocused('product')}
                  onKeyDown={onEnter(lotRef)}
                  placeholder="Iogurte Grego Natural 170g"
                />
              </Field>
            </FormRow>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormRow num={3} label="Lote">
                <Field label="Número do lote" error={errors.lot}>
                  <Input
                    ref={lotRef}
                    mono
                    value={form.lot}
                    onChange={set('lot')}
                    onFocus={() => setFocused('lot')}
                    onKeyDown={onEnter(qtyRef)}
                    placeholder="L240815A"
                  />
                </Field>
              </FormRow>

              <FormRow num={4} label="Quantidade">
                <Field label="Unidades em estoque" error={errors.quantity}>
                  <Input
                    ref={qtyRef}
                    type="number"
                    min="1"
                    mono
                    value={form.quantity}
                    onChange={set('quantity')}
                    onFocus={() => setFocused('quantity')}
                    onKeyDown={onEnter(dateRef)}
                    placeholder="24"
                    inputMode="numeric"
                  />
                  <span className="pr-3 text-[12px] text-[color:var(--muted)]">un</span>
                </Field>
              </FormRow>
            </div>

            <FormRow num={5} label="Vencimento">
              <Field label="Data de vencimento" error={errors.expirationDate}>
                <Input
                  ref={dateRef}
                  type="date"
                  mono
                  value={form.expirationDate}
                  onChange={set('expirationDate')}
                  onFocus={() => setFocused('expirationDate')}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                />
                <I.Calendar size={15} className="mr-3" style={{ color: 'var(--muted)' }}/>
              </Field>
            </FormRow>

            <FormRow num={6} label="Aviso prévio">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11.5px] uppercase tracking-wide text-[color:var(--muted)] font-medium">Avisar com antecedência de</span>
                  <span className="text-[13px] font-mono font-medium" style={{ color: 'var(--brand-fg)' }}>{form.alertDaysBefore} dias</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PRESETS.map(p => {
                    const active = form.alertDaysBefore === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm({ ...form, alertDaysBefore: p })}
                        className="h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors ray border"
                        style={{
                          background: active ? 'var(--brand-soft)' : 'white',
                          color: active ? 'var(--brand-fg)' : 'var(--fg-2)',
                          borderColor: active ? 'var(--brand)' : 'var(--border-strong)',
                        }}
                      >
                        {p} dias
                      </button>
                    );
                  })}
                </div>
                <input
                  type="range"
                  className="brand w-full"
                  min="1" max="90"
                  value={form.alertDaysBefore}
                  onChange={(e) => setForm({ ...form, alertDaysBefore: parseInt(e.target.value, 10) })}
                />
                <div className="flex justify-between text-[10.5px] text-[color:var(--muted-2)] mt-1.5 font-mono">
                  <span>1d</span><span>30d</span><span>60d</span><span>90d</span>
                </div>
              </div>
            </FormRow>

            <div className="pt-4 mt-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <Button variant="primary" onClick={submit} icon={<I.Check size={15} stroke={2.4}/>}>Salvar lote</Button>
              <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
              <span className="ml-auto text-[11.5px] text-[color:var(--muted)] hidden sm:inline-flex items-center gap-1.5">
                <I.Command size={12}/> + <kbd>↵</kbd> para salvar
              </span>
            </div>
          </div>

          {/* Live preview */}
          <aside className="rounded-2xl border bg-white p-5 ray h-fit sticky top-[80px]"
            style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="text-[10.5px] uppercase tracking-wide font-medium mb-3" style={{ color: 'var(--muted)' }}>
              Pré-visualização
            </div>
            <div className="rounded-xl border p-4 ray" style={{ borderColor: 'var(--border)', background: 'oklch(0.985 0.005 95)' }}>
              <div className="flex items-center gap-2 mb-3">
                {previewStatus
                  ? <StatusBadge status={previewStatus} size="sm" />
                  : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide font-medium border"
                      style={{ background: 'white', color: 'var(--muted)', borderColor: 'var(--border)' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted-2)' }}/>
                      Aguardando
                    </span>}
                {previewDays != null && (
                  <span className="font-mono text-[11.5px]" style={{ color: previewStatus ? STATUS_META[previewStatus].color : 'var(--muted)' }}>
                    {dayLabel(previewDays)}
                  </span>
                )}
              </div>
              <div className="text-[14px] font-medium leading-snug" style={{ color: 'var(--fg)' }}>
                {form.product || 'Nome do produto'}
              </div>
              <div className="mt-1 text-[11.5px] font-mono text-[color:var(--muted)]">
                EAN {form.ean || '— — — — — — — — — — — — —'}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Lote</div>
                  <div className="font-mono">{form.lot || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Quant.</div>
                  <div className="font-mono">{form.quantity || '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Vence em</div>
                  <div className="font-mono">{form.expirationDate ? fmtDate(form.expirationDate) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[color:var(--muted)]">Aviso</div>
                  <div className="font-mono">{form.alertDaysBefore} d. antes</div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11.5px] text-[color:var(--muted)] leading-relaxed">
              <div className="font-medium mb-1" style={{ color: 'var(--fg-2)' }}>O que acontece depois:</div>
              <ol className="space-y-1 list-decimal pl-4">
                <li>Lote entra na sua listagem.</li>
                <li>Em <span className="font-mono">{form.alertDaysBefore}d</span> antes da data, você recebe um alerta no WhatsApp.</li>
                <li>Status fica <b>crítico</b> quando faltar ≤ 7 dias.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const FormRow = ({ num, label, children }) => (
  <div className="flex gap-4 items-start">
    <div className="hidden sm:flex shrink-0 mt-7 grid place-items-center rounded-full font-mono text-[11px] items-center justify-center"
      style={{
        width: 22, height: 22,
        background: 'var(--brand-soft)',
        color: 'var(--brand-fg)',
        border: '1px solid var(--brand-soft)',
      }}>{num}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

// Make submit-on-Enter work on the last field
const submitOnEnter = (fn) => (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    fn();
  }
};

window.NewBatchScreen = NewBatchScreen;
