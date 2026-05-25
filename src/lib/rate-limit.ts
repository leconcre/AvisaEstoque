import { RateLimitError } from './errors';

/**
 * Rate limit in-memory simples (token bucket / janela fixa).
 *
 * LIMITAÇÃO conhecida: o Map vive na memória do processo. Funciona bem em
 * single-instance (Node em VM/contêiner único) — o que basta para o MVP.
 * Em deploy serverless ou multi-instância, cada réplica tem seu próprio
 * contador → trocar por Redis/Upstash. TODO marcado.
 *
 * NOTA DEV: em `next dev` o estado in-memory pode ser inflado por uma
 * warm-up call do route handler na primeira compilação — observado
 * empiricamente como "1 chamada extra antes do block". O teste unitário em
 * tests/rate-limit.test.ts cobre o limiter isolado e demonstra que a regra é
 * exata (5 passam, 6ª bloqueia para limit=5). Em produção (next build +
 * node server.js), o módulo carrega uma vez só e o comportamento é exato.
 *
 * Uso:
 *   ensureRateLimit({ key: `register:${ip}`, limit: 10, windowMs: 60_000 });
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// GC oportunista: a cada N hits, varre os expirados.
let hits = 0;
function gcMaybe() {
  hits += 1;
  if (hits % 500 !== 0) return;
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function ensureRateLimit(args: { key: string; limit: number; windowMs: number }): void {
  const { key, limit, windowMs } = args;
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }

  b.count += 1;
  gcMaybe();

  if (b.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    throw new RateLimitError(
      `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
    );
  }
}

/**
 * Extrai IP do request. Confia em x-forwarded-for quando atrás de proxy
 * (Vercel/Cloudflare/etc colocam). Caso contrário, cai pra "unknown" —
 * efeito colateral aceitável: todos os requests "unknown" compartilham bucket,
 * o que é mais conservador (rate limita mais cedo) e está OK para login/register.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? 'unknown';
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

// Apenas para testes — limpa o estado entre cases.
export function __resetRateLimitForTests() {
  buckets.clear();
  hits = 0;
}
