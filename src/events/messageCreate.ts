import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { messageActivityRepository } from '../repositories/messageActivity.repository';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  async execute(_client: Client, message) {
    // Conta mensagens de membros (para requisitos de atividade em sorteios).
    if (!message.guild || message.author.bot) return;
    await messageActivityRepository.record(message.guild.id, message.author.id).catch(() => undefined);
  }
};

export default event;
