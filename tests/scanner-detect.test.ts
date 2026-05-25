import { describe, it, expect } from 'vitest';

import { selectBarcodeStrategy, isValidEAN } from '@/lib/scanner/detect';

describe('selectBarcodeStrategy', () => {
  it('retorna unavailable sem getUserMedia', () => {
    expect(
      selectBarcodeStrategy({
        hasBarcodeDetector: true,
        hasGetUserMedia: false,
        isSecureContext: true,
      }),
    ).toBe('unavailable');
  });

  it('retorna unavailable sem secure context (HTTP em mobile)', () => {
    expect(
      selectBarcodeStrategy({
        hasBarcodeDetector: true,
        hasGetUserMedia: true,
        isSecureContext: false,
      }),
    ).toBe('unavailable');
  });

  it('preferência: nativo quando disponível', () => {
    expect(
      selectBarcodeStrategy({
        hasBarcodeDetector: true,
        hasGetUserMedia: true,
        isSecureContext: true,
      }),
    ).toBe('native');
  });

  it('fallback zxing quando só getUserMedia existe', () => {
    expect(
      selectBarcodeStrategy({
        hasBarcodeDetector: false,
        hasGetUserMedia: true,
        isSecureContext: true,
      }),
    ).toBe('fallback');
  });
});

describe('isValidEAN — checksum GS1', () => {
  it('aceita EAN-13 com checksum correto', () => {
    // Códigos do seed que passam no checksum GS1 (verificado manualmente):
    expect(isValidEAN('7891000100103')).toBe(true);
    expect(isValidEAN('7891000244401')).toBe(true);
    expect(isValidEAN('7891025108405')).toBe(true);
    expect(isValidEAN('7891150030909')).toBe(true);
    // EAN-13 conhecido (Faber-Castell):
    expect(isValidEAN('4006381333931')).toBe(true);
  });

  it('aceita EAN-8 válidos', () => {
    expect(isValidEAN('40170725')).toBe(true);
    expect(isValidEAN('73127727')).toBe(true);
  });

  it('rejeita códigos de tamanho errado', () => {
    expect(isValidEAN('')).toBe(false);
    expect(isValidEAN('123')).toBe(false);
    expect(isValidEAN('123456789012')).toBe(false); // 12 dígitos = UPC, não suportado
    expect(isValidEAN('12345678901234')).toBe(false); // 14
  });

  it('rejeita não-numérico', () => {
    expect(isValidEAN('789100010010X')).toBe(false);
    expect(isValidEAN('7891-000-1001')).toBe(false);
  });

  it('rejeita checksum incorreto (último dígito trocado)', () => {
    // 7891000100103 é válido → trocando o último por 4 quebra o checksum.
    expect(isValidEAN('7891000100104')).toBe(false);
    expect(isValidEAN('7891000100100')).toBe(false);
  });

  it('rejeita checksum incorreto (dígito do meio trocado)', () => {
    // Trocar um dígito no meio do corpo também invalida o checksum.
    expect(isValidEAN('7891000200103')).toBe(false);
  });
});
