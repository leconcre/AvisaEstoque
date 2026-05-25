import { logger } from '@/lib/logger';
import { InAppChannel } from './channels/in-app';
import type { NotificationChannel } from './channel';

/**
 * Registry de canais ativos POR PLANO da empresa.
 *
 * ESTADO ATUAL (MVP): in-app é o único canal ativo para TODOS os planos.
 * O canal WhatsApp/Evolution foi desativado (vide channels/_disabled/evolution.ts);
 * Company.plan continua existindo para diferenciação futura via assistente de IA.
 *
 * COMO REATIVAR O CANAL WHATSAPP:
 *   1. Mover channels/_disabled/evolution.ts de volta para channels/evolution.ts
 *      (ajustar imports relativos: ../../channel → ../channel, etc.)
 *   2. Aqui no registry, descomentar o bloco "PREMIUM (RECUPERÁVEL)" abaixo.
 *   3. Configurar EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE
 *      no ambiente.
 *
 * O motor de alertas (check-expirations) chama getChannelsForCompany(plan) e
 * despacha pra todos os retornados. A assinatura aceita plan por design — o
 * código de chamada NÃO precisa mudar quando o premium voltar.
 */

export type CompanyPlan = 'BASIC' | 'PRO';

let warnedNoPremium = false;

export function getChannelsForCompany(_plan: CompanyPlan = 'BASIC'): NotificationChannel[] {
  // Sempre in-app — único canal ativo no MVP.
  const channels: NotificationChannel[] = [new InAppChannel()];

  // -------------------------------------------------------------------------
  // PREMIUM (RECUPERÁVEL — descomente este bloco para reativar WhatsApp).
  // -------------------------------------------------------------------------
  // if (_plan === 'PRO') {
  //   const premium = getPremiumChannel();
  //   if (premium) channels.push(premium);
  // }
  // -------------------------------------------------------------------------

  return channels;
}

/**
 * Aviso único no log se alguém pedir o canal premium estando desligado.
 * Mantém a assinatura pra endpoints existentes que ainda chamam — todos eles
 * agora caem no fluxo "canal indisponível" sem quebrar boot.
 */
export function getPremiumChannelOrNull(): NotificationChannel | null {
  if (!warnedNoPremium) {
    logger.info(
      { event: 'channel.premium.disabled' },
      'canal premium (WhatsApp) está desativado no MVP — todos os pedidos retornam null',
    );
    warnedNoPremium = true;
  }
  return null;
}

/** Apenas pra teste — limpa estado entre cases. */
export function __resetChannelRegistryForTests() {
  warnedNoPremium = false;
}
