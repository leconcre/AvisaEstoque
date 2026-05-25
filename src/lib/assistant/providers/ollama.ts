import type { AssistantContext, AssistantProvider, AssistantResponse } from '../provider';

/**
 * OllamaAssistantProvider — STUB. NÃO ATIVADO no MVP.
 *
 * Esqueleto pra LLM local via Ollama (https://ollama.com). Útil quando o
 * cliente exigir "tudo on-prem" (sem dado de estoque saindo da empresa).
 *
 * Ollama expõe API compatível com OpenAI em http://localhost:11434/v1.
 * Modelos com tool calling bom em pt-BR e <8B params:
 *   - llama3.1:8b-instruct (recomendado)
 *   - qwen2.5:7b-instruct
 *
 * Para ATIVAR:
 *   1. Subir Ollama (docker ou nativo) e dar `ollama pull llama3.1:8b-instruct`
 *   2. Setar OLLAMA_BASE_URL=http://localhost:11434 (ou o host do container)
 *   3. Setar OLLAMA_MODEL=llama3.1:8b-instruct
 *   4. Setar ASSISTANT_PROVIDER=ollama
 *
 * Tool calling em modelos open-source 7B é inconsistente — em produção
 * provavelmente vale combinar: Mock como roteador de 1ª linha, Ollama
 * só pra perguntas que o Mock não cobre. Mas isso é melhoria pós-MVP.
 */
export class OllamaAssistantProvider implements AssistantProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: { baseUrl: string; model: string }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
  }

  async ask(ctx: AssistantContext, message: string): Promise<AssistantResponse> {
    void ctx;
    void message;
    void this.baseUrl;
    void this.model;

    // ============================================================
    // TODO: ligar API real do Ollama (HTTP compatível com OpenAI).
    //
    // Implementação esperada:
    //
    //   const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       model: this.model,
    //       messages: [
    //         { role: 'system', content: SYSTEM_PROMPT(ctx.companyName) },
    //         { role: 'user', content: message },
    //       ],
    //       tools: TOOL_SCHEMAS_OPENAI_FORMAT,
    //       tool_choice: 'auto',
    //       stream: false,
    //     }),
    //   });
    //   // Resto: loop tool_calls/tool_results + executeTool(companyId, ...)
    //   // Mesmo executor tenant-safe que o provider Anthropic usa.
    // ============================================================

    throw new Error(
      'OllamaAssistantProvider não está ativado neste build. ' +
        'Vide src/lib/assistant/providers/ollama.ts (TODO).',
    );
  }
}
