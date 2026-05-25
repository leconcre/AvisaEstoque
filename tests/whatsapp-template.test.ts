import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderAlertMessage, renderTestMessage, type AlertBatchInput } from '@/lib/whatsapp/templates';

const SP_NOON = new Date('2026-05-20T15:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SP_NOON);
});
afterEach(() => vi.useRealTimers());

function batch(over: Partial<AlertBatchInput>): AlertBatchInput {
  return {
    productName: 'Iogurte Grego 170g',
    lotNumber: 'L240815A',
    quantity: 24,
    expirationDate: new Date('2026-05-22T00:00:00Z'),
    status: 'CRITICAL',
    ...over,
  };
}

describe('renderAlertMessage', () => {
  it('uma mensagem por empresa agrupa N lotes', () => {
    const msg = renderAlertMessage([
      batch({ productName: 'A', lotNumber: 'L1' }),
      batch({ productName: 'B', lotNumber: 'L2' }),
      batch({ productName: 'C', lotNumber: 'L3' }),
      batch({ productName: 'D', lotNumber: 'L4' }),
    ]);
    expect(msg).toContain('AvisaEstoque — Alerta de Validade');
    expect(msg).toContain('*A*');
    expect(msg).toContain('*B*');
    expect(msg).toContain('*C*');
    expect(msg).toContain('*D*');
    expect(msg).toContain('4 lotes precisam de atenção hoje');
    // UMA mensagem, NÃO 4 — sem duplicar header
    expect(msg.match(/AvisaEstoque — Alerta de Validade/g)?.length).toBe(1);
  });

  it('ordena por proximidade (vencidos primeiro, depois críticos crescentes)', () => {
    const msg = renderAlertMessage([
      batch({ productName: 'Z-FAR',   expirationDate: new Date('2026-06-01T00:00:00Z'), status: 'WARNING' }),
      batch({ productName: 'A-EXPIR', expirationDate: new Date('2026-05-15T00:00:00Z'), status: 'EXPIRED' }),
      batch({ productName: 'M-NEAR',  expirationDate: new Date('2026-05-22T00:00:00Z'), status: 'CRITICAL' }),
    ]);
    const idxExpired = msg.indexOf('A-EXPIR');
    const idxNear    = msg.indexOf('M-NEAR');
    const idxFar     = msg.indexOf('Z-FAR');
    expect(idxExpired).toBeLessThan(idxNear);
    expect(idxNear).toBeLessThan(idxFar);
  });

  it('usa emoji ⛔ pra EXPIRED, 🚨 pra CRITICAL, ⏰ pra WARNING', () => {
    const m = renderAlertMessage([
      batch({ productName: 'EX', status: 'EXPIRED',  expirationDate: new Date('2026-05-15T00:00:00Z') }),
      batch({ productName: 'CR', status: 'CRITICAL', expirationDate: new Date('2026-05-22T00:00:00Z') }),
      batch({ productName: 'WA', status: 'WARNING',  expirationDate: new Date('2026-06-15T00:00:00Z') }),
    ]);
    expect(m).toMatch(/⛔ \*EX\*/);
    expect(m).toMatch(/🚨 \*CR\*/);
    expect(m).toMatch(/⏰ \*WA\*/);
  });

  it('"vencido há N dia(s)" / "vence em N dias" / "vence hoje"', () => {
    expect(renderAlertMessage([batch({ expirationDate: new Date('2026-05-15T00:00:00Z') })])).toContain('vencido há 5 dias');
    expect(renderAlertMessage([batch({ expirationDate: new Date('2026-05-19T00:00:00Z') })])).toContain('vencido há 1 dia');
    expect(renderAlertMessage([batch({ expirationDate: new Date('2026-05-20T00:00:00Z') })])).toContain('vence hoje');
    expect(renderAlertMessage([batch({ expirationDate: new Date('2026-05-21T00:00:00Z') })])).toContain('vence em 1 dia');
    expect(renderAlertMessage([batch({ expirationDate: new Date('2026-05-25T00:00:00Z') })])).toContain('vence em 5 dias');
  });

  it('cap 20 lotes + sinalização "+N omitidos"', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      batch({ productName: `Prod${i}`, lotNumber: `L${i}` }),
    );
    const msg = renderAlertMessage(many);
    expect(msg).toContain('25 lotes precisam de atenção');
    expect(msg).toContain('+5 lotes omitidos');
    expect(msg).toContain('Prod0');
    // Os primeiros 20 entram, os últimos 5 saem
    expect(msg).not.toContain('Prod24');
  });

  it('lança quando lista vazia (caller deve garantir)', () => {
    expect(() => renderAlertMessage([])).toThrow();
  });
});

describe('renderTestMessage', () => {
  it('contém nome da empresa e marca-d\'água de teste', () => {
    const m = renderTestMessage('Mercadinho Santa Cruz');
    expect(m).toContain('Teste de envio');
    expect(m).toContain('Mercadinho Santa Cruz');
    expect(m).toContain('configurado corretamente');
  });
});
