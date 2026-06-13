import { AuditLogEvent, Client, EmbedBuilder } from 'discord.js';
import { Event } from '../interfaces/Event';
import { Palette } from '../utils/embeds';
import { channelTypeLabel, sendLog } from '../services/log.service';
import { findAuditExecutor } from '../utils/auditLog';

const event: Event<'channelDelete'> = {
  name: 'channelDelete',
  async execute(client: Client, channel) {
    if (channel.isDMBased()) return;
    const executor = await findAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    // Ignora canais apagados pelo próprio bot (ex.: fechamento de tickets).
    if (executor && executor.id === client.user?.id) return;

    const embed = new EmbedBuilder()
      .setColor(Palette.error)
      .setTitle('🗑️ Canal apagado')
      .addFields(
        { name: 'Canal', value: `\`#${channel.name}\``, inline: true },
        { name: 'Tipo', value: channelTypeLabel(channel.type), inline: true }
      )
      .setTimestamp();

    if (executor) embed.addFields({ name: 'Por', value: `${executor} \`${executor.tag}\`` });

    await sendLog(channel.guild, 'servidor', embed);
  }
};

export default event;
