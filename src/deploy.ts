import { REST, Routes } from 'discord.js';
import { config } from './core/config';
import { createClient } from './core/client';
import { loadCommands } from './loaders/commandLoader';
import { logger } from './core/logger';

/**
 * Registra os slash commands no servidor (GUILD_ID).
 * Rode `npm run deploy` sempre que adicionar/alterar a definição de um comando.
 * Não é necessário rodar a cada inicialização do bot.
 */
async function deploy(): Promise<void> {
  const client = createClient(); // usado apenas como container para o loader
  const commands = loadCommands(client).map((c) => c.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.token);

  logger.info('Registrando comandos slash...');
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  logger.success(`${commands.length} comando(s) registrado(s) no servidor.`);
}

deploy().catch((err) => {
  logger.error('Falha ao registrar comandos:', err);
  process.exit(1);
});
