import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'discord.js';
import { Command } from '../interfaces/Command';
import { logger } from '../core/logger';

/** Coleta recursivamente todos os arquivos de comando (.ts/.js) sob commands/. */
function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(ts|js)$/.test(entry) && !entry.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Carrega todos os comandos para client.commands e registra seus componentes
 * (botões/modais) em client.components. Retorna a lista de comandos carregados,
 * usada pelo script de deploy para registrar os slash commands no Discord.
 */
export function loadCommands(client: Client): Command[] {
  const dir = join(__dirname, '..', 'commands');
  const loaded: Command[] = [];

  for (const file of collectFiles(dir)) {
    const mod = require(file);
    const command: Command = mod.default ?? mod.command ?? mod;

    if (!command?.data || typeof command.execute !== 'function') {
      logger.warn(`Ignorando arquivo de comando inválido: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);
    for (const component of command.components ?? []) {
      client.components.set(component.id, component);
    }

    loaded.push(command);
    logger.debug(`Comando carregado: /${command.data.name}`);
  }

  logger.info(`${loaded.length} comando(s) carregado(s).`);
  return loaded;
}
