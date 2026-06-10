import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';
import { scheduleAuditCleanup } from '../jobs/cleanAuditLogs';

const event: Event<'clientReady'> = {
  name: 'clientReady',
  once: true,
  execute(_client: Client, readyClient) {
    logger.success(`Bot online como ${readyClient.user.tag}`);
    scheduleAuditCleanup(readyClient);
  }
};

export default event;
