import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { Command } from '../interfaces/Command';
import { Component } from '../interfaces/Component';

/**
 * Cria e configura o Client do bot.
 *
 * Observação sobre intents: GuildMembers e MessageContent são privilegiados e
 * precisam ser habilitados no Developer Portal. Adicione-os aqui (e lá) quando
 * formos implementar eventos de entrada de membro / leitura de mensagens.
 */
export function createClient(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel]
  });

  client.commands = new Collection<string, Command>();
  client.components = new Collection<string, Component>();

  return client;
}
