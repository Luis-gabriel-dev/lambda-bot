import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'stickerDelete'> = {
  name: 'stickerDelete',
  async execute(_client: Client, sticker) {
    if (!sticker.guild) return;
    const executor = await findAuditExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('➖ Figurinha removida')
      .setThumbnail(sticker.url)
      .addFields(
        { name: 'Figurinha', value: `\`${sticker.name}\``, inline: true },
        { name: 'ID', value: sticker.id, inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(sticker.guild, 'servidor', embed);
  }
};

export default event;
