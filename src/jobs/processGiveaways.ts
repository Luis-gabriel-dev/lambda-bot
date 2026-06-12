import { Client } from 'discord.js';
import { giveawayRepository } from '../repositories/giveaway.repository';
import { endGiveaway } from '../services/giveaway.service';
import { logger } from '../core/logger';

const CHECK_INTERVAL_MS = 60 * 1000; // checa a cada 1 minuto

async function runGiveaways(client: Client): Promise<void> {
  for (const giveaway of await giveawayRepository.dueGiveaways(new Date())) {
    const winners = await endGiveaway(client, giveaway);
    logger.info(`Sorteio encerrado: "${giveaway.prize}" (${winners.length} vencedor(es)).`);
  }
}

/** Agenda o encerramento de sorteios: roda ao iniciar e a cada 1 minuto. */
export function scheduleGiveaways(client: Client): void {
  void runGiveaways(client).catch((err) => logger.error('Erro no job de sorteios:', err));
  setInterval(() => void runGiveaways(client).catch((err) => logger.error('Erro no job de sorteios:', err)), CHECK_INTERVAL_MS);
}
