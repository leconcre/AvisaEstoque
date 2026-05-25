// === LOGIN ===
const { I, Logo, Button, Field, Input } = window;
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('ebervaldo@santacruz.com.br');
  const [password, setPassword] = useState('••••••••');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 600);
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-[color:var(--bg)]">
      {/* Left — form */}
      <div className="flex flex-col px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2.5">
          <Logo size={32} animated withWordmark withTagline />
        </div>

        <div className="flex-1 grid place-items-center">
          <form onSubmit={submit} className="w-full max-w-[380px]">
            <div className="mb-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-wide font-medium ray"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--brand)' }}></span>
              Entrar na sua conta
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight leading-[1.05] mt-2 mb-1.5" style={{ color: 'var(--fg)' }}>
              Bom dia,<br/>vamos cuidar do seu estoque.
            </h1>
            <p className="text-[13.5px] text-[color:var(--muted)] mb-7">
              Você raramente precisa abrir o app — o WhatsApp avisa. Mas estamos aqui quando precisar.
            </p>

            <div className="space-y-4">
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com.br"
                  autoComplete="email"
                />
              </Field>

              <Field label="Senha" kbd={<><kbd>Enter</kbd> para entrar</>}>
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="h-10 px-3 text-[color:var(--muted)] hover:text-[color:var(--fg-2)] transition-colors"
                  title={show ? 'Ocultar' : 'Mostrar'}
                >
                  {show ? <I.EyeOff size={16}/> : <I.Eye size={16}/>}
                </button>
              </Field>

              <div className="flex items-center justify-between">
                <label className="text-[12.5px] text-[color:var(--muted)] flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-[color:var(--brand)]" defaultChecked />
                  Manter conectado neste dispositivo
                </label>
                <a className="text-[12.5px] font-medium" href="#" style={{ color: 'var(--brand-fg)' }}>Esqueci minha senha</a>
              </div>

              <Button type="submit" size="lg" className="w-full mt-2" iconRight={loading ? null : <I.ArrowRight size={15}/>} disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>

              <div className="pt-2 text-center text-[12.5px] text-[color:var(--muted)]">
                Ainda não tem conta? <a href="#" className="font-medium" style={{ color: 'var(--brand-fg)' }}>Criar conta para minha empresa</a>
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3 text-[11.5px] text-[color:var(--muted)]">
          <I.Shield size={13} />
          <span>Dados criptografados · LGPD · Servidores no Brasil</span>
        </div>
      </div>

      {/* Right — generic messaging illustrative panel (NOT a brand clone) */}
      <div className="hidden lg:block relative overflow-hidden border-l grid-bg" style={{ borderColor: 'var(--border)', background: 'oklch(0.97 0.015 155)' }}>
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-32 w-[460px] h-[460px] rounded-full" style={{ background: 'radial-gradient(circle, oklch(0.7 0.16 155 / 0.18), transparent 65%)' }}/>
          <div className="absolute -bottom-20 -left-32 w-[460px] h-[460px] rounded-full" style={{ background: 'radial-gradient(circle, oklch(0.75 0.14 75 / 0.16), transparent 65%)' }}/>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center p-10">
          <div className="max-w-[380px] text-center mb-7">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-wide font-medium mb-3 ray"
              style={{ background: 'white', color: 'var(--brand-fg)', border: '1px solid var(--border)' }}>
              <I.Chat size={11}/> Como você é avisado
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight leading-[1.15]" style={{ color: 'var(--fg)' }}>
              Sem dashboard, sem planilha. Direto no celular do gerente.
            </h2>
          </div>

          {/* Generic phone-shape with chat bubbles, NOT a copy of a specific app */}
          <div className="relative ray rounded-[36px] bg-[color:#1a1c1a] p-3 shadow-lg" style={{ width: 312, boxShadow: 'var(--shadow-lg)' }}>
            <div className="rounded-[28px] overflow-hidden" style={{ background: 'oklch(0.95 0.01 155)' }}>
              {/* Header */}
              <div className="px-4 pt-3 pb-2.5 flex items-center gap-2.5" style={{ background: 'oklch(0.32 0.05 155)', color: 'white' }}>
                <I.ArrowLeft size={14} stroke={2} />
                <div className="grid place-items-center rounded-full" style={{ width: 28, height: 28, background: 'oklch(0.62 0.18 155)' }}>
                  <I.Logo size={16} />
                </div>
                <div className="leading-tight">
                  <div className="text-[12px] font-medium">AvisaEstoque · Alertas</div>
                  <div className="text-[10px] opacity-70">online · responde por aqui</div>
                </div>
                <div className="ml-auto flex gap-3 opacity-75">
                  <I.Phone size={13}/>
                </div>
              </div>

              {/* Chat */}
              <div className="px-3 py-4 space-y-2.5 text-[12px]" style={{ minHeight: 320 }}>
                <div className="text-center text-[10px] text-[color:var(--muted)]">Hoje · 08:00</div>

                <ChatBubble side="them">
                  <div className="font-semibold mb-0.5" style={{ color: 'var(--crit)' }}>⚠️ 2 lotes críticos hoje</div>
                  <div className="mb-1.5">Bom dia, Ebervaldo. Estes itens vencem em <b>≤ 3 dias</b>:</div>
                  <div className="rounded-md border p-2 space-y-1.5" style={{ borderColor: 'var(--border)', background: 'white' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[11.5px]">Pão de Forma Integral</div>
                        <div className="font-mono text-[10px] text-[color:var(--muted)]">L PF240910 · 12 un</div>
                      </div>
                      <div className="font-mono text-[10.5px]" style={{ color: 'var(--crit)' }}>1d</div>
                    </div>
                    <div className="h-px" style={{ background: 'var(--border)' }} />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[11.5px]">Iogurte Grego 170g</div>
                        <div className="font-mono text-[10px] text-[color:var(--muted)]">L L240815A · 24 un</div>
                      </div>
                      <div className="font-mono text-[10.5px]" style={{ color: 'var(--crit)' }}>2d</div>
                    </div>
                  </div>
                  <div className="text-[10.5px] text-[color:var(--muted)] mt-1.5">Sugestão: aplicar 25% OFF para escoar.</div>
                </ChatBubble>

                <ChatBubble side="me">
                  Vou colocar promoção. Obrigado!
                </ChatBubble>

                <ChatBubble side="them" small>
                  <div className="inline-flex items-center gap-1">
                    <span className="dot inline-block w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}/>
                    <span className="dot inline-block w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}/>
                    <span className="dot inline-block w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}/>
                  </div>
                </ChatBubble>
              </div>
            </div>
          </div>

          <div className="mt-7 text-center text-[12px] text-[color:var(--muted)] max-w-[300px]">
            “Em 4 meses parei de perder R$ 1.200/mês com produtos vencidos.”
            <div className="mt-1 text-[11px]">— Cláudia, Drogaria Boa Vista (Recife/PE)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatBubble = ({ side = 'them', children, small }) => {
  const me = side === 'me';
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] px-2.5 py-1.5 rounded-2xl ${small ? 'py-2' : ''}`}
        style={{
          background: me ? 'oklch(0.85 0.1 155)' : 'white',
          borderTopRightRadius: me ? 4 : 16,
          borderTopLeftRadius: me ? 16 : 4,
          color: 'var(--fg)',
          boxShadow: '0 1px 1px oklch(0 0 0 / 0.05)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

window.LoginScreen = LoginScreen;
