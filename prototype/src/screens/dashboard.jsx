// === DASHBOARD ===
const { useState, useEffect, useMemo, useRef } = React;
const {
  I, Button, Field, Input, StatusBadge, DaysPill, STATUS_META,
  Avatar, FAB, EmptyState,
  statusOf, ddays, fmtDate, dayLabel,
} = window;

const DashboardScreen = ({ batches, onNavigate, onNewBatch }) => {
  const counts = useMemo(() => {
    const c = { CRITICAL: 0, WARNING: 0, SAFE: 0, EXPIRED: 0 };
    batches.forEach(b => { c[statusOf(b.expirationDate, b.alertDaysBefore)]++; });
    return c;
  }, [batches]);

  const needsAttention = counts.CRITICAL + counts.WARNING;
  const yesterday = needsAttention - 1; // mocked diff
  const delta = needsAttention - yesterday;

  const upcoming = useMemo(() => {
    return [...batches]
      .filter(b => statusOf(b.expirationDate, b.alertDaysBefore) !== 'EXPIRED')
      .sort((a, b) => ddays(a.expirationDate) - ddays(b.expirationDate))
      .slice(0, 5);
  }, [batches]);

  return (
    <div className="screen-in relative">
      <div className="px-4 lg:px-8 py-6 lg:py-8 pb-28 lg:pb-8 space-y-6 max-w-[1280px]">
        {/* Hero */}
        <section className="grid lg:grid-cols-[1.4fr,1fr] gap-4">
          <div className="ray rounded-2xl bg-white border p-6 lg:p-7 relative overflow-hidden" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="absolute -top-24 -right-24 w-[280px] h-[280px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, oklch(0.7 0.16 155 / 0.12), transparent 60%)' }}/>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ray"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand)' }}/>
                Hoje · 20 mai 2026
              </span>
              <span className="text-[11.5px] text-[color:var(--muted)]">Última varredura há 12 min</span>
            </div>
            <div className="flex items-end gap-4 mt-2">
              <div className="text-[58px] lg:text-[68px] font-semibold tracking-tight leading-[1] font-mono" style={{ color: 'var(--fg)' }}>
                {needsAttention}
              </div>
              <div className="pb-2.5">
                <div className="text-[14.5px] font-medium leading-tight" style={{ color: 'var(--fg)' }}>lotes precisam de atenção</div>
                <div className="text-[12.5px] text-[color:var(--muted)]">{counts.CRITICAL} críticos · {counts.WARNING} em atenção</div>
              </div>
              <div className="ml-auto pb-2">
                <span className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-md"
                  style={{ background: delta > 0 ? 'var(--crit-soft)' : 'var(--safe-soft)', color: delta > 0 ? 'var(--crit)' : 'var(--safe)' }}>
                  {delta > 0 ? <I.ArrowUp size={12} stroke={2.2}/> : <I.ArrowDown size={12} stroke={2.2}/>}
                  {Math.abs(delta)} vs. ontem
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button variant="primary" icon={<I.Plus size={15} stroke={2.4}/>} onClick={onNewBatch}>Cadastrar lote</Button>
              <Button variant="secondary" icon={<I.Inbox size={15}/>} onClick={() => onNavigate('batches')}>Ver todos os lotes</Button>
              <Button variant="ghost" icon={<I.Send size={14}/>}>Reenviar alerta de hoje</Button>
            </div>
          </div>

          {/* WhatsApp status panel */}
          <div className="ray rounded-2xl bg-white border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center gap-2">
              <span className="grid place-items-center rounded-md" style={{ width: 26, height: 26, background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
                <I.Chat size={13}/>
              </span>
              <div className="text-[12.5px] font-semibold tracking-wide uppercase" style={{ color: 'var(--fg-2)' }}>Canal de alerta</div>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--safe)' }}>
                <span className="w-1.5 h-1.5 rounded-full pulse-crit" style={{ background: 'var(--safe)' }}/>
                Ativo
              </span>
            </div>
            <div>
              <div className="text-[12.5px] text-[color:var(--muted)]">Recebendo por WhatsApp</div>
              <div className="text-[15px] font-medium font-mono tracking-tight" style={{ color: 'var(--fg)' }}>+55 81 99845-2210</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'oklch(0.985 0.005 95)' }}>
              <div className="text-[11px] uppercase tracking-wide text-[color:var(--muted)] mb-1">Próximo disparo</div>
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <I.Clock size={13} style={{ color: 'var(--brand)' }} />
                Amanhã às 08:00
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-auto pt-1">
              <Stat label="Alertas (30d)" value="42" />
              <Stat label="Resp. taxa" value="78%" preview />
              <Stat label="Economia" value="R$ 1,2k" preview />
            </div>
          </div>
        </section>

        {/* Status grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            status="CRITICAL"
            count={counts.CRITICAL}
            label="Críticos"
            desc="≤ 7 dias para vencer"
            onClick={() => onNavigate('batches', { filter: 'CRITICAL' })}
          />
          <StatCard
            status="WARNING"
            count={counts.WARNING}
            label="Atenção"
            desc="8 a 30 dias"
            onClick={() => onNavigate('batches', { filter: 'WARNING' })}
          />
          <StatCard
            status="SAFE"
            count={counts.SAFE}
            label="Seguros"
            desc="> 30 dias"
            onClick={() => onNavigate('batches', { filter: 'SAFE' })}
          />
          <StatCard
            status="EXPIRED"
            count={counts.EXPIRED}
            label="Vencidos"
            desc="precisam baixar"
            onClick={() => onNavigate('batches', { filter: 'EXPIRED' })}
          />
        </section>

        {/* Upcoming critical list */}
        <section className="rounded-2xl bg-white border ray overflow-hidden" style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>Próximas expirações</div>
              <div className="text-[12px] text-[color:var(--muted)] mt-0.5">Ordenado por proximidade · top 5</div>
            </div>
            <Button variant="ghost" size="sm" iconRight={<I.ArrowRight size={13}/>} onClick={() => onNavigate('batches')}>Ver todos</Button>
          </div>
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {upcoming.map(b => {
              const status = statusOf(b.expirationDate, b.alertDaysBefore);
              const d = ddays(b.expirationDate);
              const m = STATUS_META[status];
              return (
                <li key={b.id} className="relative pl-5 pr-5 py-3.5 flex items-center gap-3 hover:bg-[color:oklch(0.985_0.005_95)] transition-colors">
                  {/* Status indicator — vertical bar (NOT interactive) */}
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 rounded-r-full"
                    style={{ width: 3, background: m.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{b.product}</div>
                    <div className="text-[11.5px] text-[color:var(--muted)] font-mono mt-0.5">
                      lote {b.lot} · EAN {b.ean}
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-[12.5px] font-mono" style={{ color: 'var(--fg-2)' }}>{fmtDate(b.expirationDate)}</div>
                    <div className="text-[11px] font-mono mt-0.5" style={{ color: m.color }}>{dayLabel(d)}</div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-[14px] font-mono font-medium">{b.quantity}<span className="text-[11px] text-[color:var(--muted)]"> un</span></div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-5 py-3 bg-[color:oklch(0.985_0.005_95)] border-t flex items-center justify-between text-[11.5px] text-[color:var(--muted)]" style={{ borderColor: 'var(--border)' }}>
            <span>Mostrando 5 de {batches.length} lotes</span>
            <span className="inline-flex items-center gap-1.5"><I.Sparkle size={11}/> Atualizado em tempo real</span>
          </div>
        </section>
      </div>

      <FAB onClick={onNewBatch} />
    </div>
  );
};

const Stat = ({ label, value, preview }) => (
  <div className="text-center relative">
    <div className="text-[14.5px] font-mono font-semibold tracking-tight inline-flex items-center gap-1" style={{ color: preview ? 'var(--muted)' : 'var(--fg)' }}>
      {preview && <I.Sparkle size={10} style={{ color: 'var(--muted-2)' }}/>}
      {value}
    </div>
    <div className="text-[9.5px] uppercase tracking-wide mt-0.5 inline-flex items-center gap-1 justify-center" style={{ color: 'var(--muted)' }}>
      {label}
      {preview && (
        <span
          title="Estimativa — relatório completo em breve"
          className="px-1 py-px rounded-[3px] text-[8.5px] font-medium normal-case tracking-normal"
          style={{
            background: 'oklch(0.95 0.005 95)',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            letterSpacing: 0,
          }}
        >prévia</span>
      )}
    </div>
  </div>
);

const StatCard = ({ status, count, label, desc, onClick }) => {
  const m = STATUS_META[status];
  const isCrit = status === 'CRITICAL';
  const IconC =
    status === 'CRITICAL' ? I.AlertTri :
    status === 'WARNING'  ? I.Clock :
    status === 'SAFE'     ? I.ShieldCheck :
                            I.XCircle;
  return (
    <button
      onClick={onClick}
      className="card-hover ray relative text-left rounded-xl border bg-white p-4 lg:p-5 group"
      style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Anchored crit badge — top-right */}
      {isCrit && count > 0 && (
        <span
          className="pulse-crit absolute"
          style={{
            top: -5, right: -5,
            width: 12, height: 12, borderRadius: 999,
            background: m.color,
            boxShadow: '0 0 0 2px var(--surface), 0 0 0 3px ' + m.border,
          }}
        />
      )}

      <div className="mb-3">
        <span
          className="grid place-items-center rounded-lg ray"
          style={{
            width: 34, height: 34,
            background: m.soft,
            color: m.color,
            border: `1px solid ${m.border}`,
          }}
        >
          <IconC size={17} stroke={2} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[34px] font-semibold font-mono tracking-tight leading-none" style={{ color: 'var(--fg)' }}>{count}</div>
        <div className="text-[12.5px] font-medium" style={{ color: m.color }}>{label}</div>
      </div>
      <div className="mt-2 text-[12px] text-[color:var(--muted)]">{desc}</div>
    </button>
  );
};

window.DashboardScreen = DashboardScreen;
