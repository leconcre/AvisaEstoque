// Handlers REST do NextAuth v5. O auth.ts (Node) exporta `handlers = { GET, POST }`.
// Esta rota é o ponto de entrada para signIn/signOut/callback/csrf.
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
