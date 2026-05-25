import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { authConfig } from './auth.config';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';
import { loginSchema } from './lib/validations/auth';

/**
 * Hash dummy REAL gerado com cost 12 — pré-computado uma vez no boot do módulo.
 * Usado quando o e-mail não existe, para que o tempo de bcrypt.compare seja
 * indistinguível do caso "usuário existe, senha errada" (mitiga enumeração via timing).
 *
 * Pré-computar evita rodar hashSync(cost=12) em todo login miss (≈200ms).
 * O hash é descartável; qualquer senha que bata seria coincidência criptográfica
 * tão improvável quanto adivinhar a senha de qualquer outro usuário do banco.
 */
const DUMMY_HASH = bcrypt.hashSync('dummy_password_for_timing_mitigation', 12);

/**
 * NextAuth Node-side. Aqui podemos usar bcrypt e Prisma sem dor — este arquivo
 * NUNCA deve ser importado do middleware (que é Edge).
 *
 * Estratégia: validar com Zod, buscar User pelo email (case-insensitive já tratado
 * pelo schema), comparar com bcrypt. Em caso de sucesso, devolvemos o objeto User
 * estendido com companyId/companyName — os callbacks em auth.config.ts injetam
 * isso no JWT/session.
 */
export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(rawCredentials) {
        // 1. Validação de input. Falha silenciosa (retornar null) — não vazamos
        //    se foi email inválido ou senha vazia, pra dificultar enumeração.
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          logger.debug({ issues: parsed.error.flatten() }, 'login: payload inválido');
          return null;
        }
        const { email, password } = parsed.data;

        // 2. Busca o User com a Company aninhada (precisamos do nome pro token).
        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: { select: { id: true, name: true } } },
        });
        if (!user) {
          // bcrypt.compare contra um hash REAL de cost 12 — paga os ~200ms
          // de KDF mesmo no caso "user not found", para que o tempo total
          // não vire um oráculo de enumeração de e-mails.
          await bcrypt.compare(password, DUMMY_HASH);
          logger.info({ event: 'login.fail', reason: 'user_not_found' }, 'login falhou');
          return null;
        }

        // 3. Confere senha.
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          logger.info({ event: 'login.fail', userId: user.id, reason: 'bad_password' }, 'login falhou');
          return null;
        }

        logger.info({ event: 'login.ok', userId: user.id, companyId: user.companyId }, 'login ok');

        // 4. O retorno alimenta o callback jwt (com `user`) na primeira chamada.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          companyId: user.companyId,
          companyName: user.company.name,
        };
      },
    }),
  ],
});
