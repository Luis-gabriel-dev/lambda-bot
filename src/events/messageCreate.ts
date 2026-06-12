import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { messageActivityRepository } from '../repositories/messageActivity.repository';
import { runAutomod } from '../services/automod.service';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  async execute(_client: Client, message) {
    if (!message.guild) return;

    // Automod roda para todos (inclusive outros bots) — ignora o próprio bot internamente.
    await runAutomod(message).catch(() => undefined);

    // Conta mensagens de membros (para requisitos de atividade em sorteios).
    if (!message.author.bot) {
      await messageActivityRepository.record(message.guild.id, message.author.id).catch(() => undefined);
    }
  }
};

export default event;
