// === SETTINGS ===
const { useState } = React;
const { I, Button, Field, Input } = window;

const SettingsScreen = ({ company, onSave, onTestAlert }) => {
  const [name, setName] = useState(company.name);
  const [whatsapp, setWhatsapp] = useState(company.whatsapp);
  const [email, setEmail] = useState(company.email);
  const [alertsActive, setAlertsActive] = useState(company.alertsActive);
  const [alertTime, setAlertTime] = useState(company.alertTime);
  const [savedFlash, setSavedFlash] = useState(false);

  // E.164-ish validation: + then digits, 10-15 of them
  const phoneValid = /^\+?\d[\d\s\-()]{8,17}$/.test(whatsapp);

  const handleSave = () => {
    onSave({ name, whatsapp, email, alertsActive, alertTime });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <div className="screen-in">
      <div className="px-4 lg:px-8 py-6 lg:py-8 pb-28 max-w-[920px]">
        <div className="mb-6">
          <h1 className="text-[24px] lg:text-[28px] font-semibold tracking-tight leading-tight" style={{ color: 'var(--fg)' }}>Configurações</h1>
          <div className="text-[12.5px] text-[color:var(--muted)] mt-1">Empresa, canal de alerta e preferências de envio.</div>
        </div>

        <div className="space-y-5">
          {/* Empresa */}
          <Card title="Empresa" desc="Identificação visível nos alertas." icon={<I.Building size={14}/>}>
            <Field label="Nome da empresa">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mercadinho Santa Cruz"/>
            </Field>
            <Field label="E-mail do responsável">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email"/>
            </Field>
          </Card>

          {/* WhatsApp */}
          <Card title="Canal de alerta" desc="Para onde os avisos serão enviados." icon={<I.Chat size={14}/>}>
            <Field
              label="WhatsApp do gerente"
              hint={phoneValid ? '✓ Número válido (formato E.164).' : 'Use o formato internacional: +55 DDD número.'}
              error={!phoneValid && whatsapp.length > 0 ? 'Número inválido — confira o DDD' : null}
            >
              <span className="pl-3 pr-1 text-[color:var(--muted)]"><I.Phone size={14}/></span>
              <Input mono value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+55 81 99845-2210"/>
              {phoneValid && (
                <span className="pr-3 text-[color:var(--safe)]"><I.Check size={14} stroke={2.4}/></span>
              )}
            </Field>

            <div className="flex items-center justify-between rounded-lg border p-3.5"
              style={{ borderColor: 'var(--border-strong)', background: 'oklch(0.985 0.005 95)' }}>
              <div>
                <div className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>Alertas ativos</div>
                <div className="text-[12px] text-[color:var(--muted)] mt-0.5">
                  {alertsActive ? 'Você está recebendo notificações automáticas.' : 'Nenhum alerta será enviado.'}
                </div>
              </div>
              <button onClick={() => setAlertsActive(v => !v)} className="toggle ray" data-on={alertsActive} aria-label="Ativar alertas"/>
            </div>

            <Field label="Horário preferido" hint="Os alertas serão consolidados e enviados uma vez ao dia neste horário.">
              <select
                value={alertTime}
                onChange={(e) => setAlertTime(e.target.value)}
                className="w-full h-10 px-3 bg-transparent outline-none text-[14px] font-mono"
              >
                {['06:00','07:00','08:00','09:00','12:00','18:00','20:00'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="secondary" icon={<I.Send size={13}/>} onClick={onTestAlert}>Testar envio de alerta</Button>
              <div className="text-[11.5px] text-[color:var(--muted)]">Envia uma mensagem real de teste agora.</div>
            </div>
          </Card>

          {/* Plano */}
          <Card title="Plano e cobrança" desc="Resumo do uso atual." icon={<I.Sparkle size={14}/>}>
            <div className="rounded-xl border overflow-hidden ray" style={{ borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(180deg, oklch(0.97 0.02 155) 0%, white 100%)' }}>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-wide font-medium"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>Plano Comércio</span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--fg)' }}>R$ 49 / mês</span>
                <span className="ml-auto text-[11.5px] text-[color:var(--muted)]">Próx. cobrança em 12 jun</span>
              </div>
              <div className="grid grid-cols-3 divide-x border-t" style={{ borderColor: 'var(--border)' }}>
                <PlanStat label="Lotes" value="15 / 500"/>
                <PlanStat label="Alertas no mês" value="42 / ∞"/>
                <PlanStat label="Usuários" value="1 / 3"/>
              </div>
            </div>
          </Card>

          {/* Save bar */}
          <div className="sticky bottom-4 lg:bottom-6 flex items-center gap-2 rounded-2xl bg-white border ray px-4 py-3"
            style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-md)' }}>
            <div className="text-[12.5px] text-[color:var(--muted)]">
              {savedFlash ? (
                <span style={{ color: 'var(--safe)' }} className="inline-flex items-center gap-1.5"><I.Check size={12} stroke={2.4}/> Alterações salvas</span>
              ) : 'Algumas alterações não foram salvas.'}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" onClick={() => { setName(company.name); setWhatsapp(company.whatsapp); setEmail(company.email); setAlertsActive(company.alertsActive); setAlertTime(company.alertTime); }}>Descartar</Button>
              <Button variant="primary" icon={<I.Check size={14} stroke={2.4}/>} onClick={handleSave} disabled={!phoneValid}>Salvar alterações</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, desc, icon, children }) => (
  <section className="rounded-2xl border bg-white p-5 lg:p-6 ray space-y-4"
    style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
    <header className="flex items-start gap-3 pb-1">
      <span className="grid place-items-center rounded-md mt-0.5" style={{ width: 26, height: 26, background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
        {icon}
      </span>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>{title}</h2>
        <div className="text-[12.5px] text-[color:var(--muted)]">{desc}</div>
      </div>
    </header>
    {children}
  </section>
);

const PlanStat = ({ label, value }) => (
  <div className="px-4 py-3" style={{ borderColor: 'var(--border)' }}>
    <div className="text-[10.5px] uppercase tracking-wide text-[color:var(--muted)] mb-1">{label}</div>
    <div className="text-[13.5px] font-mono font-medium" style={{ color: 'var(--fg)' }}>{value}</div>
  </div>
);

window.SettingsScreen = SettingsScreen;
