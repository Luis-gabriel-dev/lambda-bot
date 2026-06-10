import { Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { truncate } from '../utils/formatter';
import { sendLog } from '../services/log.service';

const event: Event<'messageUpdate'> = {
  name: 'messageUpdate',
  async execute(_client: Client, oldMessage, newMessage) {
    // Precisa das duas versões em cache para comparar o texto com segurança.
    if (oldMessage.partial || newMessage.partial) return;
    if (!newMessage.guild || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return; // edição sem mudança de texto (embed, etc.)

    const embed = new EmbedBuilder()
      .setColor(Palette.warning)
      .setTitle('✏️ Mensagem editada')
      .setURL(newMessage.url)
      .setThumbnail(newMessage.author.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Autor', value: `${newMessage.author} \`${newMessage.author.tag}\`` },
        { name: 'Canal', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'Antes', value: truncate(oldMessage.content || '*(sem texto)*', 1024) },
        { name: 'Depois', value: truncate(newMessage.content || '*(sem texto)*', 1024) }
      )
      .setTimestamp();

    await sendLog(newMessage.guild, 'mensagens', embed);
  }
};

export default event;
