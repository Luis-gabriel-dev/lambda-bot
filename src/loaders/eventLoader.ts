import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { logger } from '../core/logger';

/** Carrega todos os eventos sob events/ e os vincula ao client. */
export function loadEvents(client: Client): void {
  const dir = join(__dirname, '..', 'events');
  const files = readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'));

  for (const file of files) {
    const mod = require(join(dir, file));
    const event: Event = mod.default ?? mod.event ?? mod;

    if (!event?.name || typeof event.execute !== 'function') {
      logger.warn(`Ignorando arquivo de evento inválido: ${file}`);
      continue;
    }

    // O cast evita a ginástica de generics ao reespalhar os argumentos do evento.
    const handler = (...args: unknown[]) =>
      (event.execute as (client: Client, ...a: unknown[]) => unknown)(client, ...args);

    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }

    logger.debug(`Evento carregado: ${event.name}`);
  }
}
