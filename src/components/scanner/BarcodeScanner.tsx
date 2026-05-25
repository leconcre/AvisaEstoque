'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  inspectEnvironment,
  isValidEAN,
  selectBarcodeStrategy,
  type BarcodeStrategy,
} from '@/lib/scanner/detect';

/**
 * Tipos mínimos do BarcodeDetector — TypeScript não conhece nativamente
 * (ainda não chegou aos lib.dom.d.ts em 2026). Declaramos só o que usamos.
 */
type DetectedBarcode = { rawValue: string; format: string };
interface BarcodeDetectorCtor {
  new (init?: { formats?: string[] }): { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
}

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  /** Disparado uma vez quando um EAN VÁLIDO é lido. Recebe o código. */
  onDetected: (ean: string) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'requesting_permission' }
  | { kind: 'scanning' }
  | { kind: 'transient_error'; message: string }
  | { kind: 'fatal'; message: string };

const SCAN_INTERVAL_MS = 200; // ~5 fps — suficiente pra EAN, gentil com CPU/bateria

export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopFallbackRef = useRef<(() => void) | null>(null); // controls.stop() do zxing
  const intervalRef = useRef<number | null>(null);
  const aliveRef = useRef(true); // false após cleanup; impede setState em componente desmontado

  const [strategy, setStrategy] = useState<BarcodeStrategy>('unavailable');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // -------------------------------------------------------------------------
  // CLEANUP — não-negociável. Toda saída passa por aqui.
  //   - cancela o setInterval do loop nativo
  //   - manda controls.stop() do zxing (se ativo)
  //   - chama track.stop() em CADA track do MediaStream
  //   - desanexa o srcObject pro browser liberar a câmera de fato
  //   - limpa todas refs
  //
  // Cobre: botão fechar, Esc, click fora, sucesso, unmount, mudança de rota.
  // -------------------------------------------------------------------------
  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (stopFallbackRef.current) {
      try { stopFallbackRef.current(); } catch { /* ignora */ }
      stopFallbackRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try { track.stop(); } catch { /* ignora */ }
      }
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // -------------------------------------------------------------------------
  // INIT: chamado quando open vira true. Pede permissão e começa o loop.
  // -------------------------------------------------------------------------
  const start = useCallback(async () => {
    aliveRef.current = true;
    const env = inspectEnvironment();
    const strat = selectBarcodeStrategy(env);
    setStrategy(strat);

    if (strat === 'unavailable') {
      setStatus({
        kind: 'fatal',
        message: env.isSecureContext
          ? 'Câmera indisponível neste navegador.'
          : 'A câmera só funciona em HTTPS. Use o app no domínio em produção (ou um túnel HTTPS para testar localmente).',
      });
      return;
    }

    setStatus({ kind: 'requesting_permission' });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // câmera traseira em celular
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      if (!aliveRef.current) return;
      const name = (err as DOMException)?.name;
      const friendly =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Permissão de câmera negada. Você pode digitar o EAN manualmente, ou liberar a câmera nas configurações do site no seu navegador e tentar de novo.'
          : name === 'NotFoundError'
          ? 'Nenhuma câmera detectada neste dispositivo.'
          : `Não foi possível abrir a câmera (${name ?? 'erro desconhecido'}).`;
      setStatus({ kind: 'fatal', message: friendly });
      return;
    }

    if (!aliveRef.current) {
      // Componente fechou enquanto getUserMedia tava pendente — solta a câmera.
      for (const t of stream.getTracks()) t.stop();
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try { await videoRef.current.play(); } catch { /* alguns browsers exigem interação prévia, mas autoplay+muted normalmente passa */ }
    }

    setStatus({ kind: 'scanning' });

    if (strat === 'native') {
      void runNativeLoop();
    } else {
      void runFallbackLoop();
    }
  }, []);

  /**
   * Loop nativo: BarcodeDetector + setInterval (~5fps). É praticamente zero
   * custo de bundle e usa o decoder do Chrome/Android otimizado.
   */
  const runNativeLoop = useCallback(async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setStatus({ kind: 'fatal', message: 'BarcodeDetector indisponível.' });
      return;
    }
    const detector = new Ctor({ formats: ['ean_13', 'ean_8'] });

    intervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!aliveRef.current || !video || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        for (const c of codes) {
          if (isValidEAN(c.rawValue)) {
            handleDetected(c.rawValue);
            return;
          }
        }
      } catch {
        // Frames inválidos ocasionais — não derruba o loop, mostra hint discreto.
        setStatus((prev) =>
          prev.kind === 'scanning'
            ? { kind: 'transient_error', message: 'Aproxime o código do quadro.' }
            : prev,
        );
        // Volta pra "scanning" depois de um momento.
        window.setTimeout(() => {
          if (aliveRef.current) setStatus({ kind: 'scanning' });
        }, 800);
      }
    }, SCAN_INTERVAL_MS);
  }, []);

  /**
   * Fallback via @zxing/browser. Dynamic import — só roda em navegadores
   * sem BarcodeDetector (iOS Safari, Firefox), evitando ~250KB no bundle
   * de quem tem nativo.
   */
  const runFallbackLoop = useCallback(async () => {
    try {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library'),
      ]);

      if (!aliveRef.current) return;

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
      const reader = new BrowserMultiFormatReader(hints);

      // Anexa decodificação ao <video> que JÁ tem o stream que GUARDAMOS.
      // controls.stop() libera os listeners; nosso cleanup pára os tracks.
      const controls = await reader.decodeFromVideoElement(videoRef.current!, (result, err) => {
        if (!aliveRef.current) return;
        if (result) {
          const text = result.getText();
          if (isValidEAN(text)) {
            handleDetected(text);
          }
        }
        if (err && err.name !== 'NotFoundException') {
          // NotFoundException é normal entre frames sem código visível.
          // Outros erros: hint transitório.
          setStatus((prev) =>
            prev.kind === 'scanning'
              ? { kind: 'transient_error', message: 'Aproxime o código do quadro.' }
              : prev,
          );
          window.setTimeout(() => {
            if (aliveRef.current) setStatus({ kind: 'scanning' });
          }, 800);
        }
      });

      stopFallbackRef.current = () => controls.stop();
    } catch (err) {
      if (!aliveRef.current) return;
      setStatus({
        kind: 'fatal',
        message: `Falha ao carregar o leitor de fallback (${err instanceof Error ? err.message : 'desconhecido'}).`,
      });
    }
  }, []);

  function handleDetected(ean: string) {
    if (!aliveRef.current) return;
    // Para o loop ANTES de fechar pra evitar callbacks duplicados.
    cleanup();
    onDetected(ean);
    onClose();
  }

  // Lifecycle: open → start; close/unmount → cleanup.
  useEffect(() => {
    if (open) {
      void start();
      return () => {
        aliveRef.current = false;
        cleanup();
      };
    }
    return undefined;
  }, [open, start, cleanup]);

  // Pausar quando a aba some — o browser solta a câmera de qualquer jeito,
  // mas tornar explícito evita aviso "luz da câmera continua acesa".
  useEffect(() => {
    if (!open) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        cleanup();
        // Quando voltar, o usuário clica em "Tentar de novo" — não retomamos
        // automático pra evitar surpresa de câmera abrindo do nada.
        setStatus({ kind: 'fatal', message: 'Você saiu da aba — a câmera foi liberada. Toque em "Tentar de novo" para retomar.' });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [open, cleanup]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear código de barras"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[oklch(0_0_0/0.78)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-lg bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[var(--brand-fg)]" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-fg">Escanear EAN</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar scanner"
            className="rounded-md p-1.5 text-muted hover:bg-background hover:text-fg-2"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="relative aspect-[4/3] w-full bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          {/* Frame guia */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-4/5 rounded-md border-2 border-white/70 shadow-[0_0_0_2000px_oklch(0_0_0/0.35)]" />
          </div>
          {/* Status overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 text-center">
            {status.kind === 'requesting_permission' && (
              <p className="inline-block rounded-md bg-[oklch(0_0_0/0.6)] px-2.5 py-1 text-xs text-white">
                Liberando câmera…
              </p>
            )}
            {status.kind === 'scanning' && (
              <p className="inline-block rounded-md bg-[oklch(0_0_0/0.6)] px-2.5 py-1 text-xs text-white">
                Aponte o código para o quadro
              </p>
            )}
            {status.kind === 'transient_error' && (
              <p className="inline-block rounded-md bg-[var(--warn-soft)] px-2.5 py-1 text-xs text-[oklch(0.45_0.17_75)]">
                {status.message}
              </p>
            )}
          </div>
        </div>

        {status.kind === 'fatal' && (
          <div className="border-t border-border bg-[var(--crit-soft)] px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--crit)]" strokeWidth={1.75} />
              <p className="text-xs text-[var(--crit)]">{status.message}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  cleanup();
                  void start();
                }}
                icon={<RotateCw className="h-3.5 w-3.5" />}
              >
                Tentar de novo
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Digitar manualmente
              </Button>
            </div>
          </div>
        )}

        <footer className="border-t border-border px-4 py-2 text-center">
          <p className="text-[11px] text-muted">
            Estratégia: <span className="font-mono">{strategy}</span>
            {' · '}
            Pressione <kbd className="rounded bg-background px-1 font-mono text-[10px] border border-border">Esc</kbd> para fechar
          </p>
        </footer>
      </div>
    </div>
  );
}
