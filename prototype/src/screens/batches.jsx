// === BATCHES LIST ===
const { useState, useEffect, useMemo } = React;
const {
  I, Button, Field, Input, StatusBadge, STATUS_META, EmptyState, FAB,
  statusOf, ddays, fmtDate, dayLabel,
} = window;

const FILTERS = [
  { id: 'ALL',      label: 'Todos' },
  { id: 'CRITICAL', label: 'Críticos' },
  { id: 'WARNING',  label: 'Atenção' },
  { id: 'SAFE',     label: 'Seguros' },
  { id: 'EXPIRED',  label: 'Vencidos' },
];

const BatchesScreen = ({ batches, onNewBatch, onDelete, initialFilter, flashId }) => {
  const [filter, setFilter] = useState(initialFilter || 'ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('expiration');

  useEffect(() => { if (initialFilter) setFilter(initialFilter); }, [initialFilter]);

  const counts = useMemo(() => {
    const c = { ALL: batches.length, CRITICAL: 0, WARNING: 0, SAFE: 0, EXPIRED: 0 };
    batches.forEach(b => { c[statusOf(b.expirationDate, b.alertDaysBefore)]++; });
    return c;
  }, [batches]);

  const filtered = useMemo(() => {
    let out = batches.filter(b => {
      const s = statusOf(b.expirationDate, b.alertDaysBefore);
      if (filter !== 'ALL' && filter !== s) return false;
      if (query) {
        const q = query.toLowerCase();
        return b.product.toLowerCase().includes(q) || b.ean.includes(q) || b.lot.toLowerCase().includes(q);
      }
      return true;
    });
    if (sort === 'expiration') {
      out.sort((a,b) => ddays(a.expirationDate) - ddays(b.expirationDate));
    } else if (sort === 'product') {
      out.sort((a,b) => a.product.localeCompare(b.product, 'pt-BR'));
    } else if (sort === 'quantity') {
      out.sort((a,b) => b.quantity - a.quantity);
    }
    return out;
  }, [batches, filter, query, sort]);

  return (
    <div className="screen-in relative">
      <div className="px-4 lg:px-8 py-6 lg:py-7 pb-28 lg:pb-10 max-w-[1280px]">

        {/* Header strip */}
        <div className="flex flex-wrap items-end gap-3 justify-between mb-5">
          <div>
            <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--fg)' }}>Lotes</h1>
            <div className="text-[12.5px] text-[color:var(--muted)] mt-1">{batches.length} lotes monitorados · {counts.CRITICAL + counts.WARNING} precisando de atenção</div>
          </div>
          <Button variant="primary" icon={<I.Plus size={15} stroke={2.4}/>} onClick={onNewBatch}>Cadastrar lote</Button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl border bg-white ray" style={{ borderColor: 'var(--border)' }}>
            {FILTERS.map(f => {
              const active = filter === f.id;
              const isAll = f.id === 'ALL';
              const m = !isAll ? STATUS_META[f.id] : null;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-colors"
                  style={{
                    background: active ? (isAll ? 'oklch(0.95 0.005 95)' : m.soft) : 'transparent',
                    color: active ? (isAll ? 'var(--fg)' : m.color) : 'var(--fg-2)',
                  }}
                >
                  {!isAll && <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }}/>}
                  <span>{f.label}</span>
                  <span className={`font-mono text-[11px] ${active ? '' : 'text-[color:var(--muted-2)]'}`}>{counts[f.id]}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px] max-w-[360px]">
            <div className="ring-brand flex items-center rounded-lg bg-white border h-9 px-2.5 gap-2" style={{ borderColor: 'var(--border-strong)' }}>
              <I.Search size={14} style={{ color: 'var(--muted)' }}/>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por produto, lote ou EAN…"
                className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-[color:var(--muted-2)]"
              />
              <kbd>/</kbd>
            </div>
          </div>

          {/* Sort */}
          <div className="ml-auto flex items-center gap-2 text-[12.5px] text-[color:var(--muted)]">
            <span>Ordenar:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white border rounded-lg h-9 pl-2.5 pr-7 text-[12.5px] font-medium outline-none ring-brand"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--fg)' }}
            >
              <option value="expiration">Proximidade do vencimento</option>
              <option value="product">Produto (A–Z)</option>
              <option value="quantity">Quantidade</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 && batches.length > 0 ? (
          (() => {
            const fm = filter !== 'ALL' ? STATUS_META[filter] : null;
            const filterLabel = (FILTERS.find(f => f.id === filter) || {}).label || '';
            const isFilterEmpty = filter !== 'ALL' && !query;
            return (
              <div className="rounded-2xl border bg-white ray" style={{ borderColor: 'var(--border)' }}>
                <EmptyState
                  icon={
                    filter === 'EXPIRED' ? <I.XCircle size={24}/>
                      : filter === 'CRITICAL' ? <I.AlertTri size={24}/>
                      : filter === 'WARNING' ? <I.Clock size={24}/>
                      : filter === 'SAFE' ? <I.ShieldCheck size={24}/>
                      : <I.Search size={24}/>
                  }
                  title={
                    isFilterEmpty
                      ? (filter === 'EXPIRED' ? 'Nenhum lote vencido. ' :
                         filter === 'CRITICAL' ? 'Tudo tranquilo por agora.' :
                         filter === 'WARNING' ? 'Nenhum lote em atenção.' :
                         filter === 'SAFE' ? 'Sem lotes seguros no momento.' :
                         'Nada encontrado')
                      : 'Nada encontrado'
                  }
                  desc={
                    isFilterEmpty
                      ? (filter === 'EXPIRED'
                          ? 'Bom trabalho — quando algum lote vencer, ele aparece aqui para você dar baixa.'
                          : `Nenhum lote no status “${filterLabel}” no momento.`)
                      : 'Ajuste os filtros ou a busca para ver mais lotes.'
                  }
                  action={
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => { setFilter('ALL'); setQuery(''); }}>Ver todos</Button>
                      {isFilterEmpty && <Button size="sm" icon={<I.Plus size={13} stroke={2.4}/>} onClick={onNewBatch}>Cadastrar lote</Button>}
                    </div>
                  }
                />
              </div>
            );
          })()
        ) : batches.length === 0 ? (
          <div className="rounded-2xl border bg-white ray" style={{ borderColor: 'var(--border)' }}>
            <EmptyState
              icon={<I.Box size={26}/>}
              title="Nenhum lote cadastrado ainda"
              desc="Cadastre seu primeiro lote para começar a receber alertas no WhatsApp."
              action={<Button onClick={onNewBatch} icon={<I.Plus size={14} stroke={2.4}/>}>Cadastrar primeiro lote</Button>}
            />
          </div>
        ) : (
          <div className="rounded-2xl border bg-white overflow-hidden ray" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            {/* Desktop table */}
            <div className="hidden md:block">
              <div className="grid text-[10.5px] uppercase tracking-wide font-medium text-[color:var(--muted)] px-5 py-3 border-b"
                style={{ gridTemplateColumns: '88px minmax(0,1.6fr) 130px 160px 96px 80px', borderColor: 'var(--border)', background: 'oklch(0.985 0.005 95)' }}>
                <div>Status</div>
                <div>Produto · EAN</div>
                <div>Lote</div>
                <div>Vencimento</div>
                <div className="text-right">Quant.</div>
                <div className="text-right">Ações</div>
              </div>
              <ul>
                {filtered.map((b, i) => {
                  const status = statusOf(b.expirationDate, b.alertDaysBefore);
                  const d = ddays(b.expirationDate);
                  const isFlash = b.id === flashId;
                  return (
                    <li
                      key={b.id}
                      className={`grid items-center px-5 py-3 border-b last:border-b-0 hover:bg-[color:oklch(0.985_0.005_95)] transition-colors ${isFlash ? 'row-flash' : ''}`}
                      style={{ gridTemplateColumns: '88px minmax(0,1.6fr) 130px 160px 96px 80px', borderColor: 'var(--border)' }}
                    >
                      <div><StatusBadge status={status} size="sm" /></div>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{b.product}</div>
                        <div className="text-[11px] font-mono text-[color:var(--muted)] mt-0.5">EAN {b.ean}</div>
                      </div>
                      <div className="font-mono text-[12.5px]" style={{ color: 'var(--fg-2)' }}>{b.lot}</div>
                      <div>
                        <div className="text-[13px] font-mono" style={{ color: 'var(--fg)' }}>{fmtDate(b.expirationDate)}</div>
                        <div className="text-[11px] font-mono mt-0.5" style={{ color: STATUS_META[status].color }}>{dayLabel(d)}</div>
                      </div>
                      <div className="text-right font-mono text-[13.5px]">{b.quantity}<span className="text-[10.5px] text-[color:var(--muted)]"> un</span></div>
                      <div className="text-right flex justify-end gap-1">
                        <IconButton title="Editar"><I.Edit size={14}/></IconButton>
                        <IconButton title="Deletar" danger onClick={() => onDelete(b.id)}><I.Trash size={14}/></IconButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(b => {
                const status = statusOf(b.expirationDate, b.alertDaysBefore);
                const d = ddays(b.expirationDate);
                const isFlash = b.id === flashId;
                return (
                  <li key={b.id} className={`px-4 py-3 ${isFlash ? 'row-flash' : ''}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusBadge status={status} size="sm" />
                      <div className="ml-auto font-mono text-[11.5px]" style={{ color: STATUS_META[status].color }}>{dayLabel(d)}</div>
                    </div>
                    <div className="text-[14px] font-medium" style={{ color: 'var(--fg)' }}>{b.product}</div>
                    <div className="mt-1 flex items-center justify-between text-[11.5px] font-mono text-[color:var(--muted)]">
                      <span>lote {b.lot} · {b.quantity} un</span>
                      <span>{fmtDate(b.expirationDate)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-3 border-t flex items-center justify-between text-[11.5px] text-[color:var(--muted)]"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.985 0.005 95)' }}>
              <span>Mostrando {filtered.length} de {batches.length}</span>
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
                <span className="inline-flex items-center gap-1"><kbd>N</kbd> novo lote</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <FAB onClick={onNewBatch} />
    </div>
  );
};

const IconButton = ({ children, danger, onClick, title }) => (
  <button
    title={title}
    onClick={onClick}
    className="h-7 w-7 rounded-md grid place-items-center transition-colors"
    style={{ color: 'var(--muted)' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'var(--crit-soft)' : 'oklch(0.95 0.005 95)'; e.currentTarget.style.color = danger ? 'var(--crit)' : 'var(--fg)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
  >
    {children}
  </button>
);

window.BatchesScreen = BatchesScreen;
