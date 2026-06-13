import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';
import { scheduleAuditCleanup } from '../jobs/cleanAuditLogs';
import { scheduleWarnPenalties } from '../jobs/processWarnPenalties';
import { scheduleGiveaways } from '../jobs/processGiveaways';
import { schedulePolls } from '../jobs/processPolls';
import { scheduleEconomyDrops } from '../jobs/processEconomyDrops';
import { messageActivityRepository } from '../repositories/messageActivity.repository';

const ACTIVITY_FLUSH_MS = 30_000; // grava o buffer de atividade a cada 30s

const event: Event<'clientReady'> = {
  name: 'clientReady',
  once: true,
  execute(_client: Client, readyClient) {
    logger.success(`Bot online como ${readyClient.user.tag}`);
    scheduleAuditCleanup(readyClient);
    scheduleWarnPenalties(readyClient);
    scheduleGiveaways(readyClient);
    schedulePolls(readyClient);
    scheduleEconomyDrops(readyClient);
    setInterval(() => void messageActivityRepository.flush(), ACTIVITY_FLUSH_MS);
  }
};

export default event;
