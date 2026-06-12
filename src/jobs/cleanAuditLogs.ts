import { Client } from 'discord.js';
import { logChannelRepository } from '../repositories/logChannel.repository';
import { currentHourBucket, messageActivityRepository } from '../repositories/messageActivity.repository';
import { logger } from '../core/logger';

const RETENTION_MS = 10 * 24 * 60 * 60 * 1000; // 10 dias
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_RETENTION_HOURS = 31 * 24; // mantém ~31 dias de atividade de mensagens

/** Apaga, em cada canal de auditoria, os arquivos com mais de 10 dias. */
async function runCleanup(client: Client): Promise<void> {
  const now = Date.now();

  // Limpa atividade de mensagens antiga (global).
  const removedActivity = await messageActivityRepository.pruneOlderThan(currentHourBucket() - ACTIVITY_RETENTION_HOURS);
  if (removedActivity > 0) logger.info(`Atividade: ${removedActivity} bucket(s) antigos removidos.`);

  for (const guild of client.guilds.cache.values()) {
    const channelId = await logChannelRepository.getChannelId(guild.id, 'audit');
    if (!channelId) continue;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) continue;

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) continue;

    let removed = 0;
    for (const message of messages.values()) {
      if (now - message.createdTimestamp > RETENTION_MS) {
        await message.delete().catch(() => undefined);
        removed++;
      }
    }
    if (removed > 0) {
      logger.info(`Auditoria: ${removed} arquivo(s) com +10 dias removido(s) em ${guild.name}.`);
    }
  }
}

/** Agenda a limpeza de auditoria: roda uma vez ao iniciar e depois a cada 24h. */
export function scheduleAuditCleanup(client: Client): void {
  void runCleanup(client);
  setInterval(() => void runCleanup(client), DAY_MS);
}
