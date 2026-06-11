import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { Command } from '../interfaces/Command';
import { Component } from '../interfaces/Component';

/**
 * Cria e configura o Client do bot.
 *
 * Observação sobre intents: GuildMembers é PRIVILEGIADO e precisa ser habilitado
 * no Developer Portal (Bot → Privileged Gateway Intents → Server Members Intent),
 * senão o login falha. MessageContent (também privilegiado) só será necessário
 * quando formos logar conteúdo de mensagens.
 */
export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers, // entrada/saída de membros (privilegiado)
      GatewayIntentBits.GuildModeration, // guildBanAdd / guildBanRemove
      GatewayIntentBits.GuildVoiceStates, // entrar/sair/mudar de call (log de calls)
      GatewayIntentBits.MessageContent // ler conteúdo de mensagens apagadas/editadas (privilegiado)
    ],
    partials: [
      Partials.Channel,
      Partials.Message, // receber delete/edit de mensagens fora do cache
      Partials.GuildMember // receber guildMemberRemove de membros fora do cache (saída sempre logada)
    ]
  });

  client.commands = new Collection<string, Command>();
  client.components = new Collection<string, Component>();

  return client;
}
