import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from './logger';

// AppError: erros esperados de domínio. Mensagem é segura para o cliente.
// Tudo que não for AppError vira 500 genérico (sem vazar stack para o front).

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de estado.') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Muitas requisições. Tente novamente em alguns instantes.') {
    super(message, 429, 'RATE_LIMITED');
  }
}

type ErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export function toErrorResponse(err: unknown): NextResponse<ErrorBody> {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }

  // Erro inesperado: loga server-side, devolve mensagem genérica.
  logger.error({ err }, 'Erro inesperado no handler');
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
    { status: 500 },
  );
}
