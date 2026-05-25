import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Middleware roda no Edge runtime. Por isso importamos APENAS authConfig
// (sem providers, sem bcrypt, sem Prisma). O callback `authorized` no
// authConfig decide o que é público e o que exige sessão.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware((_req) => {
  // O trabalho real está no callback `authorized` do authConfig.
  // Esta função existe apenas para satisfazer a assinatura.
});

export const config = {
  // Matcher: tudo exceto assets estáticos e imagens otimizadas do Next.
  // O próprio callback `authorized` libera as rotas públicas (/login, /register, /api/auth, ...).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
