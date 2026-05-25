import { describe, it, expect, beforeEach } from 'vitest';
import { ensureRateLimit, __resetRateLimitForTests } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';

describe('ensureRateLimit', () => {
  beforeEach(() => __resetRateLimitForTests());

  it('passa exatamente `limit` chamadas e bloqueia a próxima', () => {
    const args = { key: 'test:A', limit: 5, windowMs: 60_000 };
    expect(() => ensureRateLimit(args)).not.toThrow(); // 1
    expect(() => ensureRateLimit(args)).not.toThrow(); // 2
    expect(() => ensureRateLimit(args)).not.toThrow(); // 3
    expect(() => ensureRateLimit(args)).not.toThrow(); // 4
    expect(() => ensureRateLimit(args)).not.toThrow(); // 5
    expect(() => ensureRateLimit(args)).toThrow(RateLimitError); // 6: BLOCK
    expect(() => ensureRateLimit(args)).toThrow(RateLimitError); // 7: BLOCK
  });

  it('chave por-empresa isola contadores', () => {
    const a = { key: 'alerts.test:A', limit: 2, windowMs: 60_000 };
    const b = { key: 'alerts.test:B', limit: 2, windowMs: 60_000 };
    expect(() => ensureRateLimit(a)).not.toThrow();
    expect(() => ensureRateLimit(a)).not.toThrow();
    expect(() => ensureRateLimit(a)).toThrow(RateLimitError);
    // B começa do zero — chave diferente
    expect(() => ensureRateLimit(b)).not.toThrow();
    expect(() => ensureRateLimit(b)).not.toThrow();
    expect(() => ensureRateLimit(b)).toThrow(RateLimitError);
  });
});
