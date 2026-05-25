import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Cadastrar empresa — AvisaEstoque' };

export default function RegisterPage() {
  return (
    <div className="w-full max-w-[480px]">
      <div className="mb-6 flex justify-center">
        <Logo size={44} withWordmark />
      </div>
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="mb-1 text-[20px] font-semibold tracking-tight text-fg">
          Criar empresa
        </h1>
        <p className="mb-6 text-sm text-muted">
          Você é o primeiro usuário (administrador). Pode convidar outros depois.
        </p>

        <RegisterForm />

        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-medium text-[var(--brand-fg)] hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
