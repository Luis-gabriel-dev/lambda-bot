import { Client } from 'discord.js';
import { Event } from '../interfaces/Event';
import { messageActivityRepository } from '../repositories/messageActivity.repository';
import { runAutomod } from '../services/automod.service';
import { handleInstagramMessage } from '../services/instagram.service';
import { handleTrap } from '../services/trap.service';
import { handleBumpChannel } from '../services/bump.service';
import { handlePartnershipMessage } from '../services/partnership.service';

const event: Event<'messageCreate'> = {
  name: 'messageCreate',
  async execute(_client: Client, message) {
    if (!message.guild) return;

    // Canal-armadilha: se a mensagem caiu na trap, já foi tratada (kick) — não processa o resto.
    const trapped = await handleTrap(message).catch(() => false);
    if (trapped) return;

    // Canal exclusivo de /bump: apaga o que não for permitido — não processa o resto.
    const bumped = await handleBumpChannel(message).catch(() => false);
    if (bumped) return;

    // Ticket de parceria: detecta o convite e mantém o automod fora desses canais.
    const partner = await handlePartnershipMessage(message).catch(() => false);
    if (partner) return;

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
