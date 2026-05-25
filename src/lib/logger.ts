import pino from 'pino';

// Logger estruturado. Em dev usa pino-pretty para legibilidade no terminal;
// em prod escreve JSON puro (mais barato para coletores como Loki/Datadog).
// LGPD: nunca logue email/telefone — use companyId/userId/batchId.

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: { app: 'avisaestoque' },
  redact: {
    paths: [
      'email',
      'password',
      'passwordHash',
      'whatsappPhone',
      '*.email',
      '*.password',
      '*.passwordHash',
      '*.whatsappPhone',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,app',
          },
        },
      }
    : {}),
});
