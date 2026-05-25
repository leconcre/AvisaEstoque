import { PrismaClient } from '@prisma/client';

// Singleton para evitar abrir múltiplas connections em dev com HMR.
// Em prod (Next standalone) o módulo é instanciado uma vez por processo.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
