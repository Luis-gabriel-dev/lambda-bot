import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'emojiCreate'> = {
  name: 'emojiCreate',
  async execute(_client: Client, emoji) {
    const executor = await findAuditExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('➕ Emoji criado')
      .setThumbnail(emoji.imageURL({ size: 128 }))
      .addFields(
        { name: 'Emoji', value: `${emoji} \`:${emoji.name}:\``, inline: true },
        { name: 'ID', value: emoji.id, inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(emoji.guild, 'servidor', embed);
  }
};

export default event;
