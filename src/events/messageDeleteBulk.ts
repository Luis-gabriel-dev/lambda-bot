import { Client, EmbedBuilder, Message } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';
import { sendLog } from '../services/log.service';
import { handleThreadCommentsRemoved } from '../services/instagram.service';

const event: Event<'messageDeleteBulk'> = {
  name: 'messageDeleteBulk',
  async execute(client: Client, messages, channel) {
    // Comentários apagados em massa numa thread de post → diminui o contador.
    if (channel.isThread()) {
      await handleThreadCommentsRemoved(client, channel.id, messages.size);
    }

    // Só mensagens em cache (com conteúdo) e de membros (não bots).
    const cached = [...messages.values()].filter((m): m is Message<true> => !m.partial && !m.author.bot);
    if (cached.length === 0) return;

    cached.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const lines = cached.map(
      (m) => `**${m.author.tag}:** ${truncate(m.content || '*(sem texto / só anexo)*', 200)}`
    );

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('🗑️ Mensagens apagadas em massa')
      .addFields(
        { name: 'Canal', value: `<#${channel.id}>`, inline: true },
        { name: 'Total apagado', value: `${messages.size}`, inline: true }
      )
      .setDescription(truncate(lines.join('\n'), 4096))
      .setTimestamp();

    await sendLog(channel.guild, 'mensagens', embed);
  }
};

export default event;
