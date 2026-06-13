import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'stickerCreate'> = {
  name: 'stickerCreate',
  async execute(_client: Client, sticker) {
    if (!sticker.guild) return;
    const executor = await findAuditExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('➕ Figurinha criada')
      .setThumbnail(sticker.url)
      .addFields(
        { name: 'Figurinha', value: `\`${sticker.name}\``, inline: true },
        { name: 'ID', value: sticker.id, inline: true }
      )
      .setTimestamp();

    if (sticker.description) embed.addFields({ name: 'Descrição', value: sticker.description.slice(0, 1024) });
    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(sticker.guild, 'servidor', embed);
  }
};

export default event;
