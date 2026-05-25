import { logger } from '@/lib/logger';
import { MockAssistantProvider } from './providers/mock';
import { AnthropicAssistantProvider } from './providers/anthropic';
import { OllamaAssistantProvider } from './providers/ollama';
import type { AssistantProvider } from './provider';

/**
 * Resolução do provider por env ASSISTANT_PROVIDER:
 *   - "mock"      (default) → MockAssistantProvider, ativo no MVP
 *   - "anthropic"           → STUB, exige ANTHROPIC_API_KEY (lança se faltar)
 *   - "ollama"              → STUB, exige OLLAMA_BASE_URL e OLLAMA_MODEL
 *
 * Lazy + cache: instanciamos uma vez por processo.
 */

let cached: AssistantProvider | undefined;

export function getAssistantProvider(): AssistantProvider {
  if (cached) return cached;

  const choice = (process.env.ASSISTANT_PROVIDER ?? 'mock').toLowerCase();

  if (choice === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ASSISTANT_PROVIDER=anthropic exige ANTHROPIC_API_KEY no env.');
    }
    cached = new AnthropicAssistantProvider(key);
    logger.info({ provider: 'anthropic' }, 'AssistantProvider iniciado');
    return cached;
  }

  if (choice === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;
    if (!baseUrl || !model) {
      throw new Error('ASSISTANT_PROVIDER=ollama exige OLLAMA_BASE_URL e OLLAMA_MODEL no env.');
    }
    cached = new OllamaAssistantProvider({ baseUrl, model });
    logger.info({ provider: 'ollama', model }, 'AssistantProvider iniciado');
    return cached;
  }

  cached = new MockAssistantProvider();
  logger.info({ provider: 'mock' }, 'AssistantProvider iniciado (mock — sem LLM)');
  return cached;
}

/** Apenas pra teste. */
export function __resetAssistantProviderForTests() {
  cached = undefined;
}

export type { AssistantProvider, AssistantContext, AssistantResponse, AssistantToolCall } from './provider';
