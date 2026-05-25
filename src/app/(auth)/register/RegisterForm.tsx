'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

type FieldError = string | null;
type Errors = Partial<Record<'companyName' | 'whatsappPhone' | 'name' | 'email' | 'password' | 'form', string>>;

export function RegisterForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  function fieldError(key: keyof Errors): FieldError {
    return errors[key] ?? null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, whatsappPhone, name, email, password }),
      });

      if (res.ok) {
        // Faz signIn automático com as credenciais recém-criadas.
        const signInResult = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });
        if (signInResult?.error) {
          setErrors({ form: 'Conta criada, mas falhou ao entrar. Tente o login.' });
          router.push('/login');
          return;
        }
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: { fieldErrors?: Record<string, string[]> } } }
        | null;

      if (body?.error?.code === 'VALIDATION_ERROR') {
        const fe = body.error.details?.fieldErrors ?? {};
        const next: Errors = {};
        for (const [k, v] of Object.entries(fe)) {
          if (v?.[0]) next[k as keyof Errors] = v[0];
        }
        setErrors(next);
        return;
      }

      if (body?.error?.code === 'CONFLICT') {
        setErrors({ email: body.error.message ?? 'E-mail já cadastrado.' });
        return;
      }

      setErrors({ form: body?.error?.message ?? 'Falha no cadastro. Tente novamente.' });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nome da empresa" error={fieldError('companyName')}>
        <Input
          required
          autoFocus
          autoComplete="organization"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Mercadinho Santa Cruz"
        />
      </Field>

      <Field
        label="WhatsApp da empresa"
        hint="Formato internacional. Ex: +55 11 98765-4321"
        error={fieldError('whatsappPhone')}
      >
        <Input
          required
          autoComplete="tel"
          inputMode="tel"
          mono
          value={whatsappPhone}
          onChange={(e) => setWhatsappPhone(e.target.value)}
          placeholder="+55 11 98765-4321"
        />
      </Field>

      <div className="my-6 border-t border-border" />

      <Field label="Seu nome" error={fieldError('name')}>
        <Input
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ebervaldo Silva"
        />
      </Field>

      <Field label="Seu e-mail" error={fieldError('email')}>
        <Input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@suaempresa.com.br"
        />
      </Field>

      <Field
        label="Senha"
        hint="Mínimo 8 caracteres."
        error={fieldError('password')}
      >
        <Input
          required
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {errors.form && (
        <div
          role="alert"
          className="rounded-md border border-[var(--crit-border)] bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]"
        >
          {errors.form}
        </div>
      )}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Criar conta
      </Button>
    </form>
  );
}
