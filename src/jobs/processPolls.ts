import { Client } from 'discord.js';
import { pollRepository } from '../repositories/poll.repository';
import { closePoll, deletePoll } from '../services/poll.service';
import { logger } from '../core/logger';

const CHECK_INTERVAL_MS = 60 * 1000; // checa a cada 1 minuto

async function runPolls(client: Client): Promise<void> {
  const now = new Date();

  for (const poll of await pollRepository.dueCloses(now)) {
    await closePoll(client, poll);
    logger.info(`Enquete encerrada automaticamente: "${poll.question}".`);
  }

  for (const poll of await pollRepository.dueDeletes(now)) {
    await deletePoll(client, poll);
  }
}

/** Agenda o auto-encerramento e auto-exclusão de enquetes: roda ao iniciar e a cada 1 minuto. */
export function schedulePolls(client: Client): void {
  void runPolls(client).catch((err) => logger.error('Erro no job de enquetes:', err));
  setInterval(() => void runPolls(client).catch((err) => logger.error('Erro no job de enquetes:', err)), CHECK_INTERVAL_MS);
}
