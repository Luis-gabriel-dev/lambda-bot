import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';

const event: Event<'clientReady'> = {
  name: 'clientReady',
  once: true,
  execute(_client: Client, readyClient) {
    logger.success(`Bot online como ${readyClient.user.tag}`);
  }
};

export default event;
