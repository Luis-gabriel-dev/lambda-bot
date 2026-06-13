import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { channelTypeLabel, sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'channelCreate'> = {
  name: 'channelCreate',
  async execute(client: Client, channel) {
    const executor = await findAuditExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    // Ignora canais criados pelo próprio bot (ex.: tickets).
    if (executor && executor.id === client.user?.id) return;

    const embed = new EmbedBuilder()
      .setColor(Palette.success)
      .setTitle('➕ Canal criado')
      .addFields(
        { name: 'Canal', value: `${channel} \`${channel.name}\``, inline: true },
        { name: 'Tipo', value: channelTypeLabel(channel.type), inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(channel.guild, 'servidor', embed);
  }
};

export default event;
