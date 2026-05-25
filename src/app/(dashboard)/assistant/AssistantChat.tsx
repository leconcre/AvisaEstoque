'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Sparkles, Send, AlertCircle, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/Button';

type ToolCall = { name: string; args: unknown; result: unknown };

type ChatMessage =
  | { role: 'user'; id: string; text: string }
  | { role: 'assistant'; id: string; text: string; toolCalls: ToolCall[]; unanswered?: boolean; error?: boolean };

type Usage = {
  used: number;
  limit: number;
  remaining: number;
  plan: 'BASIC' | 'PRO';
};

const SUGGESTIONS = [
  'O que vence essa semana?',
  'Quanto tenho de iogurte?',
  'Quantos lotes críticos?',
  'Qual lote está parado há mais tempo?',
];

export function AssistantChat({ initialUsage }: { initialUsage: Usage | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, startTransition] = useTransition();
  const [usage, setUsage] = useState<Usage | null>(initialUsage);
  const [showToolDetails, setShowToolDetails] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Scroll automático pra última mensagem.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      const userMsg: ChatMessage = { role: 'user', id: `u_${Date.now()}`, text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      startTransition(async () => {
        try {
          const res = await fetch('/api/assistant/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed }),
          });
          const body = (await res.json()) as
            | { reply: string; toolCalls: ToolCall[]; unanswered: boolean; usage: Usage }
            | { error: { code: string; message: string } };

          if ('error' in body) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                id: `a_${Date.now()}`,
                text: body.error.message,
                toolCalls: [],
                error: true,
              },
            ]);
            return;
          }

          setUsage(body.usage);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              id: `a_${Date.now()}`,
              text: body.reply,
              toolCalls: body.toolCalls,
              unanswered: body.unanswered,
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              id: `a_${Date.now()}`,
              text:
                e instanceof Error
                  ? `Falha de rede: ${e.message}`
                  : 'Falha de rede inesperada.',
              toolCalls: [],
              error: true,
            },
          ]);
        }
      });
    },
    [pending],
  );

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia, Shift+Enter quebra linha.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const quotaExceeded = usage !== null && usage.remaining <= 0;

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col gap-4 lg:h-[calc(100vh-180px)]">
      {/* Lista de mensagens */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-sm">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-soft)]">
              <Sparkles className="h-6 w-6 text-[var(--brand-fg)]" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-fg">Pergunte sobre seu estoque</h2>
            <p className="mt-1 max-w-md text-sm text-muted">
              Eu respondo com base nos seus lotes cadastrados — não chuto números.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={quotaExceeded}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-fg-2 hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={[
                    'max-w-[85%] rounded-lg px-3.5 py-2.5',
                    m.role === 'user'
                      ? 'bg-[var(--brand-soft)] text-fg'
                      : m.role === 'assistant' && m.error
                      ? 'bg-[var(--crit-soft)] text-[var(--crit)]'
                      : 'bg-background text-fg',
                  ].join(' ')}
                >
                  {m.role === 'assistant' && m.error && (
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider">
                      <AlertCircle className="h-3 w-3" /> Erro
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {renderMarkdownLite(m.text)}
                  </div>
                  {m.role === 'assistant' && m.toolCalls.length > 0 && (
                    <div className="mt-2 border-t border-border/50 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setShowToolDetails((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                        }
                        className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted hover:text-fg-2"
                      >
                        <Wrench className="h-3 w-3" />
                        {m.toolCalls.length} {m.toolCalls.length === 1 ? 'consulta' : 'consultas'} ao estoque
                      </button>
                      {showToolDetails[m.id] && (
                        <ul className="mt-1.5 space-y-0.5">
                          {m.toolCalls.map((tc, i) => (
                            <li key={i} className="font-mono text-[10px] text-muted-2">
                              ↳ {tc.name}({JSON.stringify(tc.args)})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {pending && (
              <li className="flex justify-start">
                <div className="rounded-lg bg-background px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: '180ms' }} />
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: '360ms' }} />
                  </div>
                </div>
              </li>
            )}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {/* Input + quota */}
      <div className="space-y-2">
        {usage && (
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              Plano <span className="font-medium text-fg-2">{usage.plan}</span> — limite diário <span className="font-mono">{usage.limit}</span> {usage.limit === 1 ? 'pergunta' : 'perguntas'}
            </span>
            <span className={usage.remaining <= 3 ? 'text-[var(--warn)]' : ''}>
              <span className="font-mono">{usage.remaining}</span> {usage.remaining === 1 ? 'restante' : 'restantes'} hoje
            </span>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg border border-border bg-surface p-2 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={quotaExceeded || pending}
            rows={1}
            placeholder={quotaExceeded ? 'Limite diário atingido — volte amanhã.' : 'Pergunte sobre seu estoque...'}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-2 disabled:cursor-not-allowed"
            maxLength={500}
          />
          <Button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || pending || quotaExceeded}
            loading={pending}
            size="sm"
            icon={<Send className="h-3.5 w-3.5" />}
          >
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renderiza markdown leve: *negrito* + quebras de linha. Sem libs externas
 * — o output do Mock é controlado e usa só asteriscos pra ênfase.
 * Quando o LLM real entrar, vale considerar uma lib (react-markdown sanitizado),
 * mas pra MVP isso basta.
 */
function renderMarkdownLite(text: string): React.ReactNode {
  // Quebra por **bold** (asteriscos pareados) e renderiza <strong>.
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}
