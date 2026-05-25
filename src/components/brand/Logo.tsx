'use client';

import { useId } from 'react';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  withTagline?: boolean;
  /** Usar APENAS no login (HANDOFF §2). Em sidebar/topbar/etc deixar estático. */
  animated?: boolean;
}

/**
 * Marca AvisaEstoque — calendário com pulso de batimento.
 * Gera IDs únicos via useId (HANDOFF §4.15: múltiplas instâncias na mesma página
 * com IDs colidentes quebram os gradientes na segunda renderização).
 */
export function Logo({
  size = 28,
  withWordmark = false,
  withTagline = false,
  animated = false,
}: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `ae-bg-${uid}`;
  const hlId = `ae-hl-${uid}`;

  return (
    <div className="inline-flex items-center gap-2.5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 96 96"
        width={size}
        height={size}
        role="img"
        aria-label="AvisaEstoque"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#18A55F" />
            <stop offset="1" stopColor="#0B6B3E" />
          </linearGradient>
          <linearGradient id={hlId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z"
          fill={`url(#${bgId})`}
        />
        <path
          d="M48,2 C28,2 2,28 2,48 C2,68 28,94 48,94 C68,94 94,68 94,48 C94,28 68,2 48,2 Z"
          fill={`url(#${hlId})`}
        />
        <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="26" y="30" width="44" height="40" rx="7" />
          <path d="M 26 43 L 70 43" />
          <path d="M 37 24 L 37 33" />
          <path d="M 59 24 L 59 33" />
          <path
            d="M 33 58 L 41 58 L 45 50 L 51 64 L 55 58 L 63 58"
            strokeWidth="5"
            className={animated ? 'ae-heartbeat' : undefined}
          />
        </g>
      </svg>
      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className="font-semibold tracking-tight text-fg"
            style={{ fontSize: Math.round(size * 0.62) }}
          >
            AvisaEstoque
          </span>
          {withTagline && (
            <span
              className="mt-1 text-muted"
              style={{ fontSize: Math.round(size * 0.4) }}
            >
              Alertas de validade para PMEs
            </span>
          )}
        </div>
      )}
    </div>
  );
}
