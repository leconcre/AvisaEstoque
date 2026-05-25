// =============================================================================
// CANAL DESATIVADO NO MVP — fora do caminho de execução.
// =============================================================================
// O MVP opera somente com notificação in-app. Este código está preservado
// (recuperável quando o produto for monetizar WhatsApp como premium real),
// mas NÃO é importado por nenhum caminho quente do app:
//   - src/lib/notifications/registry.ts NÃO referencia este arquivo.
//   - Nenhum endpoint importa EvolutionChannel.
//   - As envs EVOLUTION_API_URL/KEY/INSTANCE são opcionais.
//
// Para REATIVAR:
//   1. Mover este arquivo de volta para channels/evolution.ts
//   2. Adicionar { EvolutionChannel } ao import de registry.ts
//   3. No registry, voltar a empurrar premium quando plan === 'PRO'
//   4. Restaurar os testes do canal (describe.skip → describe)
//   5. Configurar EVOLUTION_API_URL/KEY/INSTANCE no .env
//
// Imports preservados pra não quebrar quando reativar — TypeScript não compila
// arquivos não referenciados a partir do `src/app/`, então isso não pesa no bundle.
// =============================================================================

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { EvolutionApiProvider } from '@/lib/whatsapp/evolution';
import { renderAlertMessage, renderTestMessage, type AlertBatchInput } from '@/lib/whatsapp/templates';

import type {
  NotificationChannel,
  ChannelSendArgs,
  ChannelSendResult,
} from '../../channel';
import type { NotificationPayload, ExpirationDigestPayload } from '../../types';

/**
 * EvolutionChannel — adapta o payload estruturado para a Evolution API.
 *
 * Diferença vs. InAppChannel:
 *   - Precisa do número da empresa (busca no banco).
 *   - Renderiza o payload em texto via renderAlertMessage / renderTestMessage.
 *   - Tem timeout/retry tratados na camada de provider (vide evolution.ts);
 *     este canal NÃO faz retry adicional — quem orquestra retry é o motor de
 *     alertas, e isso só faz sentido pra canais transacionais (não in-app).
 *
 * dedupKey é repassado como clientMessageId — Evolution pode honrar pra dedup,
 * mas mesmo que ignore o lock PENDING-first acima já previne duplo envio.
 */
export class EvolutionChannel implements NotificationChannel {
  readonly name = 'evolution';
  readonly kind = 'whatsapp' as const;

  private readonly provider: EvolutionApiProvider;

  constructor(config: { baseUrl: string; apiKey: string; instance: string }) {
    this.provider = new EvolutionApiProvider(config);
  }

  async send(args: ChannelSendArgs): Promise<ChannelSendResult> {
    const company = await prisma.company.findFirst({
      where: { id: args.companyId },
      select: { name: true, whatsappPhone: true, alertEnabled: true },
    });
    if (!company) {
      return { success: false, error: 'COMPANY_NOT_FOUND', errorCode: 'COMPANY_NOT_FOUND' };
    }
    if (!company.alertEnabled) {
      logger.info({ event: 'notif.whatsapp.skip', companyId: args.companyId, reason: 'alerts_disabled' }, 'WhatsApp pulado: alerts desativados');
      return { success: false, error: 'ALERTS_DISABLED', errorCode: 'ALERTS_DISABLED' };
    }
    if (!company.whatsappPhone) {
      return { success: false, error: 'NO_PHONE', errorCode: 'NO_PHONE' };
    }

    const message = renderForWhatsApp(args.payload, company.name);
    if (!message) {
      return { success: false, error: 'PAYLOAD_NOT_RENDERABLE', errorCode: 'PAYLOAD_NOT_RENDERABLE' };
    }

    // clientMessageId estável por (company, dedupKey) — provider pode dedup.
    const clientMessageId = createHash('sha1')
      .update(`${args.companyId}|${args.dedupKey}`)
      .digest('hex')
      .slice(0, 24);

    const result = await this.provider.send({
      to: company.whatsappPhone,
      message,
      clientMessageId,
    });

    if (result.success) {
      return { success: true, messageId: result.messageId };
    }
    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode,
      timeoutAmbiguous: result.timeoutAmbiguous,
    };
  }
}

function renderForWhatsApp(payload: NotificationPayload, companyName: string): string | null {
  switch (payload.kind) {
    case 'expiration_digest':
      if (payload.batches.length === 0) return null;
      return renderAlertMessage(toAlertInputs(payload));
    case 'test':
      return renderTestMessage(companyName);
    case 'system':
      return `${payload.title}\n\n${payload.body}`;
  }
}

function toAlertInputs(p: ExpirationDigestPayload): AlertBatchInput[] {
  return p.batches.map((b) => ({
    productName: b.productName,
    lotNumber: b.lotNumber,
    quantity: b.quantity,
    expirationDate: new Date(`${b.expirationDate}T00:00:00Z`),
    status: b.status,
  }));
}
