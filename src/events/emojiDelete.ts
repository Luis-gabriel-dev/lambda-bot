import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'emojiDelete'> = {
  name: 'emojiDelete',
  async execute(_client: Client, emoji) {
    const executor = await findAuditExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('➖ Emoji removido')
      .setThumbnail(emoji.imageURL({ size: 128 }))
      .addFields(
        { name: 'Emoji', value: `\`:${emoji.name}:\``, inline: true },
        { name: 'ID', value: emoji.id, inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(emoji.guild, 'servidor', embed);
  }
};

export default event;
