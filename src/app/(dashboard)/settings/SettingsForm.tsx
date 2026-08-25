'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Send, Sparkles, MessageSquare, Lock, Check } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

type Plan = 'BASIC' | 'PRO';

interface CompanyData {
  name: string;
  whatsappPhone: string;
  alertEnabled: boolean;
  alertTime: string;
  plan: Plan;
}

interface SettingsFormProps {
  initial: CompanyData;
  assistantLimits: Record<Plan, number>;
}

type Toast = { kind: 'success' | 'error'; msg: string } | null;

export function SettingsForm({ initial, assistantLimits }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [whatsappPhone, setWhatsappPhone] = useState(initial.whatsappPhone);
  const [alertEnabled, setAlertEnabled] = useState(initial.alertEnabled);
  const [alertTime, setAlertTime] = useState(initial.alertTime);
  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'whatsappPhone' | 'alertTime' | 'form', string>>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [savePending, startSave] = useTransition();
  const [planPending, startPlanChange] = useTransition();
  const [testPending, startTest] = useTransition();

  function flashToast(t: NonNullable<Toast>) {
    setToast(t);
    setTimeout(() => setToast(null), 3200);
  }

  /** Salva campos do formulário (NÃO o plan — plan tem fluxo próprio). */
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startSave(async () => {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whatsappPhone, alertEnabled, alertTime }),
      });
      if (res.ok) {
        flashToast({ kind: 'success', msg: 'Configurações salvas.' });
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } } }
        | null;
      if (body?.error?.code === 'VALIDATION_ERROR') {
        const fe = body.error.details?.fieldErrors ?? {};
        const next: typeof errors = {};
        for (const [k, v] of Object.entries(fe)) {
          if (v?.[0]) (next as Record<string, string>)[k] = v[0];
        }
        setErrors(next);
        return;
      }
      flashToast({ kind: 'error', msg: body?.error?.message ?? 'Falha ao salvar.' });
    });
  }

  /** Troca de plano — PATCH dedicado (UX clara: ação distinta de "salvar dados"). */
  async function changePlan(nextPlan: Plan) {
    if (nextPlan === plan) return;
    startPlanChange(async () => {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan }),
      });
      if (res.ok) {
        setPlan(nextPlan);
        flashToast({
          kind: 'success',
          msg: nextPlan === 'PRO' ? 'Plano atualizado para PRO ✨' : 'Plano alterado para BASIC',
        });
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        flashToast({ kind: 'error', msg: body?.error?.message ?? 'Falha ao trocar plano.' });
      }
    });
  }

  async function testSend() {
    startTest(async () => {
      const res = await fetch('/api/alerts/test', { method: 'POST' });
      if (res.ok) {
        flashToast({ kind: 'success', msg: 'Notificação de teste no sino ✓' });
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      flashToast({ kind: 'error', msg: body?.error?.message ?? 'Falha no envio.' });
    });
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      {/* ============================== Plano ============================== */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Plano</h2>
            <p className="mt-0.5 text-xs text-muted">Define os limites do assistente e os canais futuros.</p>
          </div>
          <PlanBadge plan={plan} />
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <PlanCard
            plan="BASIC"
            active={plan === 'BASIC'}
            assistantLimit={assistantLimits.BASIC}
            pending={planPending && plan !== 'BASIC'}
            onSelect={() => changePlan('BASIC')}
          />
          <PlanCard
            plan="PRO"
            active={plan === 'PRO'}
            assistantLimit={assistantLimits.PRO}
            pending={planPending && plan !== 'PRO'}
            onSelect={() => changePlan('PRO')}
          />
        </div>

        <p className="mt-4 text-[11px] text-muted-2">
          Sem cobrança neste MVP — o toggle ajusta os limites imediatamente. Quando o gateway de pagamento entrar, a troca passará por checkout.
        </p>
      </section>

      {/* ============================== Dados ============================== */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-fg">Dados da empresa</h2>
        <p className="mt-0.5 text-xs text-muted">Visível para você na sidebar e no painel.</p>

        <div className="mt-4 space-y-4">
          <Field label="Nome da empresa" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <Field
            label="WhatsApp do gerente"
            hint="Formato internacional. Ex: +55 11 98765-4321 — usado quando o canal premium for habilitado."
            error={errors.whatsappPhone}
          >
            <Input
              mono
              inputMode="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              required
            />
          </Field>
        </div>
      </section>

      {/* ========================= Canal de alerta ========================= */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Canal de alerta</h2>
            <p className="mt-0.5 text-xs text-muted">Quando e como você quer ser avisado.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Send className="h-3.5 w-3.5" />}
            loading={testPending}
            onClick={() => void testSend()}
          >
            Testar envio
          </Button>
        </header>

        <div className="mt-4 space-y-4">
          {/* Canal in-app — sempre ativo */}
          <div className="flex items-start gap-3 rounded-md border border-[var(--safe-border)] bg-[var(--safe-soft)] px-4 py-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--safe)] text-white">
              <Check className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-fg">Notificação no app</p>
                <span className="rounded-full bg-[var(--safe)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                  Ativo
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Disponível em todos os planos. O sino acende sempre que há lotes vencendo.
              </p>
            </div>
          </div>

          {/* Canal WhatsApp — desativado no MVP, indicado como "Em breve" */}
          <div className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted-2/30 text-muted">
              <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-muted">WhatsApp</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                  <Lock className="h-2.5 w-2.5" /> Em breve · PRO
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Envio do digest diário no WhatsApp do gerente. Disponível no plano PRO quando a integração for liberada.
              </p>
            </div>
          </div>

          {/* Toggle alertEnabled */}
          <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Alertas ativos</p>
              <p className="mt-0.5 text-xs text-muted">
                {alertEnabled ? 'A varredura diária está rodando e vai notificar no sino.' : 'Nenhuma notificação será gerada.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={alertEnabled}
              onClick={() => setAlertEnabled((v) => !v)}
              className={[
                'relative h-6 w-11 rounded-full transition-colors',
                alertEnabled ? 'bg-[var(--brand)]' : 'bg-border-strong',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                  alertEnabled ? 'left-[22px]' : 'left-0.5',
                ].join(' ')}
              />
            </button>
          </div>

          <Field
            label="Horário do disparo (America/Sao_Paulo)"
            hint="Múltiplo de 15 min funciona melhor (08:00, 08:15, 08:30…)."
            error={errors.alertTime}
          >
            <Input
              type="time"
              mono
              value={alertTime}
              onChange={(e) => setAlertTime(e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* ============================== Submit ============================== */}
      <div className="flex items-center justify-end gap-3">
        {toast && (
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium',
              toast.kind === 'success'
                ? 'border-[var(--safe-border)] bg-[var(--safe-soft)] text-[var(--safe)]'
                : 'border-[var(--crit-border)] bg-[var(--crit-soft)] text-[var(--crit)]',
            ].join(' ')}
            style={{ animation: 'toast-in 220ms ease-out' }}
            role="status"
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {toast.msg}
          </span>
        )}
        <Button type="submit" loading={savePending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Subcomponentes
// ============================================================================

function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === 'PRO') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-fg)]">
        <Sparkles className="h-3.5 w-3.5" />
        PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted">
      BASIC
    </span>
  );
}

function PlanCard({
  plan,
  active,
  assistantLimit,
  pending,
  onSelect,
}: {
  plan: Plan;
  active: boolean;
  assistantLimit: number;
  pending: boolean;
  onSelect: () => void;
}) {
  const features =
    plan === 'BASIC'
      ? [
          { ok: true, text: 'Notificação no app (sino)' },
          { ok: true, text: `${assistantLimit} perguntas/dia ao assistente` },
          { ok: false, text: 'WhatsApp (em breve)' },
        ]
      : [
          { ok: true, text: 'Notificação no app (sino)' },
          { ok: true, text: `${assistantLimit} perguntas/dia ao assistente` },
          { ok: true, text: 'WhatsApp do gerente (quando habilitado)' },
        ];

  return (
    <div
      className={[
        'flex flex-col rounded-lg border p-4 transition-colors',
        active
          ? 'border-[var(--brand)] bg-[var(--brand-soft)]/50 shadow-sm'
          : 'border-border bg-background',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          {plan === 'PRO' && <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]" />}
          {plan}
        </h3>
        {active && (
          <span className="rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
            Atual
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-fg-2">
        {features.map((f) => (
          <li key={f.text} className="flex items-start gap-1.5">
            {f.ok ? (
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--safe)]" strokeWidth={2.5} />
            ) : (
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted" strokeWidth={1.75} />
            )}
            <span className={f.ok ? '' : 'text-muted'}>{f.text}</span>
          </li>
        ))}
      </ul>
      {!active && (
        <button
          type="button"
          onClick={onSelect}
          disabled={pending}
          className={[
            'mt-4 rounded-md py-1.5 text-xs font-medium transition-colors',
            plan === 'PRO'
              ? 'bg-[linear-gradient(180deg,oklch(0.62_0.20_155),oklch(0.55_0.18_155))] text-white hover:brightness-105 disabled:opacity-50'
              : 'border border-border bg-surface text-fg-2 hover:bg-background disabled:opacity-50',
          ].join(' ')}
        >
          {pending ? 'Trocando…' : plan === 'PRO' ? 'Mudar para PRO' : 'Voltar para BASIC'}
        </button>
      )}
    </div>
  );
}
