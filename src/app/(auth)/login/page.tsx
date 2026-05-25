import Link from 'next/link';

import { Logo } from '@/components/brand/Logo';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Entrar — AvisaEstoque' };
// LoginForm usa useSearchParams() para ler ?callbackUrl=. SSG estático exigiria
// Suspense boundary; como a página depende de cookies de qualquer forma, vamos
// de força-dinâmica — solução mais simples e sem custo prático.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="grid w-full max-w-[1080px] grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
      {/* Coluna esquerda: marca + tagline (única tela com Logo animado, HANDOFF §2) */}
      <div className="hidden flex-col gap-6 lg:flex">
        <Logo size={64} withWordmark withTagline animated />
        <p className="max-w-md text-sm leading-relaxed text-muted">
          O AvisaEstoque acompanha as datas de validade dos seus produtos
          e avisa pelo WhatsApp antes que vençam — sem precisar abrir o app.
        </p>
      </div>

      {/* Coluna direita: form */}
      <div className="w-full">
        <div className="mx-auto w-full max-w-[420px] rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 lg:hidden">
            <Logo size={40} withWordmark animated />
          </div>

          <h1 className="mb-1 text-[20px] font-semibold tracking-tight text-fg">
            Entrar
          </h1>
          <p className="mb-6 text-sm text-muted">
            Acesse o painel da sua empresa.
          </p>

          <LoginForm />

          <p className="mt-6 text-center text-sm text-muted">
            Ainda não tem conta?{' '}
            <Link
              href="/register"
              className="font-medium text-[var(--brand-fg)] hover:underline"
            >
              Cadastrar empresa
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
