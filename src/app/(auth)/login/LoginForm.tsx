'use client';

import { useState, useTransition } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        // NextAuth v5 não diferencia tipos de erro de credenciais por padrão.
        // Mantemos mensagem genérica — é o correto pra dificultar enumeração.
        setError('E-mail ou senha inválidos.');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="E-mail">
        <Input
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@suaempresa.com.br"
        />
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--crit-border)] bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]"
        >
          {error}
        </div>
      )}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
