'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, AlertTriangle, Clock, XCircle, Info, Send } from 'lucide-react';

import type { NotificationPayload, ExpirationDigestPayload } from '@/lib/notifications/types';

type NotificationItem = {
  id: string;
  type: 'EXPIRATION_DIGEST' | 'SYSTEM' | 'TEST';
  payload: NotificationPayload;
  readAt: string | null;
  createdAt: string;
  dedupKey: string;
};

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Polling leve a cada 60s — sem websocket no MVP, é o suficiente pro sino. */
const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const body = (await res.json()) as { unreadCount: number; data: NotificationItem[] };
      setUnreadCount(body.unreadCount);
      setItems(body.data);
    } catch {
      // Silencioso — o sino não deve quebrar a UI por erro de rede.
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // Fecha o popover ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markOneRead(id: string) {
    // Otimismo: atualiza local antes do server confirmar.
    setItems((prev) => prev.map((it) => (it.id === id && !it.readAt ? { ...it, readAt: new Date().toISOString() } : it)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      await fetchData();
    } finally {
      setLoading(false);
    }
  }

  const hasUnread = unreadCount > 0;

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={hasUnread ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-background hover:text-fg-2 focus-visible:outline-none"
      >
        {hasUnread ? <BellRing className="h-5 w-5" strokeWidth={1.75} /> : <Bell className="h-5 w-5" strokeWidth={1.75} />}
        {hasUnread && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--crit)] px-1 font-mono text-[10px] font-semibold text-white"
            style={{ boxShadow: '0 0 0 2px var(--surface)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Painel de notificações"
          className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-fg">Notificações</p>
              {hasUnread && <p className="text-xs text-muted">{unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}</p>}
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!hasUnread || loading}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-background enabled:hover:text-fg-2"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          </header>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">
                Sem notificações por enquanto.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => (
                  <NotificationRow
                    key={it.id}
                    item={it}
                    onClick={() => {
                      if (!it.readAt) void markOneRead(it.id);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const isUnread = item.readAt === null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'block w-full px-4 py-3 text-left transition-colors',
          isUnread ? 'bg-[var(--brand-soft)]/40 hover:bg-[var(--brand-soft)]' : 'hover:bg-background',
        ].join(' ')}
      >
        <RenderRow item={item} />
        <p className="mt-1 font-mono text-[10px] text-muted-2">
          {dateTimeFmt.format(new Date(item.createdAt))}
        </p>
      </button>
    </li>
  );
}

function RenderRow({ item }: { item: NotificationItem }) {
  switch (item.payload.kind) {
    case 'expiration_digest':
      return <DigestRow payload={item.payload} isUnread={item.readAt === null} />;
    case 'system': {
      const p = item.payload;
      return (
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{p.title}</p>
            <p className="mt-0.5 text-xs text-muted">{p.body}</p>
            {p.href && (
              <Link href={p.href} className="mt-1 inline-block text-xs font-medium text-[var(--brand-fg)] hover:underline">
                Abrir
              </Link>
            )}
          </div>
        </div>
      );
    }
    case 'test':
      return (
        <div className="flex items-start gap-2.5">
          <Send className="mt-0.5 h-4 w-4 shrink-0 text-[var(--safe)]" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-fg">Teste de notificação</p>
            <p className="mt-0.5 text-xs text-muted">
              Disparado por <span className="text-fg-2">{item.payload.triggeredBy}</span>. O canal in-app está funcionando ✓
            </p>
          </div>
        </div>
      );
  }
}

function DigestRow({ payload, isUnread }: { payload: ExpirationDigestPayload; isUnread: boolean }) {
  const counts = countDigest(payload);
  const total = payload.batches.length;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--crit-soft)]">
        <AlertTriangle className="h-4 w-4 text-[var(--crit)]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">
          {isUnread ? '🔔 ' : ''}
          {total} {total === 1 ? 'lote precisa' : 'lotes precisam'} de atenção
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          {counts.expired > 0 && <Pill icon={<XCircle className="h-3 w-3" />} label={`${counts.expired} vencido${counts.expired === 1 ? '' : 's'}`} tone="expired" />}
          {counts.critical > 0 && <Pill icon={<AlertTriangle className="h-3 w-3" />} label={`${counts.critical} crítico${counts.critical === 1 ? '' : 's'}`} tone="critical" />}
          {counts.warning > 0 && <Pill icon={<Clock className="h-3 w-3" />} label={`${counts.warning} em atenção`} tone="warning" />}
        </div>
        <Link href="/batches" className="mt-1.5 inline-block text-xs font-medium text-[var(--brand-fg)] hover:underline">
          Ver lotes →
        </Link>
      </div>
    </div>
  );
}

function Pill({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: 'expired' | 'critical' | 'warning' }) {
  const cls =
    tone === 'expired'
      ? 'bg-[var(--exp-soft)] text-[var(--muted)] border-[var(--exp-border)]'
      : tone === 'critical'
      ? 'bg-[var(--crit-soft)] text-[var(--crit)] border-[var(--crit-border)]'
      : 'bg-[var(--warn-soft)] text-[oklch(0.45_0.17_75)] border-[var(--warn-border)]';
  return (
    <span className={['inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5', cls].join(' ')}>
      {icon}
      {label}
    </span>
  );
}

function countDigest(p: ExpirationDigestPayload) {
  let critical = 0, warning = 0, expired = 0;
  for (const b of p.batches) {
    if (b.status === 'CRITICAL') critical += 1;
    else if (b.status === 'WARNING') warning += 1;
    else if (b.status === 'EXPIRED') expired += 1;
  }
  return { critical, warning, expired };
}
