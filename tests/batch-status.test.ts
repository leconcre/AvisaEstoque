import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getBatchStatus,
  criticalThreshold,
  daysUntilExpiration,
  countByStatus,
} from '@/lib/utils/batch-status';

/**
 * Trava o relógio em 2026-05-20 03:00 UTC (= 2026-05-20 00:00 SP).
 * Os testes cobrem as bordas onde o sinal de cor muda (vai pra produção
 * justamente nessa borda — vale ter os casos cravados).
 */
const SP_NOON = new Date('2026-05-20T15:00:00Z'); // meio-dia SP — qualquer hora do dia civil 20/05/2026

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SP_NOON);
});

afterEach(() => {
  vi.useRealTimers();
});

function date(yyyymmdd: string): Date {
  return new Date(`${yyyymmdd}T00:00:00Z`);
}

describe('criticalThreshold (cap=14, floor=7)', () => {
  it('respeita o piso de 7 dias', () => {
    expect(criticalThreshold(1)).toBe(7);
    expect(criticalThreshold(7)).toBe(7);
  });
  it('respeita o cap de 14 dias', () => {
    expect(criticalThreshold(14)).toBe(14);
    expect(criticalThreshold(30)).toBe(14);
    expect(criticalThreshold(60)).toBe(14);
  });
  it('passa valores no meio do intervalo', () => {
    expect(criticalThreshold(10)).toBe(10);
    expect(criticalThreshold(13)).toBe(13);
  });
});

describe('getBatchStatus — datas relativas a 2026-05-20', () => {
  it('passado vira EXPIRED', () => {
    expect(getBatchStatus({ expirationDate: date('2026-05-19'), alertDaysBefore: 7 })).toBe('EXPIRED');
    expect(getBatchStatus({ expirationDate: date('2026-05-15'), alertDaysBefore: 7 })).toBe('EXPIRED');
  });

  it('hoje vira CRITICAL (diff=0)', () => {
    expect(getBatchStatus({ expirationDate: date('2026-05-20'), alertDaysBefore: 7 })).toBe('CRITICAL');
  });

  it('borda do limiar com alertDaysBefore=7 → CRITICAL ≤ 7d, WARNING entre 8 e 30', () => {
    expect(getBatchStatus({ expirationDate: date('2026-05-27'), alertDaysBefore: 7 })).toBe('CRITICAL'); // diff=7
    expect(getBatchStatus({ expirationDate: date('2026-05-28'), alertDaysBefore: 7 })).toBe('WARNING');  // diff=8
  });

  it('com alertDaysBefore=30, limiar do CRITICAL é capado em 14', () => {
    expect(getBatchStatus({ expirationDate: date('2026-06-03'), alertDaysBefore: 30 })).toBe('CRITICAL'); // diff=14
    expect(getBatchStatus({ expirationDate: date('2026-06-04'), alertDaysBefore: 30 })).toBe('WARNING');  // diff=15
  });

  it('com alertDaysBefore=2, limiar do CRITICAL é pisado em 7', () => {
    expect(getBatchStatus({ expirationDate: date('2026-05-27'), alertDaysBefore: 2 })).toBe('CRITICAL'); // diff=7
    expect(getBatchStatus({ expirationDate: date('2026-05-28'), alertDaysBefore: 2 })).toBe('WARNING');  // diff=8
  });

  it('borda WARNING → SAFE em diff=31', () => {
    expect(getBatchStatus({ expirationDate: date('2026-06-19'), alertDaysBefore: 30 })).toBe('WARNING'); // diff=30
    expect(getBatchStatus({ expirationDate: date('2026-06-20'), alertDaysBefore: 30 })).toBe('SAFE');    // diff=31
  });
});

describe('daysUntilExpiration', () => {
  it('amanhã = 1', () => {
    expect(daysUntilExpiration(date('2026-05-21'))).toBe(1);
  });
  it('ontem = -1', () => {
    expect(daysUntilExpiration(date('2026-05-19'))).toBe(-1);
  });
  it('hoje = 0', () => {
    expect(daysUntilExpiration(date('2026-05-20'))).toBe(0);
  });
});

describe('countByStatus replica a distribuição do seed (4/2/7/2)', () => {
  it('agrupa corretamente os 15 lotes do seed da Empresa A', () => {
    const seed = [
      // 4 CRITICAL
      { expirationDate: date('2026-05-22'), alertDaysBefore: 7  },
      { expirationDate: date('2026-05-24'), alertDaysBefore: 7  },
      { expirationDate: date('2026-05-21'), alertDaysBefore: 7  },
      { expirationDate: date('2026-05-27'), alertDaysBefore: 7  },
      // 2 WARNING
      { expirationDate: date('2026-06-15'), alertDaysBefore: 30 },
      { expirationDate: date('2026-06-08'), alertDaysBefore: 30 },
      // 7 SAFE
      { expirationDate: date('2026-06-30'), alertDaysBefore: 30 },
      { expirationDate: date('2026-09-12'), alertDaysBefore: 60 },
      { expirationDate: date('2026-11-04'), alertDaysBefore: 60 },
      { expirationDate: date('2027-02-18'), alertDaysBefore: 30 },
      { expirationDate: date('2026-12-22'), alertDaysBefore: 60 },
      { expirationDate: date('2027-05-10'), alertDaysBefore: 30 },
      { expirationDate: date('2026-06-22'), alertDaysBefore: 30 },
      // 2 EXPIRED
      { expirationDate: date('2026-05-19'), alertDaysBefore: 7 },
      { expirationDate: date('2026-05-15'), alertDaysBefore: 7 },
    ];
    const c = countByStatus(seed);
    expect(c).toEqual({ CRITICAL: 4, WARNING: 2, SAFE: 7, EXPIRED: 2, all: 15 });
  });
});
