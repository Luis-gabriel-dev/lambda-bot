import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';
import { scheduleAuditCleanup } from '../jobs/cleanAuditLogs';
import { scheduleWarnPenalties } from '../jobs/processWarnPenalties';
import { scheduleGiveaways } from '../jobs/processGiveaways';

const event: Event<'clientReady'> = {
  name: 'clientReady',
  once: true,
  execute(_client: Client, readyClient) {
    logger.success(`Bot online como ${readyClient.user.tag}`);
    scheduleAuditCleanup(readyClient);
    scheduleWarnPenalties(readyClient);
    scheduleGiveaways(readyClient);
  }
};

export default event;
