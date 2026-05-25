import type { NextAuthConfig } from 'next-auth';

/**
 * Config edge-safe do NextAuth v5.
 *
 * IMPORTANTE: este arquivo é importado pelo middleware (que roda no Edge runtime).
 * NÃO importar bcrypt, Prisma client ou nada que dependa de APIs Node aqui.
 * Os providers ficam vazios neste split — eles são adicionados em src/auth.ts (Node).
 *
 * - `authorized` protege as rotas (dashboard) e a área /api (exceto /api/auth).
 * - `jwt`/`session` propagam `companyId` para que requireCompanyContext() o leia
 *   de session.user.companyId em qualquer Server Component / route handler.
 *
 * NÃO adicionar callback `redirect` aqui — o default do NextAuth v5 já valida
 * same-origin (rejeita URLs externas no callbackUrl). Customizar sem manter
 * essa checagem abre brecha de open redirect.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLogged = !!auth?.user;
      const path = nextUrl.pathname;

      // Rotas públicas:
      const isPublic =
        path === '/' ||
        path.startsWith('/login') ||
        path.startsWith('/register') ||
        path.startsWith('/api/auth') ||  // NextAuth handlers
        path.startsWith('/api/cron') ||  // protegido por header X-Cron-Secret
        path === '/api/health' ||         // healthcheck do Coolify (sem segredos)
        path.startsWith('/_next') ||
        path.startsWith('/logo.svg') ||
        path === '/favicon.ico';

      if (isPublic) {
        // Se já está logado e tenta acessar /login ou /register, joga pro dashboard.
        if (isLogged && (path.startsWith('/login') || path.startsWith('/register'))) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      }

      // Tudo o mais exige sessão. Retornar false faz o middleware redirecionar pra /login.
      return isLogged;
    },
    jwt({ token, user }) {
      // user só aparece no login inicial; depois propagamos pelo próprio token.
      // O DefaultUser do NextAuth tem id?: string, mas no nosso authorize
      // sempre retornamos com id presente — narrowing explícito.
      if (user && user.id) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.companyId = token.companyId;
      session.user.companyName = token.companyName;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
