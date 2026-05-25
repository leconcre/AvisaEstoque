/**
 * Detecção de capacidade de leitura de código de barras no navegador.
 *
 * Três estados possíveis:
 *   - "native"      → window.BarcodeDetector existe (Chrome / Edge / Samsung
 *                     Internet em Android moderno; opcional em Chrome desktop).
 *                     Caminho preferido: zero JS extra no bundle.
 *   - "fallback"    → BarcodeDetector ausente MAS getUserMedia disponível
 *                     (iOS Safari, Firefox). Carregamos @zxing/browser via
 *                     dynamic import.
 *   - "unavailable" → sem getUserMedia (HTTP em mobile, navegador antigo,
 *                     iframe sem allow="camera"). Botão "Escanear" fica oculto.
 *
 * Este módulo é PURO TS — sem efeitos colaterais — pra que possa ser testado
 * com Vitest mockando o `window`. NÃO importar @zxing aqui.
 */

export type BarcodeStrategy = 'native' | 'fallback' | 'unavailable';

interface DetectionEnvironment {
  hasBarcodeDetector: boolean;
  hasGetUserMedia: boolean;
  isSecureContext: boolean;
}

/**
 * Inspeção do ambiente atual. Em SSR (window === undefined) retorna tudo false
 * — o componente que usa isso é "use client", então em produção sempre roda
 * com window definido.
 */
export function inspectEnvironment(win: Window | undefined = typeof window !== 'undefined' ? window : undefined): DetectionEnvironment {
  if (!win) {
    return { hasBarcodeDetector: false, hasGetUserMedia: false, isSecureContext: false };
  }
  return {
    hasBarcodeDetector: typeof (win as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === 'function',
    hasGetUserMedia:
      typeof win.navigator !== 'undefined' &&
      typeof win.navigator.mediaDevices !== 'undefined' &&
      typeof win.navigator.mediaDevices.getUserMedia === 'function',
    // getUserMedia exige Secure Context. Chrome aceita localhost por exceção
    // (e expõe isSecureContext=true nesse caso).
    isSecureContext: Boolean((win as unknown as { isSecureContext?: boolean }).isSecureContext),
  };
}

export function selectBarcodeStrategy(env?: DetectionEnvironment): BarcodeStrategy {
  const e = env ?? inspectEnvironment();

  // Sem getUserMedia OU contexto inseguro → não há como abrir a câmera.
  if (!e.hasGetUserMedia || !e.isSecureContext) return 'unavailable';

  return e.hasBarcodeDetector ? 'native' : 'fallback';
}

/**
 * Valida EAN-13 / EAN-8 pelo dígito verificador.
 *
 * Por que validar do lado do cliente: leitores ruins (luz fraca, embalagem
 * amassada) ocasionalmente devolvem 12 dígitos com um errado. O checksum
 * pega ~99% dessas leituras, evitando preencher o input com lixo e disparar
 * autocomplete vazio.
 *
 * Algoritmo padrão GS1:
 *   - Soma dos dígitos em posições ímpares (1-indexed, da direita pra esquerda)
 *     multiplicada por 3, somada aos dígitos em posições pares.
 *   - O total deve ser múltiplo de 10.
 */
export function isValidEAN(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;

  const digits = code.split('').map((d) => Number.parseInt(d, 10));
  const checkDigit = digits[digits.length - 1]!;
  const body = digits.slice(0, -1);

  // Da direita pra esquerda, alternando peso 3 e 1.
  // Em EAN-13 (12 dígitos no body): direita→esquerda, primeiro ×3, depois ×1, ...
  // Em EAN-8  (7 dígitos no body): mesma lógica.
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - 1 - i;
    const weight = fromRight % 2 === 0 ? 3 : 1;
    sum += body[i]! * weight;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === checkDigit;
}
