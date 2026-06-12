import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { messageActivityRepository } from '../repositories/messageActivity.repository';
import { runAutomod } from '../services/automod.service';
import { handleInstagramMessage } from '../services/instagram.service';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  async execute(_client: Client, message) {
    if (!message.guild) return;

    // Mural de fotos: se a mensagem virou post (ou foi apagada no canal), não processa o resto.
    const consumed = await handleInstagramMessage(message).catch(() => false);
    if (consumed) return;

    // Automod roda para todos (inclusive outros bots) — ignora o próprio bot internamente.
    await runAutomod(message).catch(() => undefined);

    // Conta mensagens de membros (para requisitos de atividade em sorteios) — em buffer, sem tocar no banco.
    if (!message.author.bot) {
      messageActivityRepository.record(message.guild.id, message.author.id);
    }
  }
};

export default event;
