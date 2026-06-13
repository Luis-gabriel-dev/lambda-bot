import { Client } from 'discord.js';
import { economyRepository } from '../repositories/economy.repository';
import { postDrop } from '../services/economy.service';
import { logger } from '../core/logger';

const CHECK_INTERVAL_MS = 60 * 1000; // checa a cada 1 minuto

async function runDrops(client: Client): Promise<void> {
  const now = Date.now();

  for (const config of await economyRepository.getActiveConfigs()) {
    if (!config.dropIntervalMinutes) continue;
    const intervalMs = config.dropIntervalMinutes * 60 * 1000;
    const last = config.lastDropAt?.getTime() ?? 0;
    if (now - last >= intervalMs) {
      await postDrop(client, config);
    }
  }
}

/** Agenda os drops de economia: roda ao iniciar e a cada 1 minuto. */
export function scheduleEconomyDrops(client: Client): void {
  void runDrops(client).catch((err) => logger.error('Erro no job de economia:', err));
  setInterval(() => void runDrops(client).catch((err) => logger.error('Erro no job de economia:', err)), CHECK_INTERVAL_MS);
}
