import { config } from './core/config';
import { createClient } from './core/client';
import { connectDatabase } from './core/database';
import { logger } from './core/logger';
import { loadCommands } from './loaders/commandLoader';
import { loadEvents } from './loaders/eventLoader';

/** Inicializa o bot: conecta o banco, cria o client, carrega comandos e eventos e faz login. */
export async function startBot(): Promise<void> {
  await connectDatabase();

  const client = createClient();

  loadCommands(client);
  loadEvents(client);

  await client.login(config.token);
  logger.info('Login enviado ao Discord.');
}
