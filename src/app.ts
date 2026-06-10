import { config } from './core/config';
import { createClient } from './core/client';
import { logger } from './core/logger';
import { loadCommands } from './loaders/commandLoader';
import { loadEvents } from './loaders/eventLoader';

/** Inicializa o bot: cria o client, carrega comandos e eventos e faz login. */
export async function startBot(): Promise<void> {
  const client = createClient();

  loadCommands(client);
  loadEvents(client);

  await client.login(config.token);
  logger.info('Login enviado ao Discord.');
}
