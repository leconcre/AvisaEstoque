// Module augmentation para o NextAuth v5 conhecer nossas extensões.
// O companyId vive no JWT (callback jwt) e é exposto no session.user (callback session).
// Adicionar campos aqui exige espelhá-los nos callbacks de auth.config.ts.

import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends DefaultUser {
    id: string;
    companyId: string;
    companyName?: string;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      email: string;
      name: string;
      companyId: string;
      companyName?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    companyId: string;
    companyName?: string;
  }
}
