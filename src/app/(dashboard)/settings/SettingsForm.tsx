'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

interface CompanyData {
  name: string;
  whatsappPhone: string;
  alertEnabled: boolean;
  alertTime: string;
}

interface SettingsFormProps {
  initial: CompanyData;
}

type Toast = { kind: 'success' | 'error'; msg: string } | null;

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [whatsappPhone, setWhatsappPhone] = useState(initial.whatsappPhone);
  const [alertEnabled, setAlertEnabled] = useState(initial.alertEnabled);
  const [alertTime, setAlertTime] = useState(initial.alertTime);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'whatsappPhone' | 'alertTime' | 'form', string>>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [savePending, startSave] = useTransition();
  const [testPending, startTest] = useTransition();

  function flashToast(t: NonNullable<Toast>) {
    setToast(t);
    setTimeout(() => setToast(null), 3200);
  }

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
        // Refresh para o layout (que lê o name fresh do banco) atualizar a sidebar.
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

  async function testSend() {
    startTest(async () => {
      const res = await fetch('/api/alerts/test', { method: 'POST' });
      if (res.ok) {
        flashToast({ kind: 'success', msg: 'Mensagem de teste enviada ✓' });
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      flashToast({ kind: 'error', msg: body?.error?.message ?? 'Falha no envio.' });
    });
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-[15px] font-semibold text-fg">Dados da empresa</h2>
        <p className="mt-0.5 text-xs text-muted">Visível para você na sidebar e no painel.</p>

        <div className="mt-4 space-y-4">
          <Field label="Nome da empresa" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <Field
            label="WhatsApp do gerente"
            hint="Formato internacional. Ex: +55 11 98765-4321"
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

      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Canal de alerta</h2>
            <p className="mt-0.5 text-xs text-muted">Quando você quer ser avisado?</p>
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
          {/* Toggle alertEnabled */}
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Alertas ativos</p>
              <p className="mt-0.5 text-xs text-muted">
                {alertEnabled ? 'Vamos enviar mensagens quando houver lotes próximos do vencimento.' : 'Nenhuma mensagem será enviada.'}
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
        {errors.form && (
          <span className="text-xs text-[var(--crit)]" role="alert">
            {errors.form}
          </span>
        )}
        <Button type="submit" loading={savePending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
