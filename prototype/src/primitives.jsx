// === PRIMITIVES ===
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ——— Status meta ———
const STATUS_META = {
  CRITICAL: { label: 'Crítico',  color: 'var(--crit)',  soft: 'var(--crit-soft)',  border: 'var(--crit-border)',  dot: '#d93b27' },
  WARNING:  { label: 'Atenção',  color: 'var(--warn)',  soft: 'var(--warn-soft)',  border: 'var(--warn-border)',  dot: '#cf8b1a' },
  SAFE:     { label: 'Seguro',   color: 'var(--safe)',  soft: 'var(--safe-soft)',  border: 'var(--safe-border)',  dot: '#3a9266' },
  EXPIRED:  { label: 'Vencido',  color: 'var(--exp)',   soft: 'var(--exp-soft)',   border: 'var(--exp-border)',   dot: '#6b6b73' },
};

// ——— StatusBadge ———
const StatusBadge = ({ status, size = 'md', withPulse = true, withLabel = true }) => {
  const m = STATUS_META[status];
  const isCrit = status === 'CRITICAL';
  const dim = size === 'sm' ? { px: 'px-2', py: 'py-0.5', text: 'text-[10.5px]', dot: 6 } : { px: 'px-2.5', py: 'py-1', text: 'text-[11px]', dot: 7 };
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${dim.px} ${dim.py} rounded-full font-medium tracking-wide ${dim.text} ray`}
      style={{
        background: m.soft,
        color: m.color,
        border: `1px solid ${m.border}`,
      }}
    >
      <span
        className={isCrit && withPulse ? 'pulse-crit' : ''}
        style={{ width: dim.dot, height: dim.dot, borderRadius: 999, background: m.color, display: 'inline-block' }}
      />
      {withLabel && <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</span>}
    </span>
  );
};

// ——— Days remaining (numeric) ———
const DaysPill = ({ date }) => {
  const d = ddays(date);
  const status = statusOf(date);
  const m = STATUS_META[status];
  return (
    <span className="font-mono text-[12px]" style={{ color: m.color }}>
      {d < 0 ? `−${Math.abs(d)}d` : `${d}d`}
    </span>
  );
};

// ——— Buttons ———
const Button = ({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, type = 'button', disabled, className = '', title }) => {
  const sizing = size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-11 px-5 text-[14.5px]' : 'h-9 px-3.5 text-[13.5px]';
  if (variant === 'primary') {
    return (
      <button type={type} title={title} disabled={disabled} onClick={onClick}
        className={`btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ${sizing} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
        {icon}<span>{children}</span>{iconRight}
      </button>
    );
  }
  if (variant === 'ghost') {
    return (
      <button type={type} title={title} disabled={disabled} onClick={onClick}
        className={`btn-ghost inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ${sizing} text-[color:var(--fg-2)] ${className}`}>
        {icon}<span>{children}</span>{iconRight}
      </button>
    );
  }
  // secondary/outline
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`btn-ghost ray inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ${sizing} bg-white text-[color:var(--fg)] border ${className}`}
      style={{ borderColor: 'var(--border-strong)' }}>
      {icon}<span>{children}</span>{iconRight}
    </button>
  );
};

// ——— Field (input) ———
const Field = ({ label, hint, error, children, mono, kbd, focused }) => (
  <label className="block">
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11.5px] uppercase tracking-wide text-[color:var(--muted)] font-medium">{label}</span>
      {kbd && <span className="text-[10.5px] text-[color:var(--muted-2)] flex items-center gap-1">{kbd}</span>}
    </div>
    <div
      className={`ring-brand flex items-center rounded-lg bg-white border transition-colors ${mono ? 'font-mono' : ''} ${focused ? '' : ''}`}
      style={{ borderColor: error ? 'var(--crit)' : 'var(--border-strong)' }}
    >
      {children}
    </div>
    {hint && !error && <div className="mt-1.5 text-[11.5px] text-[color:var(--muted)]">{hint}</div>}
    {error && <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--crit)' }}>{error}</div>}
  </label>
);

const Input = React.forwardRef(({ mono, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    className={`w-full h-10 px-3 bg-transparent outline-none placeholder:text-[color:var(--muted-2)] text-[14px] ${mono ? 'font-mono' : ''} ${props.className || ''}`}
  />
));

// ——— Toast layer ———
const Toast = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onDismiss(), toast.duration || 3200);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const isErr = toast.kind === 'error';
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50" style={{ bottom: 24 }}>
      <div
        className="toast-in ray flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white shadow-lg border"
        style={{
          borderColor: isErr ? 'var(--crit-border)' : 'var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 22, height: 22,
            background: isErr ? 'var(--crit-soft)' : 'var(--brand-soft)',
            color: isErr ? 'var(--crit)' : 'var(--brand)',
          }}
        >
          {isErr ? <I.Alert size={13} /> : <I.Check size={13} stroke={2.4}/>}
        </span>
        <div className="text-[13.5px] font-medium" style={{ color: 'var(--fg)' }}>{toast.message}</div>
        {toast.sub && <div className="text-[12px] text-[color:var(--muted)]">· {toast.sub}</div>}
      </div>
    </div>
  );
};

// ——— Avatar ———
const Avatar = ({ name = '', size = 32 }) => {
  const initials = name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  return (
    <span
      className="inline-grid place-items-center rounded-full font-medium ray"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: 'linear-gradient(180deg, oklch(0.92 0.04 155) 0%, oklch(0.85 0.07 155) 100%)',
        color: 'var(--brand-fg)',
        border: '1px solid var(--brand-soft)',
      }}
    >{initials}</span>
  );
};

// ——— Sidebar nav (desktop) ———
const navItems = [
  { id: 'dashboard', label: 'Painel',        icon: I.Home },
  { id: 'batches',   label: 'Lotes',         icon: I.Box },
  { id: 'new',       label: 'Cadastrar',     icon: I.Plus },
  { id: 'settings',  label: 'Configurações', icon: I.Settings },
];

const Sidebar = ({ active, onNavigate, company }) => (
  <aside className="hidden lg:flex w-[232px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'oklch(0.985 0.005 95)' }}>
    <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
      <I.Logo size={28} />
      <div className="leading-tight">
        <div className="font-semibold text-[14.5px] tracking-tight" style={{ color: 'var(--fg)' }}>AvisaEstoque</div>
        <div className="text-[11px] text-[color:var(--muted)]">v1.0 · Beta</div>
      </div>
    </div>

    <div className="px-3 py-2">
      <div className="rounded-lg ray bg-white border px-3 py-2.5 flex items-center gap-2.5" style={{ borderColor: 'var(--border)' }}>
        <span className="grid place-items-center rounded-md" style={{ width: 28, height: 28, background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
          <I.Building size={14} />
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--fg)' }}>{company.name}</div>
          <div className="text-[11px] text-[color:var(--muted)] truncate">{company.managerName}</div>
        </div>
      </div>
    </div>

    <nav className="px-3 mt-2 flex flex-col gap-0.5">
      {navItems.map(n => {
        const IconC = n.icon;
        const isActive = active === n.id;
        return (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className="group flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13.5px] transition-colors"
            style={{
              background: isActive ? 'var(--brand-soft)' : 'transparent',
              color: isActive ? 'var(--brand-fg)' : 'var(--fg-2)',
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <IconC size={16} stroke={isActive ? 2 : 1.75} />
            <span>{n.label}</span>
            {n.id === 'new' && !isActive && (
              <span className="ml-auto text-[10.5px] font-mono text-[color:var(--muted-2)]">N</span>
            )}
          </button>
        );
      })}
    </nav>

    <div className="mt-auto px-3 pb-4">
      <div className="rounded-lg border p-3 ray" style={{ borderColor: 'var(--border)', background: 'oklch(0.98 0.01 155 / 0.5)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <I.Sparkle size={13} style={{ color: 'var(--brand)' }} />
          <div className="text-[11.5px] font-semibold tracking-wide uppercase" style={{ color: 'var(--brand-fg)' }}>Dica</div>
        </div>
        <p className="text-[12px] leading-snug text-[color:var(--muted)]">
          Aperte <kbd>N</kbd> em qualquer tela para cadastrar um lote rapidamente.
        </p>
      </div>
    </div>
  </aside>
);

// ——— Bottom nav (mobile) ———
const BottomNav = ({ active, onNavigate }) => (
  <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur border-t flex items-stretch" style={{ borderColor: 'var(--border)' }}>
    {navItems.map(n => {
      const IconC = n.icon;
      const isActive = active === n.id;
      return (
        <button
          key={n.id}
          onClick={() => onNavigate(n.id)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5"
          style={{ color: isActive ? 'var(--brand-fg)' : 'var(--muted)' }}
        >
          <IconC size={18} stroke={isActive ? 2.1 : 1.7} />
          <span className="text-[10.5px] font-medium" style={{ letterSpacing: '0.01em' }}>{n.label}</span>
        </button>
      );
    })}
  </nav>
);

// ——— Top bar (mobile + desktop right header) ———
const TopBar = ({ title, subtitle, onNavigate, active, company, right }) => (
  <header className="sticky top-0 z-30 backdrop-blur bg-[color:var(--bg)]/85 border-b" style={{ borderColor: 'var(--border)' }}>
    <div className="flex items-center gap-3 px-4 lg:px-8 h-[60px]">
      <div className="lg:hidden flex items-center gap-2">
        <I.Logo size={22} />
        <span className="font-semibold text-[14px] tracking-tight">AvisaEstoque</span>
      </div>

      <div className="hidden lg:block min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight leading-none" style={{ color: 'var(--fg)' }}>{title}</h1>
        {subtitle && <div className="text-[12px] text-[color:var(--muted)] mt-1">{subtitle}</div>}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {right}
        <button
          className="relative h-9 w-9 grid place-items-center rounded-lg btn-ghost border bg-white"
          style={{ borderColor: 'var(--border)' }}
          title="Notificações"
        >
          <I.Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--crit)' }} />
        </button>
        <div className="flex items-center gap-2 pl-2">
          <Avatar name={company.managerName} size={32} />
          <div className="hidden xl:block leading-tight">
            <div className="text-[12.5px] font-medium">{company.managerName}</div>
            <div className="text-[11px] text-[color:var(--muted)]">{company.name}</div>
          </div>
        </div>
      </div>
    </div>
  </header>
);

// ——— Empty state ———
const EmptyState = ({ icon, title, desc, action }) => (
  <div className="grid place-items-center text-center px-6 py-16">
    <div className="grid place-items-center rounded-2xl mb-4 ray"
      style={{ width: 60, height: 60, background: 'var(--brand-soft)', color: 'var(--brand-fg)' }}>
      {icon}
    </div>
    <div className="text-[16px] font-semibold tracking-tight mb-1">{title}</div>
    <div className="text-[13px] text-[color:var(--muted)] max-w-[360px] mb-5">{desc}</div>
    {action}
  </div>
);

// ——— Floating action button (mobile + dashboard CTA) ———
const FAB = ({ onClick, label = 'Cadastrar lote' }) => (
  <button
    onClick={onClick}
    className="btn-primary fixed lg:absolute right-5 bottom-20 lg:bottom-6 z-30 h-12 px-5 rounded-full inline-flex items-center gap-2 font-medium text-[14px]"
    style={{ boxShadow: '0 12px 32px -8px oklch(0.55 0.18 155 / 0.5), inset 0 1px 0 0 oklch(1 0 0 / 0.2), inset 0 -1px 0 0 oklch(0 0 0 / 0.18)' }}
  >
    <I.Plus size={16} stroke={2.4}/>
    <span>{label}</span>
  </button>
);

// Export
Object.assign(window, {
  STATUS_META, StatusBadge, DaysPill, Button, Field, Input, Toast, Avatar,
  Sidebar, BottomNav, TopBar, EmptyState, FAB,
});
